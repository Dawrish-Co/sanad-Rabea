const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../modules/auth/auth.model");
const MedicalRecord = require("../modules/medicalRecord/medicalRecord.model");
const AuditLog = require("../modules/audit/audit.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

if (!process.env.TEST_MONGO_URI) {
  throw new Error(
    "TEST_MONGO_URI is not set. Set it in .env.test to a dedicated test database. " +
    "Tests must never run against the shared application database."
  );
}

if (process.env.MONGO_URI && process.env.TEST_MONGO_URI === process.env.MONGO_URI) {
  throw new Error(
    "TEST_MONGO_URI must not be identical to MONGO_URI. " +
    "Tests must never run against the application database."
  );
}

let patientToken, otherPatientToken, doctorToken;
let patientId, otherPatientId, doctorId;
let recordId, otherRecordId;

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

beforeAll(async () => {
  await mongoose.connect(process.env.TEST_MONGO_URI);

  const hashedPassword = await bcrypt.hash("password123", 10);

  const patient = await User.create({
    name: "Test Patient",
    email: "patient_audit@test.com",
    password: hashedPassword,
    role: "PATIENT",
  });

  const otherPatient = await User.create({
    name: "Other Patient",
    email: "other_patient@test.com",
    password: hashedPassword,
    role: "PATIENT",
  });

  const doctor = await User.create({
    name: "Test Doctor",
    email: "doctor_audit@test.com",
    password: hashedPassword,
    role: "DOCTOR",
  });

  patientId = patient._id;
  otherPatientId = otherPatient._id;
  doctorId = doctor._id;

  patientToken = signToken(patientId, "PATIENT");
  otherPatientToken = signToken(otherPatientId, "PATIENT");
  doctorToken = signToken(doctorId, "DOCTOR");

  // Patient's own record — consent off by default
  const record = await MedicalRecord.create({
    patient: patientId,
    diagnosis: "Test Diagnosis",
    notes: "Test Notes",
    consentGiven: false,
  });

  // Other patient's record — consent on (to test cross-patient bypass)
  const otherRecord = await MedicalRecord.create({
    patient: otherPatientId,
    diagnosis: "Other Diagnosis",
    notes: "Other Notes",
    consentGiven: true,
  });

  recordId = record._id;
  otherRecordId = otherRecord._id;
});

afterAll(async () => {
  await User.deleteMany({
    email: {
      $in: [
        "patient_audit@test.com",
        "other_patient@test.com",
        "doctor_audit@test.com",
      ],
    },
  });
  await MedicalRecord.deleteMany({ patient: { $in: [patientId, otherPatientId] } });
  await AuditLog.deleteMany({ patientId: { $in: [patientId, otherPatientId] } });
  await mongoose.connection.close();
});

// ─── Original 5 audit scenarios ──────────────────────────────────────────────

describe("Audit log creation on medical record access", () => {
  it("should log READ + SUCCESS when patient reads own record", async () => {
    const res = await request(app)
      .get(`/api/v1/medical-records/${recordId}`)
      .set("Cookie", `token=${patientToken}`);

    expect(res.status).toBe(200);

    const log = await AuditLog.findOne({
      actor: patientId,
      action: "READ",
      recordId,
      outcome: "SUCCESS",
    }).sort({ createdAt: -1 });

    expect(log).not.toBeNull();
    expect(log.relationship).toBe("SELF");
    expect(log.consent).toBe(false);
  });

  it("should log READ + DENIED when doctor reads record without consent", async () => {
    const res = await request(app)
      .get(`/api/v1/medical-records/${recordId}`)
      .set("Cookie", `token=${doctorToken}`);

    expect(res.status).toBe(403);

    const log = await AuditLog.findOne({
      actor: doctorId,
      action: "READ",
      recordId,
      outcome: "DENIED",
    }).sort({ createdAt: -1 });

    expect(log).not.toBeNull();
    expect(log.relationship).toBe("DOCTOR");
    expect(log.consent).toBe(false);
  });

  it("should log UPDATE + DENIED when doctor updates record without consent", async () => {
    const res = await request(app)
      .patch(`/api/v1/medical-records/${recordId}`)
      .set("Cookie", `token=${doctorToken}`)
      .send({ diagnosis: "Updated Diagnosis" });

    expect(res.status).toBe(403);

    const log = await AuditLog.findOne({
      actor: doctorId,
      action: "UPDATE",
      recordId,
      outcome: "DENIED",
    }).sort({ createdAt: -1 });

    expect(log).not.toBeNull();
    expect(log.relationship).toBe("DOCTOR");
    expect(log.consent).toBe(false);
  });

  it("should log READ + SUCCESS when doctor reads with consent", async () => {
    await MedicalRecord.findByIdAndUpdate(recordId, { consentGiven: true });

    const res = await request(app)
      .get(`/api/v1/medical-records/${recordId}`)
      .set("Cookie", `token=${doctorToken}`);

    expect(res.status).toBe(200);

    const log = await AuditLog.findOne({
      actor: doctorId,
      action: "READ",
      recordId,
      outcome: "SUCCESS",
    }).sort({ createdAt: -1 });

    expect(log).not.toBeNull();
    expect(log.relationship).toBe("DOCTOR");
    expect(log.consent).toBe(true);
  });

  it("should log UPDATE + SUCCESS when doctor updates with consent", async () => {
    const res = await request(app)
      .patch(`/api/v1/medical-records/${recordId}`)
      .set("Cookie", `token=${doctorToken}`)
      .send({ diagnosis: "Updated by Doctor" });

    expect(res.status).toBe(200);

    const log = await AuditLog.findOne({
      actor: doctorId,
      action: "UPDATE",
      recordId,
      outcome: "SUCCESS",
    }).sort({ createdAt: -1 });

    expect(log).not.toBeNull();
    expect(log.relationship).toBe("DOCTOR");
    expect(log.consent).toBe(true);
  });
});

// ─── Security regression tests ────────────────────────────────────────────────

describe("Medical record authorization — security regression", () => {
  // Reset patient's record consent to false before this suite
  beforeAll(async () => {
    await MedicalRecord.findByIdAndUpdate(recordId, { consentGiven: false });
  });

  it("1. patient reads own record — 200", async () => {
    const res = await request(app)
      .get(`/api/v1/medical-records/${recordId}`)
      .set("Cookie", `token=${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("2. patient cannot read another patient's record even when consent is true — 403", async () => {
    // otherRecord has consentGiven: true, but the caller is a PATIENT, not a DOCTOR
    const res = await request(app)
      .get(`/api/v1/medical-records/${otherRecordId}`)
      .set("Cookie", `token=${patientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("3. patient cannot update another patient's record — 403", async () => {
    const res = await request(app)
      .patch(`/api/v1/medical-records/${otherRecordId}`)
      .set("Cookie", `token=${patientToken}`)
      .send({ diagnosis: "Malicious update" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("4. doctor without consent cannot read the record — 403", async () => {
    const res = await request(app)
      .get(`/api/v1/medical-records/${recordId}`)
      .set("Cookie", `token=${doctorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("5. doctor without consent cannot update the record — 403", async () => {
    const res = await request(app)
      .patch(`/api/v1/medical-records/${recordId}`)
      .set("Cookie", `token=${doctorToken}`)
      .send({ diagnosis: "No consent update" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("6. doctor with consent can read the record — 200", async () => {
    await MedicalRecord.findByIdAndUpdate(recordId, { consentGiven: true });

    const res = await request(app)
      .get(`/api/v1/medical-records/${recordId}`)
      .set("Cookie", `token=${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("7. doctor with consent can update the record — 200", async () => {
    const res = await request(app)
      .patch(`/api/v1/medical-records/${recordId}`)
      .set("Cookie", `token=${doctorToken}`)
      .send({ diagnosis: "Doctor updated" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("8. patient cannot create a medical record — 403", async () => {
    const res = await request(app)
      .post("/api/v1/medical-records")
      .set("Cookie", `token=${patientToken}`)
      .send({
        patientId: patientId.toString(),
        diagnosis: "Self-created",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("9. invalid request data is rejected on create — 400", async () => {
    const res = await request(app)
      .post("/api/v1/medical-records")
      .set("Cookie", `token=${doctorToken}`)
      .send({
        patientId: "not-a-valid-id",
        // diagnosis missing
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  it("valid-format patient ID for non-existent patient returns 404 on create", async () => {
    const nonExistentPatientId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post("/api/v1/medical-records")
      .set("Cookie", `token=${doctorToken}`)
      .send({
        patientId: nonExistentPatientId,
        diagnosis: "Hypertension",
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Patient not found");
  });

  it("audit log: non-owner patient is never logged as DOCTOR", async () => {
    await MedicalRecord.findByIdAndUpdate(recordId, { consentGiven: false });

    await request(app)
      .get(`/api/v1/medical-records/${otherRecordId}`)
      .set("Cookie", `token=${patientToken}`);

    // No audit log should exist with actor=patientId and relationship=DOCTOR for otherRecord
    const wrongLog = await AuditLog.findOne({
      actor: patientId,
      recordId: otherRecordId,
      relationship: "DOCTOR",
    });

    expect(wrongLog).toBeNull();
  });
});

// ─── Audit log endpoint authorization ────────────────────────────────────────

describe("Audit log endpoint authorization", () => {
  it("10. unauthenticated user cannot retrieve audit logs — 401", async () => {
    const res = await request(app).get("/api/v1/audit-logs");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("11. patient cannot retrieve audit logs — 403", async () => {
    const res = await request(app)
      .get("/api/v1/audit-logs")
      .set("Cookie", `token=${patientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("12. doctor can retrieve audit logs — 200", async () => {
    const res = await request(app)
      .get("/api/v1/audit-logs")
      .set("Cookie", `token=${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("13. audit logs minimize PII and PHI (no patient email/name, no diagnosis/notes)", async () => {
    const res = await request(app)
      .get("/api/v1/audit-logs")
      .set("Cookie", `token=${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    for (const log of res.body.data) {
      if (log.patientId && typeof log.patientId === "object") {
        expect(log.patientId.email).toBeUndefined();
        expect(log.patientId.name).toBeUndefined();
      }
      if (log.recordId && typeof log.recordId === "object") {
        expect(log.recordId.diagnosis).toBeUndefined();
        expect(log.recordId.notes).toBeUndefined();
      }
      if (log.actor && typeof log.actor === "object") {
        expect(log.actor.email).toBeUndefined();
        expect(log.actor.name).toBeUndefined();
      }
    }
  });
});
