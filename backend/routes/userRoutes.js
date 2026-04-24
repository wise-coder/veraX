const express = require("express");
const { body, param } = require("express-validator");

const {
  createUser,
  deleteUser,
  getUserById,
  getUsers,
  updateUser,
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/", getUsers);
router.post(
  "/",
  [
    body("fullName").trim().notEmpty().withMessage("Full name is required"),
    body("email").trim().isEmail().withMessage("Valid email is required"),
    body("phone").trim().notEmpty().withMessage("Phone number is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
    body("role").optional().isIn(["admin", "manager", "attendant", "cashier"]).withMessage("Invalid role"),
    body("status").optional().isIn(["active", "inactive"]).withMessage("Invalid status"),
  ],
  createUser,
);
router.get("/:id", [param("id").isMongoId().withMessage("User id must be valid")], getUserById);
router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("User id must be valid"),
    body("fullName").optional().trim().notEmpty().withMessage("Full name cannot be empty"),
    body("email").optional().trim().isEmail().withMessage("Valid email is required"),
    body("phone").optional().trim().notEmpty().withMessage("Phone cannot be empty"),
    body("password").optional().isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
    body("role").optional().isIn(["admin", "manager", "attendant", "cashier"]).withMessage("Invalid role"),
    body("status").optional().isIn(["active", "inactive"]).withMessage("Invalid status"),
  ],
  updateUser,
);
router.delete("/:id", [param("id").isMongoId().withMessage("User id must be valid")], deleteUser);

module.exports = router;
