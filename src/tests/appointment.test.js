const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../modules/auth/auth.model");
const Appointment = require("../modules/appointment/appointment.model");
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

let doctorToken, doctor2Token, patientToken;
let doctorId, doctor2Id, patientId;
const createdAppointmentIds = [];

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

beforeAll(async () => {
  await mongoose.connect(process.env.TEST_MONGO_URI);

  const hashedPassword = await bcrypt.hash("password123", 10);

  const doctor = await User.create({
    name: "Dr. Appointment Test",
    email: "doctor_appt@test.com",
    password: hashedPassword,
    role: "DOCTOR",
  });

  const doctor2 = await User.create({
    name: "Dr. Second Appointment",
    email: "doctor2_appt@test.com",
    password: hashedPassword,
    role: "DOCTOR",
  });

  const patient = await User.create({
    name: "Patient Appointment Test",
    email: "patient_appt@test.com",
    password: hashedPassword,
    role: "PATIENT",
  });

  doctorId = doctor._id;
  doctor2Id = doctor2._id;
  patientId = patient._id;

  doctorToken = signToken(doctorId, "DOCTOR");
  doctor2Token = signToken(doctor2Id, "DOCTOR");
  patientToken = signToken(patientId, "PATIENT");
});

afterAll(async () => {
  await User.deleteMany({
    email: {
      $in: [
        "doctor_appt@test.com",
        "doctor2_appt@test.com",
        "patient_appt@test.com",
      ],
    },
  });

  if (createdAppointmentIds.length > 0) {
    await Appointment.deleteMany({ _id: { $in: createdAppointmentIds } });
  }

  await mongoose.connection.close();
});

