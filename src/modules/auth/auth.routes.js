const express = require("express");

const { register, login, logout, getMe } = require("./auth.controller");

const { protect } = require("../../middlewares/auth.middleware");

const router = express.Router();

// Register
router.post("/register", register);

// Login
router.post("/login", login);

// Logout
router.post("/logout", logout);

// Current user
router.get("/me", protect, getMe);

module.exports = router;
