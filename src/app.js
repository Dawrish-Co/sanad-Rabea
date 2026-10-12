const express = require("express");
const cookieParser = require("cookie-parser");
const bookingRoutes = require("./modules/booking/booking.routes");
const authRoutes = require("./modules/auth/auth.routes");
const appointmentRoutes = require("./modules/appointment/appointment.routes");
const medicalRecordRoutes = require("./modules/medicalRecord/medicalRecord.routes");
const auditRoutes = require("./modules/audit/audit.routes");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SANAD API is running",
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/appointments", appointmentRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/medical-records", medicalRecordRoutes);
app.use("/api/v1/audit-logs", auditRoutes);
module.exports = app;
