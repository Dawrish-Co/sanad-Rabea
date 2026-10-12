const MedicalRecord = require("./medicalRecord.model");
const AuditLog = require("../audit/audit.model");

const createMedicalRecord = async (req, res) => {
  try {
    const { patientId, diagnosis, notes, consentGiven } = req.body;

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

    const isPatient =
      req.user.id.toString() === medicalRecord.patient.toString();

    const isDoctor = req.user.role === "DOCTOR";

    const relationship = isPatient ? "SELF" : isDoctor ? "DOCTOR" : null;

    const consent = medicalRecord.consentGiven;

    const allowed =
      relationship === "SELF" ||
      (relationship === "DOCTOR" && consent === true);

    await AuditLog.create({
      actor: req.user.id,
      action: "READ",
      resource: "MEDICAL_RECORD",
      recordId: medicalRecord._id,
      patientId: medicalRecord.patient,
      relationship: relationship || "DOCTOR",
      consent,
      outcome: allowed ? "SUCCESS" : "DENIED",
    });

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

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

    const isPatient =
      req.user.id.toString() === medicalRecord.patient.toString();

    const isDoctor = req.user.role === "DOCTOR";

    const relationship = isPatient ? "SELF" : isDoctor ? "DOCTOR" : null;

    const consent = medicalRecord.consentGiven;

    const allowed =
      relationship === "SELF" ||
      (relationship === "DOCTOR" && consent === true);
    await AuditLog.create({
      actor: req.user.id,
      action: "UPDATE",
      resource: "MEDICAL_RECORD",
      recordId: medicalRecord._id,
      patientId: medicalRecord.patient,
      relationship: relationship || "DOCTOR",
      consent,
      outcome: allowed ? "SUCCESS" : "DENIED",
    });

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    medicalRecord.diagnosis = diagnosis ?? medicalRecord.diagnosis;
    medicalRecord.notes = notes ?? medicalRecord.notes;

    await medicalRecord.save();

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
