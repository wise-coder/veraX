const express = require("express");
const { body, param } = require("express-validator");

const {
  createParkingSlot,
  deleteParkingSlot,
  getAvailableSlots,
  getParkingSlotById,
  getParkingSlots,
  updateParkingSlot,
} = require("../controllers/parkingSlotController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", getParkingSlots);
router.get("/available", getAvailableSlots);
router.get("/:id", [param("id").isMongoId().withMessage("Parking slot id must be valid")], getParkingSlotById);
router.post(
  "/",
  authorize("admin", "manager", "attendant"),
  [
    body("slotNumber").trim().notEmpty().withMessage("Slot number is required"),
    body("status").optional().isIn(["available", "occupied", "reserved", "maintenance"]).withMessage("Invalid slot status"),
    body("positionIndex").optional().isInt({ min: 1 }).withMessage("Position index must be at least 1").toInt(),
  ],
  createParkingSlot,
);
router.put(
  "/:id",
  authorize("admin", "manager", "attendant"),
  [
    param("id").isMongoId().withMessage("Parking slot id must be valid"),
    body("slotNumber").optional().trim().notEmpty().withMessage("Slot number cannot be empty"),
    body("status").optional().isIn(["available", "occupied", "reserved", "maintenance"]).withMessage("Invalid slot status"),
    body("positionIndex").optional().isInt({ min: 1 }).withMessage("Position index must be at least 1").toInt(),
  ],
  updateParkingSlot,
);
router.delete("/:id", authorize("admin", "manager", "attendant"), [param("id").isMongoId().withMessage("Parking slot id must be valid")], deleteParkingSlot);

module.exports = router;
