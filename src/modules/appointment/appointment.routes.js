const express = require("express");

const {
  createAppointment,
  getDoctorAppointments,
  getDoctorBookedAppointments,
  getAvailableAppointments,
} = require("./appointment.controller");

const { protect } = require("../../middlewares/auth.middleware");

const router = express.Router();

router.post("/", protect, createAppointment);
router.get("/", protect, getDoctorAppointments);
router.get("/booked", protect, getDoctorBookedAppointments);
router.get("/available", protect, getAvailableAppointments);

module.exports = router;
