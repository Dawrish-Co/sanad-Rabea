const express = require("express");

const { getAuditLogs } = require("./audit.controller");

const { protect } = require("../../middlewares/auth.middleware");

const router = express.Router();

router.get("/", protect, getAuditLogs);

module.exports = router;
