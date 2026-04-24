const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true,
  },
  paymentCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    required: true,
  },
  plateNumber: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  durationInMinutes: {
    type: Number,
    default: 0,
  },
  amountToPay: {
    type: Number,
    default: 0,
  },
  paymentMethod: {
    type: String,
    enum: ["cash", "mobile_money", "card"],
    default: "cash",
  },
  status: {
    type: String,
    enum: ["paid", "pending", "failed"],
    default: "pending",
  },
  paidAt: {
    type: Date,
    default: null,
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
}, {
  timestamps: true,
});

paymentSchema.index({ company: 1, plateNumber: 1, status: 1, createdAt: -1 });
paymentSchema.index({ company: 1, paymentMethod: 1, status: 1, paidAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
