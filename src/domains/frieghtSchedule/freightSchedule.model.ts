import mongoose from "mongoose";
import { IFreightSchedule } from "./freightSchedule.types";


const freightScheduleSchema = new mongoose.Schema<IFreightSchedule>({
  departingLocation: String,
  arrivalLocation: String,
  day: Number,
}, {
  timestamps: true
});


export const FreightSchedule = mongoose.model("FreightSchedule", freightScheduleSchema);