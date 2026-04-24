const express = require("express");
const { query } = require("express-validator");

const { getReports } = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
  "/",
  protect,
  authorize("admin", "manager"),
  [
    query("startDate").optional().isISO8601().withMessage("startDate must be a valid date"),
    query("endDate").optional().isISO8601().withMessage("endDate must be a valid date"),
    query("parkingSlot").optional().isMongoId().withMessage("parkingSlot must be a valid id"),
    query("paymentMethod").optional().isIn(["cash", "mobile_money", "card"]).withMessage("Invalid payment method"),
  ],
  getReports,
);

module.exports = router;
