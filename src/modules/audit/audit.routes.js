const express = require("express");

const { getAuditLogs } = require("./audit.controller");

const { protect, requireRole } = require("../../middlewares/auth.middleware");

const router = express.Router();

router.get("/", protect, requireRole("DOCTOR"), getAuditLogs);

module.exports = router;
