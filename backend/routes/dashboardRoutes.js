const express = require("express");

const { getDashboardOverview } = require("../controllers/dashboardController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/overview", protect, getDashboardOverview);

module.exports = router;
