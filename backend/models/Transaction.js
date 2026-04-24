const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  transactionCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    default: null,
  },
  plateNumber: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ["check_in", "check_out", "payment", "slot_update"],
    required: true,
  },
  parkingSlot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ParkingSlot",
    default: null,
  },
  amount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["completed", "pending", "cancelled"],
    default: "completed",
  },
  description: {
    type: String,
    default: "",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
}, {
  timestamps: true,
});

transactionSchema.index({ plateNumber: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Transaction", transactionSchema);
