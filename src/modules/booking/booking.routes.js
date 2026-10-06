const express = require("express");

const { createBooking } = require("./booking.controller");

const { protect } = require("../../middlewares/auth.middleware");

const router = express.Router();

router.post("/", protect, createBooking);

module.exports = router;
