const express = require("express");
const { body } = require("express-validator");

const { getSettings, resetSettings, updateSettings } = require("../controllers/settingController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", getSettings);
router.put(
  "/",
  authorize("admin"),
  [
    body("parkingLotName").optional().trim().notEmpty().withMessage("Parking lot name cannot be empty"),
    body("address").optional().trim().notEmpty().withMessage("Address cannot be empty"),
    body("timezone").optional().trim().notEmpty().withMessage("Timezone cannot be empty"),
    body("dateFormat").optional().trim().notEmpty().withMessage("Date format cannot be empty"),
    body("currency").optional().trim().notEmpty().withMessage("Currency cannot be empty"),
    body("pricePerMinute").optional().isFloat({ min: 0 }).withMessage("Price per minute cannot be negative").toFloat(),
    body("totalParkingSlots").optional().isInt({ min: 1 }).withMessage("Total parking slots must be at least 1").toInt(),
    body("defaultParkingDuration").optional().isInt({ min: 1 }).withMessage("Default parking duration must be at least 1 hour").toInt(),
    body("overstayGracePeriod").optional().isInt({ min: 0 }).withMessage("Overstay grace period cannot be negative").toInt(),
    body("allowOvernightParking").optional().isBoolean().withMessage("allowOvernightParking must be true or false").toBoolean(),
    body("enableSlotSelection").optional().isBoolean().withMessage("enableSlotSelection must be true or false").toBoolean(),
    body("autoAssignSlot").optional().isBoolean().withMessage("autoAssignSlot must be true or false").toBoolean(),
    body("emailNotifications").optional().isBoolean().withMessage("emailNotifications must be true or false").toBoolean(),
    body("smsNotifications").optional().isBoolean().withMessage("smsNotifications must be true or false").toBoolean(),
    body("paymentNotifications").optional().isBoolean().withMessage("paymentNotifications must be true or false").toBoolean(),
    body("overstayAlerts").optional().isBoolean().withMessage("overstayAlerts must be true or false").toBoolean(),
    body("dailySummaryReports").optional().isBoolean().withMessage("dailySummaryReports must be true or false").toBoolean(),
    body("passwordPolicy").optional().trim().notEmpty().withMessage("Password policy cannot be empty"),
    body("sessionTimeout").optional().isInt({ min: 1 }).withMessage("Session timeout must be at least 1 minute").toInt(),
    body("twoFactorAuthentication").optional().isBoolean().withMessage("twoFactorAuthentication must be true or false").toBoolean(),
    body("loginAttemptLimit").optional().isInt({ min: 1 }).withMessage("Login attempt limit must be at least 1").toInt(),
    body("requireStrongPassword").optional().isBoolean().withMessage("requireStrongPassword must be true or false").toBoolean(),
    body("theme").optional().trim().notEmpty().withMessage("Theme cannot be empty"),
    body("primaryColor").optional().trim().notEmpty().withMessage("Primary color cannot be empty"),
    body("sidebarPosition").optional().trim().notEmpty().withMessage("Sidebar position cannot be empty"),
    body("compactSidebar").optional().isBoolean().withMessage("compactSidebar must be true or false").toBoolean(),
  ],
  updateSettings,
);
router.post("/reset", authorize("admin"), resetSettings);

module.exports = router;
