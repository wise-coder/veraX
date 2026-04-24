const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
}, {
  timestamps: true,
});

companySchema.index({ name: 1 });

module.exports = mongoose.model("Company", companySchema);
