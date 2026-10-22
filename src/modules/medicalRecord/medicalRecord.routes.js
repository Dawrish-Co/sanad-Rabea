const express = require("express");

const {
  createMedicalRecord,
  getMedicalRecord,
  updateMedicalRecord,
} = require("./medicalRecord.controller");

const { protect, requireRole } = require("../../middlewares/auth.middleware");

const router = express.Router();

router.post("/", protect, requireRole("DOCTOR"), createMedicalRecord);

router.get("/:id", protect, getMedicalRecord);
router.patch("/:id", protect, updateMedicalRecord);

module.exports = router;
