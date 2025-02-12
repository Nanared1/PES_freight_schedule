import mongoose from "mongoose";
import { IOrder } from "./order.types";

const orderSchema = new mongoose.Schema<IOrder>({
    orderNumber: Number,
    destination: { type: String, required: true, index: true },
    loaded: { type: Boolean, default: false },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "FreightSchedule", default: null, index: true, unique: false },
}, { timestamps: true });

export const Order = mongoose.model("Order", orderSchema);
