const express = require("express");
const { body, param } = require("express-validator");

const { getPaymentById, getPayments, markPaymentAsPaid } = require("../controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", getPayments);
router.get("/:id", [param("id").isMongoId().withMessage("Payment id must be valid")], getPaymentById);
router.put(
  "/:id/mark-paid",
  authorize("admin", "manager", "cashier", "attendant"),
  [
    param("id").isMongoId().withMessage("Payment id must be valid"),
    body("paymentMethod").optional().isIn(["cash", "mobile_money", "card"]).withMessage("Invalid payment method"),
  ],
  markPaymentAsPaid,
);

module.exports = router;
