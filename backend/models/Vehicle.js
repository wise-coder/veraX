const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema({
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
vehicleSchema.index({ status: 1, entryTime: -1 });

module.exports = mongoose.model("Vehicle", vehicleSchema);
