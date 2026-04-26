require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const connectDB = require("./config/db");
const Company = require("./models/Company");
const Payment = require("./models/Payment");
const Notification = require("./models/Notification");
const ParkingSlot = require("./models/ParkingSlot");
const Setting = require("./models/Setting");
const Transaction = require("./models/Transaction");
const User = require("./models/User");
const Vehicle = require("./models/Vehicle");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();
const jwtSecret = String(process.env.JWT_SECRET || "").trim();

if (
  !jwtSecret
  || jwtSecret === "replace_with_a_long_random_secret"
  || jwtSecret.includes("change_me")
  || jwtSecret.length < 32
) {
  throw new Error("Invalid JWT_SECRET configuration");
}

const allowedOrigins = [
  "https://verax-atqs.onrender.com",
  ...(process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("Blocked by CORS:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "veraX API is running",
    data: {
      environment: process.env.NODE_ENV || "development",
    },
  });
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/vehicles", require("./routes/vehicleRoutes"));
app.use("/api/parking-slots", require("./routes/parkingSlotRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/settings", require("./routes/settingRoutes"));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await Promise.all([
    Company.syncIndexes(),
    User.syncIndexes(),
    Vehicle.syncIndexes(),
    ParkingSlot.syncIndexes(),
    Payment.syncIndexes(),
    Notification.syncIndexes(),
    Transaction.syncIndexes(),
    Setting.syncIndexes(),
  ]);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
