const mongoose = require("mongoose");

const parkingSlotSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true,
  },
  slotNumber: {
    type: String,
    required: true,
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
  },
}, {
  timestamps: true,
});

parkingSlotSchema.index({ company: 1, slotNumber: 1 }, { unique: true });
parkingSlotSchema.index({ company: 1, positionIndex: 1 }, { unique: true });
parkingSlotSchema.index({ company: 1, status: 1, positionIndex: 1 });

module.exports = mongoose.model("ParkingSlot", parkingSlotSchema);
