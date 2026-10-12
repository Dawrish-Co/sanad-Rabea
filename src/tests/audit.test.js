require("dotenv").config();

const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const connectDB = require("../config/database");
const User = require("../modules/auth/auth.model");
const MedicalRecord = require("../modules/medicalRecord/medicalRecord.model");
const AuditLog = require("../modules/audit/audit.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

let patientToken, doctorToken;
let patientId, doctorId;
let recordId;

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });

beforeAll(async () => {
  await connectDB();

  const hashedPassword = await bcrypt.hash("password123", 10);

  const patient = await User.create({
    name: "Test Patient",
    email: "patient_audit@test.com",
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
  doctorId = doctor._id;

  patientToken = signToken(patientId, "PATIENT");
  doctorToken = signToken(doctorId, "DOCTOR");

  const record = await MedicalRecord.create({
    patient: patientId,
    diagnosis: "Test Diagnosis",
    notes: "Test Notes",
    consentGiven: false,
  });

  recordId = record._id;
});

afterAll(async () => {
  await User.deleteMany({
    email: { $in: ["patient_audit@test.com", "doctor_audit@test.com"] },
  });
  await MedicalRecord.deleteMany({ patient: patientId });
  await AuditLog.deleteMany({ patientId });
  await mongoose.connection.close();
});

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
      .send({
        diagnosis: "Updated Diagnosis",
      });

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
    await MedicalRecord.findByIdAndUpdate(recordId, {
      consentGiven: true,
    });

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
      .send({
        diagnosis: "Updated by Doctor",
      });

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
