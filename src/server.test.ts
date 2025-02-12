import request from "supertest";
import mongoose from "mongoose";
import axios from "axios";
import app from "./server"

import { Order } from "./domains/order";
import { FreightSchedule } from "./domains/frieghtSchedule";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;


beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI!);
});

afterAll(async () => {
  await mongoose.connection.close();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  jest.clearAllMocks();
});

describe("POST /webhook/loadData", () => {
  it("should fetch data, insert orders and freight schedules, and return success message", async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes("PES_Ordes.json")) {
        return Promise.resolve({
          data: [
            { OrderNumber: 1, Destination: "Toronto" },
            { OrderNumber: 2, Destination: "Ottawa" },
          ],
        });
      }
      if (url.includes("PES_FreightSchedule.json")) {
        return Promise.resolve({
          data: [
            { DepartingLocation: "Montreal", ArrivalLocation: "Toronto", Day: 1 },
          ],
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    const res = await request(app).post("/webhook/loadData");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Data loaded successfully.");

    const orders = await Order.find();
    expect(orders.length).toBe(2);
    expect(orders[0].orderNumber).toBe(1);
    expect(orders[0].destination).toBe("Toronto");
    expect(orders[0].loaded).toBe(false);
    expect(orders[0].transportId).toBeNull();

    const schedules = await FreightSchedule.find();
    expect(schedules.length).toBe(1);
    expect(schedules[0].departingLocation).toBe("Montreal");
    expect(schedules[0].arrivalLocation).toBe("Toronto");
    expect(schedules[0].day).toBe(1);
  });
});

describe("GET /orders", () => {
  it("should return paginated orders", async () => {
    await Order.insertMany([
      { orderNumber: 1, destination: "Toronto", loaded: false, transportId: null },
      { orderNumber: 2, destination: "Ottawa", loaded: false, transportId: null },
    ]);

    const res = await request(app).get("/orders").query({ page: 1, limit: 1 });
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBe(1);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(1);
    expect(res.body.pagination.totalOrders).toBe(2);
    expect(res.body.pagination.totalPages).toBe(2);
  });
});

describe("GET /schedules", () => {
  it("should return paginated freight schedules", async () => {
    await FreightSchedule.insertMany([
      { departingLocation: "Montreal", arrivalLocation: "Toronto", day: 1 },
      { departingLocation: "Windsor", arrivalLocation: "Ottawa", day: 2 },
    ]);

    const res = await request(app).get("/schedules").query({ page: 1, limit: 1 });
    expect(res.status).toBe(200);
    expect(res.body.schedules.length).toBe(1);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(1);
    expect(res.body.pagination.totalPages).toBe(2);
  });
});

describe("POST /scheduleOrders", () => {
  it("should load orders based on availableSlots and update orders accordingly", async () => {
    const schedule = await FreightSchedule.create({
      departingLocation: "Montreal",
      arrivalLocation: "Toronto",
      day: 1,
    });

    await Order.insertMany([
      { orderNumber: 1, destination: "Toronto", loaded: false, transportId: null },
      { orderNumber: 2, destination: "Toronto", loaded: false, transportId: null },
      { orderNumber: 3, destination: "Ottawa", loaded: false, transportId: null },
    ]);

    const res = await request(app).post("/scheduleOrders").send({ availableSlots: 1 });
    expect(res.status).toBe(200);
    expect(res.body.loadedCount).toBe(1);
    expect(res.body.unloadedCount).toBe(2);

    const loadedOrders = await Order.find({ loaded: true });
    expect(loadedOrders.length).toBe(1);
    expect(loadedOrders[0].transportId.toString()).toBe(schedule._id.toString());
  });
});

describe("GET /unloadedOrders", () => {
  it("should return only orders that are not loaded", async () => {
    await Order.insertMany([
      { orderNumber: 1, destination: "Toronto", loaded: false, transportId: null },
      { orderNumber: 2, destination: "Ottawa", loaded: true, transportId: new mongoose.Types.ObjectId() },
      { orderNumber: 3, destination: "Montreal", loaded: false, transportId: null },
    ]);

    const res = await request(app).get("/unloadedOrders");
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBe(2);
    res.body.orders.forEach((order: any) => {
      expect(order.loaded).toBe(false);
    });
  });
});

describe("GET /loadedOrders/:transportId", () => {
  it("should return schedule with loaded orders", async () => {
    const schedule = await FreightSchedule.create({
      departingLocation: "Montreal",
      arrivalLocation: "Toronto",
      day: 1,
    });

    await Order.insertMany([
      { orderNumber: 1, destination: "Toronto", loaded: true, transportId: schedule._id },
      { orderNumber: 2, destination: "Toronto", loaded: true, transportId: schedule._id },
      { orderNumber: 3, destination: "Toronto", loaded: false, transportId: null },
    ]);

    const res = await request(app).get(`/loadedOrders/${schedule._id}`);
    expect(res.status).toBe(200);
    expect(res.body.numOfOrders).toBe(2);
    expect(res.body.orders.length).toBe(2);
    expect(res.body.departingLocation).toBe("Montreal");
  });

  it("should return 404 if the transport (schedule) is not found", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/loadedOrders/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Transport not found");
  });
});
