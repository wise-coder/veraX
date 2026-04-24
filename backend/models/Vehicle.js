const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true,
  },
  plateNumber: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  ownerName: {
    type: String,
    required: true,
    trim: true,
  },
  ownerPhone: {
    type: String,
    required: true,
    trim: true,
  },
  vehicleType: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ["parked", "checked_out"],
    default: "checked_out",
  },
  currentSlot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ParkingSlot",
    default: null,
  },
  entryTime: {
    type: Date,
    default: null,
  },
  exitTime: {
    type: Date,
    default: null,
  },
  durationInMinutes: {
    type: Number,
    default: 0,
  },
  amountToPay: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
}, {
  timestamps: true,
});

vehicleSchema.index({ ownerName: 1 });
vehicleSchema.index({ ownerPhone: 1 });
vehicleSchema.index({ company: 1, plateNumber: 1, status: 1 });
vehicleSchema.index({ company: 1, status: 1, entryTime: -1 });

module.exports = mongoose.model("Vehicle", vehicleSchema);