describe("Week 6 — Appointment Scheduling & Slot Management Service", () => {
  it("1. Doctor successfully creates an available appointment slot — 201", async () => {
    const res = await request(app)
      .post("/api/v1/appointments")
      .set("Cookie", `token=${doctorToken}`)
      .send({
        date: "2026-11-15",
        startTime: "09:00",
        endTime: "09:30",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Appointment slot created successfully");
    expect(res.body.data.appointment).toBeDefined();
    expect(res.body.data.appointment.status).toBe("AVAILABLE");
    expect(res.body.data.appointment.doctor.toString()).toBe(doctorId.toString());

    createdAppointmentIds.push(res.body.data.appointment._id);
  });

  it("2. Patient cannot create an appointment slot — 403", async () => {
    const res = await request(app)
      .post("/api/v1/appointments")
      .set("Cookie", `token=${patientToken}`)
      .send({
        date: "2026-11-15",
        startTime: "10:00",
        endTime: "10:30",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Only doctors can create appointment slots");
  });

  it("3. Unauthenticated request to create slot is rejected — 401", async () => {
    const res = await request(app)
      .post("/api/v1/appointments")
      .send({
        date: "2026-11-15",
        startTime: "10:00",
        endTime: "10:30",
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("4. Rejects request with missing required fields — 400", async () => {
    const res = await request(app)
      .post("/api/v1/appointments")
      .set("Cookie", `token=${doctorToken}`)
      .send({
        date: "2026-11-15",
        // startTime and endTime missing
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
  });

  it("5. Rejects invalid time formats — 400", async () => {
    const res = await request(app)
      .post("/api/v1/appointments")
      .set("Cookie", `token=${doctorToken}`)
      .send({
        date: "2026-11-15",
        startTime: "25:00",
        endTime: "09:30",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("6. Rejects slot when endTime is before or equal to startTime — 400", async () => {
    const res = await request(app)
      .post("/api/v1/appointments")
      .set("Cookie", `token=${doctorToken}`)
      .send({
        date: "2026-11-15",
        startTime: "11:00",
        endTime: "10:30",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("End time must be after start time");

    const sameTimeRes = await request(app)
      .post("/api/v1/appointments")
      .set("Cookie", `token=${doctorToken}`)
      .send({
        date: "2026-11-15",
        startTime: "11:00",
        endTime: "11:00",
      });

    expect(sameTimeRes.status).toBe(400);
    expect(sameTimeRes.body.message).toBe("End time must be after start time");
  });

  it("7. Overlapping slot detection: rejects duplicate or overlapping slots for the same doctor — 409", async () => {
    // Slot 1: 14:00 - 15:00
    const slot1 = await request(app)
      .post("/api/v1/appointments")
      .set("Cookie", `token=${doctorToken}`)
      .send({
        date: "2026-11-16",
        startTime: "14:00",
        endTime: "15:00",
      });

    expect(slot1.status).toBe(201);
    createdAppointmentIds.push(slot1.body.data.appointment._id);

    // Exact duplicate attempt
    const dupRes = await request(app)
      .post("/api/v1/appointments")
      .set("Cookie", `token=${doctorToken}`)
      .send({
        date: "2026-11-16",
        startTime: "14:00",
        endTime: "15:00",
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.message).toBe("Appointment slot overlaps with an existing slot");

    // Partial overlap attempt (14:30 - 15:30)
    const partialOverlapRes = await request(app)
      .post("/api/v1/appointments")
      .set("Cookie", `token=${doctorToken}`)
      .send({
        date: "2026-11-16",
        startTime: "14:30",
        endTime: "15:30",
      });

    expect(partialOverlapRes.status).toBe(409);
    expect(partialOverlapRes.body.message).toBe("Appointment slot overlaps with an existing slot");

    // Enclosing overlap attempt (13:30 - 15:30)
    const enclosingRes = await request(app)
      .post("/api/v1/appointments")
      .set("Cookie", `token=${doctorToken}`)
      .send({
        date: "2026-11-16",
        startTime: "13:30",
        endTime: "15:30",
      });

    expect(enclosingRes.status).toBe(409);
    expect(enclosingRes.body.message).toBe("Appointment slot overlaps with an existing slot");
  });

  it("8. Adjacent non-overlapping slots succeed — 201", async () => {
    // 15:00 - 15:30 immediately adjacent to 14:00 - 15:00
    const res = await request(app)
      .post("/api/v1/appointments")
      .set("Cookie", `token=${doctorToken}`)
      .send({
        date: "2026-11-16",
        startTime: "15:00",
        endTime: "15:30",
      });

    expect(res.status).toBe(201);
    createdAppointmentIds.push(res.body.data.appointment._id);
  });

  it("9. Different doctor can create a slot at the same time without conflict — 201", async () => {
    // Doctor 2 at 14:00 - 15:00 on same date
    const res = await request(app)
      .post("/api/v1/appointments")
      .set("Cookie", `token=${doctor2Token}`)
      .send({
        date: "2026-11-16",
        startTime: "14:00",
        endTime: "15:00",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.appointment.doctor.toString()).toBe(doctor2Id.toString());
    createdAppointmentIds.push(res.body.data.appointment._id);
  });

  it("10. Doctor views own appointments schedule — 200", async () => {
    const res = await request(app)
      .get("/api/v1/appointments")
      .set("Cookie", `token=${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.appointments)).toBe(true);
    expect(res.body.data.appointments.length).toBeGreaterThan(0);
  });

  it("11. Patient cannot access doctor schedule endpoint — 403", async () => {
    const res = await request(app)
      .get("/api/v1/appointments")
      .set("Cookie", `token=${patientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Only doctors can view their appointments");
  });

  it("12. Available appointments endpoint returns slots with status AVAILABLE — 200", async () => {
    const res = await request(app)
      .get("/api/v1/appointments/available")
      .set("Cookie", `token=${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.appointments)).toBe(true);
    res.body.data.appointments.forEach((appt) => {
      expect(appt.status).toBe("AVAILABLE");
      expect(appt.doctor).toBeDefined();
    });
  });
});
