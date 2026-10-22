const Joi = require("joi");
const MedicalRecord = require("./medicalRecord.model");
const AuditLog = require("../audit/audit.model");
const User = require("../auth/auth.model");

const createMedicalRecordSchema = Joi.object({
  patientId: Joi.string().hex().length(24).required(),
  diagnosis: Joi.string().trim().min(1).max(500).required(),
  notes: Joi.string().trim().max(1000).optional(),
  consentGiven: Joi.boolean().optional(),
});

const createMedicalRecord = async (req, res) => {
  try {
    const { error, value } = createMedicalRecordSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((d) => d.message),
      });
    }

    const { patientId, diagnosis, notes, consentGiven } = value;

    const patient = await User.findById(patientId);

    if (!patient || patient.role !== "PATIENT") {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const medicalRecord = await MedicalRecord.create({
      patient: patientId,
      diagnosis,
      notes,
      consentGiven: consentGiven ?? false,
    });

    return res.status(201).json({
      success: true,
      message: "Medical record created successfully",
      data: medicalRecord,
    });
  } catch (error) {
    console.error("Create Medical Record Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create medical record",
    });
  }
};

const getMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params;

    const medicalRecord = await MedicalRecord.findById(id);

    if (!medicalRecord) {
      return res.status(404).json({
        success: false,
        message: "Medical record not found",
      });
    }

    const isOwner =
      req.user.id.toString() === medicalRecord.patient.toString();
    const isDoctor = req.user.role === "DOCTOR";

    // A non-owner patient is never treated as a doctor
    if (!isOwner && !isDoctor) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const relationship = isOwner ? "SELF" : "DOCTOR";
    const consent = medicalRecord.consentGiven;
    const allowed = relationship === "SELF" || consent === true;

    if (!allowed) {
      try {
        await AuditLog.create({
          actor: req.user.id,
          action: "READ",
          resource: "MEDICAL_RECORD",
          recordId: medicalRecord._id,
          patientId: medicalRecord.patient,
          relationship,
          consent,
          outcome: "DENIED",
        });
      } catch (auditError) {
        console.error("Audit write failed on denied READ:", auditError);
      }

      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Audit is written only after authorization succeeds
    await AuditLog.create({
      actor: req.user.id,
      action: "READ",
      resource: "MEDICAL_RECORD",
      recordId: medicalRecord._id,
      patientId: medicalRecord.patient,
      relationship,
      consent,
      outcome: "SUCCESS",
    });

    return res.status(200).json({
      success: true,
      data: medicalRecord,
    });
  } catch (error) {
    console.error("Get Medical Record Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to access medical record",
    });
  }
};

const updateMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { diagnosis, notes } = req.body;

    const medicalRecord = await MedicalRecord.findById(id);

    if (!medicalRecord) {
      return res.status(404).json({
        success: false,
        message: "Medical record not found",
      });
    }

    const isOwner =
      req.user.id.toString() === medicalRecord.patient.toString();
    const isDoctor = req.user.role === "DOCTOR";

    // A non-owner patient is never treated as a doctor
    if (!isOwner && !isDoctor) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const relationship = isOwner ? "SELF" : "DOCTOR";
    const consent = medicalRecord.consentGiven;
    const allowed = relationship === "SELF" || consent === true;

    if (!allowed) {
      try {
        await AuditLog.create({
          actor: req.user.id,
          action: "UPDATE",
          resource: "MEDICAL_RECORD",
          recordId: medicalRecord._id,
          patientId: medicalRecord.patient,
          relationship,
          consent,
          outcome: "DENIED",
        });
      } catch (auditError) {
        console.error("Audit write failed on denied UPDATE:", auditError);
      }

      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    medicalRecord.diagnosis = diagnosis ?? medicalRecord.diagnosis;
    medicalRecord.notes = notes ?? medicalRecord.notes;

    await medicalRecord.save();

    // Audit is written only after a confirmed successful save
    await AuditLog.create({
      actor: req.user.id,
      action: "UPDATE",
      resource: "MEDICAL_RECORD",
      recordId: medicalRecord._id,
      patientId: medicalRecord.patient,
      relationship,
      consent,
      outcome: "SUCCESS",
    });

    return res.status(200).json({
      success: true,
      message: "Medical record updated successfully",
      data: medicalRecord,
    });
  } catch (error) {
    console.error("Update Medical Record Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update medical record",
    });
  }
};

module.exports = {
  createMedicalRecord,
  getMedicalRecord,
  updateMedicalRecord,
};
