const mongoose = require("mongoose");

const parkingSlotSchema = new mongoose.Schema({
  slotNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ["available", "occupied", "reserved", "maintenance"],
    default: "available",
  },
  currentVehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    default: null,
  },
  positionIndex: {
    type: Number,
    required: true,
    unique: true,
  },
}, {
  timestamps: true,
});

parkingSlotSchema.index({ status: 1, positionIndex: 1 });

module.exports = mongoose.model("ParkingSlot", parkingSlotSchema);
