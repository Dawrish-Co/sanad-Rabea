const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    action: {
      type: String,
      enum: ["READ", "UPDATE"],
      required: true,
    },

    resource: {
      type: String,
      enum: ["MEDICAL_RECORD"],
      required: true,
    },

    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalRecord",
      required: true,
    },

    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    relationship: {
      type: String,
      enum: ["SELF", "DOCTOR"],
      required: true,
    },

    consent: {
      type: Boolean,
      required: true,
    },

    outcome: {
      type: String,
      enum: ["SUCCESS", "DENIED", "FAILED"],
      required: true,
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

module.exports = AuditLog;