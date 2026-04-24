const express = require("express");
const { param } = require("express-validator");

const { getTransactionById, getTransactions } = require("../controllers/transactionController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", getTransactions);
router.get("/:id", [param("id").isMongoId().withMessage("Transaction id must be valid")], getTransactionById);

module.exports = router;
