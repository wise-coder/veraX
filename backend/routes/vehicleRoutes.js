const express = require("express");
const { body, param } = require("express-validator");

const {
  checkInVehicle,
  checkOutVehicle,
  createVehicle,
  deleteVehicle,
  getVehicleById,
  getVehicles,
  updateVehicle,
} = require("../controllers/vehicleController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();

const vehicleBodyValidators = [
  body("plateNumber").trim().notEmpty().withMessage("Plate number is required"),
  body("ownerName").trim().notEmpty().withMessage("Owner name is required"),
  body("ownerPhone").trim().notEmpty().withMessage("Owner phone is required"),
  body("vehicleType").trim().notEmpty().withMessage("Vehicle type is required"),
  body("parkingSlotId").optional().isMongoId().withMessage("Parking slot id must be valid"),
  body("entryTime").optional().isISO8601().withMessage("Entry time must be a valid date").toDate(),
  body("paymentMethod").optional().isIn(["cash", "mobile_money", "card"]).withMessage("Invalid payment method"),
  body("note").optional().isString().withMessage("Note must be a string"),
];

router.use(protect);

router.get("/", getVehicles);
router.post("/", authorize("admin", "manager", "attendant"), vehicleBodyValidators, createVehicle);
router.post("/check-in", authorize("admin", "manager", "attendant"), vehicleBodyValidators, checkInVehicle);
router.post(
  "/check-out/:id",
  authorize("admin", "manager", "attendant", "cashier"),
  [
    param("id").isMongoId().withMessage("Vehicle id must be valid"),
    body("paymentMethod").optional().isIn(["cash", "mobile_money", "card"]).withMessage("Invalid payment method"),
    body("status").optional().isIn(["paid", "pending"]).withMessage("Status must be paid or pending"),
    body("markAsPaid").optional().isBoolean().withMessage("markAsPaid must be true or false").toBoolean(),
  ],
  checkOutVehicle,
);
router.get("/:id", [param("id").isMongoId().withMessage("Vehicle id must be valid")], getVehicleById);
router.put(
  "/:id",
  authorize("admin", "manager", "attendant"),
  [
    param("id").isMongoId().withMessage("Vehicle id must be valid"),
    body("plateNumber").optional().trim().notEmpty().withMessage("Plate number cannot be empty"),
    body("ownerName").optional().trim().notEmpty().withMessage("Owner name cannot be empty"),
    body("ownerPhone").optional().trim().notEmpty().withMessage("Owner phone cannot be empty"),
    body("vehicleType").optional().trim().notEmpty().withMessage("Vehicle type cannot be empty"),
  ],
  updateVehicle,
);
router.delete("/:id", authorize("admin", "manager"), [param("id").isMongoId().withMessage("Vehicle id must be valid")], deleteVehicle);

module.exports = router;
