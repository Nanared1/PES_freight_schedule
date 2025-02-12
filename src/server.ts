import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { IOrder, IOrderFromAPI, Order } from "./domains/order";
import { FreightSchedule, IFreightSchedule, IFreightScheduleFromAPI } from "./domains/frieghtSchedule";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = process.env.PORT!;

app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI!);

app.post("/webhook/loadData", async (_, res) => {
  try {
    const [ordersRes, scheduleRes] = await Promise.all([
      axios.get("https://pauls-express-shipping.s3.us-east-1.amazonaws.com/PES_Ordes.json"),
      axios.get("https://pauls-express-shipping.s3.us-east-1.amazonaws.com/PES_FreightSchedule.json"),
    ]);
  
    await Order.deleteMany({});
    await FreightSchedule.deleteMany({});
  
    const transformedOrders: IOrder[] = ordersRes.data.map((order: IOrderFromAPI) => ({
      orderNumber: order.OrderNumber,
      destination: order.Destination,
      loaded: false,
      transportId: null,
    }));
  
    await Order.insertMany(transformedOrders);
  
    const transformedFreightSchedules: IFreightSchedule[] = scheduleRes.data.map((schedule: IFreightScheduleFromAPI) => ({
      departingLocation: schedule.DepartingLocation,
      arrivalLocation: schedule.ArrivalLocation,
      day: schedule.Day,
    }));
      
    await FreightSchedule.insertMany(transformedFreightSchedules);
    res.json({ message: "Data loaded successfully." });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ message: "Failed to load data." });
  }
});

app.get("/orders", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const sortBy = req.query.sortBy?.toString() || 'orderNumber';
    const sortOrder = req.query.sortOrder?.toString() || 'asc';

    const orders = await Order.find()
      .skip((page - 1) * Number(limit))
      .limit(limit)
      .sort({[sortBy]: sortOrder === 'desc' ? -1 : 1 });

    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);

    res.json({
      orders,
      pagination: {
        page: page,
        limit: limit,
        totalOrders,
        totalPages,
      }
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Failed to fetch orders." });
  }
});


app.get("/schedules", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const sortBy = req.query.sortBy?.toString() || 'orderNumber';
    const sortOrder = req.query.sortOrder?.toString() || 'asc';

    const schedules = await FreightSchedule.find()
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({[sortBy]: sortOrder === 'desc' ? -1 : 1 });

    const totalSchedules = await FreightSchedule.countDocuments();
    const totalPages = Math.ceil(totalSchedules / limit);

    res.json({
      schedules,
      pagination: {
        page: Number(page),
        limit: limit,
        totalSchedules,
        totalPages,
      }
    });
  } catch (error) {
    console.error("Error fetching schedules:", error);
    res.status(500).json({ message: "Failed to fetch schedules." });
  }
});

app.post("/scheduleOrders", async (req, res) => {
  try {
    let { availableSlots = 25 } = req.body;
    const schedules = await FreightSchedule.find();

    let loadedCount = 0;
    let unloadedCount = await Order.countDocuments({ loaded: false });

    for (const schedule of schedules) {
      const orders = await Order.find({ loaded: false,  destination: schedule.arrivalLocation}).sort("orderNumber");
      const bulkOrders: mongoose.AnyBulkWriteOperation<IOrder>[] = [];

      const numOfLoadedOrders = await Order.countDocuments({ transportId: schedule._id });
      availableSlots = availableSlots - numOfLoadedOrders;

      if (availableSlots <= 0) {
        break;
      }

      const toLoad = orders.splice(0, availableSlots);

      toLoad.forEach(order => {
        bulkOrders.push({
          updateOne: {
            filter: { _id: order._id },
            update: { $set: { loaded: true, transportId: schedule._id } }
          }
        });
      });

      if (bulkOrders.length > 0) {
        await Order.bulkWrite(bulkOrders);
      }

      loadedCount += toLoad.length;
      unloadedCount -= toLoad.length;
    }

    res.json({ loadedCount, unloadedCount});
  } catch (error) {
    console.error("Error scheduling orders:", error);
    res.status(500).json({ message: "Failed to schedule orders." });
  }
});

app.get("/unloadedOrders", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const sortBy = req.query.sortBy?.toString() || 'orderNumber';
    const sortOrder = req.query.sortOrder?.toString() || 'asc';

    const orders = await Order.find({ loaded: false })
      .skip((page - 1) * Number(limit))
      .limit(limit)
      .sort({[sortBy]: sortOrder === 'desc' ? -1 : 1 });

    const totalOrders = await Order.countDocuments({ loaded: false });
    const totalPages = Math.ceil(totalOrders / limit);

    res.json({
      orders,
      pagination: {
        page: page,
        limit: limit,
        totalOrders,
        totalPages,
      }
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Failed to fetch orders." });
  }
});

app.get("/loadedOrders/:transportId", async (req, res) => {
	const { transportId } = req.params;
  const schedule = await FreightSchedule.findById(transportId);
  if (!schedule) {
		res.status(404).json({ message: "Transport not found" });
		return;
	}
  
  const orders = await Order.find({ transportId: schedule._id });
  const scheduleWithOrders = { ...schedule.toJSON(), numOfOrders: orders.length, orders };

  res.json(scheduleWithOrders);
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;