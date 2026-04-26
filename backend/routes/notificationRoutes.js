const express = require("express");
const { body, param } = require("express-validator");

const {
  createNotification,
  deleteNotification,
  getNotifications,
  markNotificationRead,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", getNotifications);
router.post(
  "/",
  [
    body("message").trim().notEmpty().withMessage("Notification message is required"),
    body("type").optional().isIn(["success", "info", "warning", "danger"]).withMessage("Invalid notification type"),
    body("page").optional().isString().withMessage("Notification page must be a string"),
  ],
  createNotification,
);
router.put(
  "/:id/read",
  [param("id").isMongoId().withMessage("Notification id must be valid")],
  markNotificationRead,
);
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Notification id must be valid")],
  deleteNotification,
);

module.exports = router;
