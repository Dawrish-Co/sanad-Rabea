const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../modules/auth/auth.model");
const Appointment = require("../modules/appointment/appointment.model");
const Booking = require("../modules/booking/booking.model");
const { isTransactionSupported } = require("../modules/booking/booking.controller");
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
const createdAppointmentIds = [];

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

beforeAll(async () => {
  await mongoose.connect(process.env.TEST_MONGO_URI);

  const hashedPassword = await bcrypt.hash("password123", 10);

  const patient = await User.create({
    name: "Booking Patient",
    email: "patient_booking@test.com",
    password: hashedPassword,
    role: "PATIENT",
  });

  const otherPatient = await User.create({
    name: "Other Booking Patient",
    email: "other_patient_booking@test.com",
    password: hashedPassword,
    role: "PATIENT",
  });

  const doctor = await User.create({
    name: "Booking Doctor",
    email: "doctor_booking@test.com",
    password: hashedPassword,
    role: "DOCTOR",
  });

  patientId = patient._id;
  otherPatientId = otherPatient._id;
  doctorId = doctor._id;

  patientToken = signToken(patientId, "PATIENT");
  otherPatientToken = signToken(otherPatientId, "PATIENT");
  doctorToken = signToken(doctorId, "DOCTOR");
});

afterAll(async () => {
  await User.deleteMany({
    email: {
      $in: [
        "patient_booking@test.com",
        "other_patient_booking@test.com",
        "doctor_booking@test.com",
      ],
    },
  });

  if (createdAppointmentIds.length > 0) {
    await Booking.deleteMany({ appointment: { $in: createdAppointmentIds } });
    await Appointment.deleteMany({ _id: { $in: createdAppointmentIds } });
  }

  await mongoose.connection.close();
});

const createTestSlot = async (startTime = "09:00", endTime = "09:30") => {
  const appointment = await Appointment.create({
    doctor: doctorId,
    date: new Date("2026-11-01"),
    startTime,
    endTime,
    status: "AVAILABLE",
  });
  createdAppointmentIds.push(appointment._id);
  return appointment;
};

describe("Week 2 — Appointment Booking & Transaction Guarantees", () => {
  it("0. Precondition: verifies test database is a genuine Replica Set supporting native transactions", async () => {
    const isSupported = isTransactionSupported();
    if (!isSupported) {
      throw new Error(
        "BLOCKED: The test database does not support native multi-document transactions. " +
        "Ensure TEST_MONGO_URI connects to an active MongoDB Replica Set."
      );
    }
    expect(isSupported).toBe(true);
  });

  it("1. Successful booking: returns 201, slot is BOOKED, booking record exists", async () => {
    const slot = await createTestSlot("10:00", "10:30");

    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Cookie", `token=${patientToken}`)
      .send({ appointmentId: slot._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Appointment booked successfully");
    expect(res.body.data.appointment.status).toBe("BOOKED");
    expect(res.body.data.booking).toBeDefined();

    const updatedSlot = await Appointment.findById(slot._id);
    expect(updatedSlot.status).toBe("BOOKED");
    expect(updatedSlot.patient.toString()).toBe(patientId.toString());

    const bookingRecord = await Booking.findOne({ appointment: slot._id });
    expect(bookingRecord).not.toBeNull();
    expect(bookingRecord.patient.toString()).toBe(patientId.toString());
  });

  it("2. Duplicate booking: second attempt on already booked slot returns 409", async () => {
    const slot = await createTestSlot("10:30", "11:00");

    const firstRes = await request(app)
      .post("/api/v1/bookings")
      .set("Cookie", `token=${patientToken}`)
      .send({ appointmentId: slot._id.toString() });

    expect(firstRes.status).toBe(201);

    const secondRes = await request(app)
      .post("/api/v1/bookings")
      .set("Cookie", `token=${otherPatientToken}`)
      .send({ appointmentId: slot._id.toString() });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.success).toBe(false);
    expect(secondRes.body.message).toBe("Appointment is not available");

    const bookings = await Booking.find({ appointment: slot._id });
    expect(bookings.length).toBe(1);
    expect(bookings[0].patient.toString()).toBe(patientId.toString());
  });

  it("3. Unavailable slot: non-existent slot returns 409 and creates no booking", async () => {
    const fakeSlotId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Cookie", `token=${patientToken}`)
      .send({ appointmentId: fakeSlotId });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Appointment is not available");

    const bookingRecord = await Booking.findOne({ appointment: fakeSlotId });
    expect(bookingRecord).toBeNull();
  });

  it("4. Forced failure after slot update: rolls back and slot remains AVAILABLE", async () => {
    const slot = await createTestSlot("11:00", "11:30");

    process.env.TEST_TRANSACTION = "true";

    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Cookie", `token=${patientToken}`)
      .send({ appointmentId: slot._id.toString() });

    delete process.env.TEST_TRANSACTION;

    expect(res.status).toBe(500);

    const checkSlot = await Appointment.findById(slot._id);
    expect(checkSlot.status).toBe("AVAILABLE");
    expect(checkSlot.patient).toBeNull();
  });

  it("5. Failed transaction leaves no orphaned booking", async () => {
    const slot = await createTestSlot("11:30", "12:00");

    process.env.TEST_TRANSACTION = "true";

    await request(app)
      .post("/api/v1/bookings")
      .set("Cookie", `token=${patientToken}`)
      .send({ appointmentId: slot._id.toString() });

    delete process.env.TEST_TRANSACTION;

    const bookingRecord = await Booking.findOne({ appointment: slot._id });
    expect(bookingRecord).toBeNull();
  });

  it("6. Retrying after a rollback succeeds when the slot is available", async () => {
    const slot = await createTestSlot("12:00", "12:30");

    process.env.TEST_TRANSACTION = "true";

    const failedRes = await request(app)
      .post("/api/v1/bookings")
      .set("Cookie", `token=${patientToken}`)
      .send({ appointmentId: slot._id.toString() });

    delete process.env.TEST_TRANSACTION;
    expect(failedRes.status).toBe(500);

    const retryRes = await request(app)
      .post("/api/v1/bookings")
      .set("Cookie", `token=${patientToken}`)
      .send({ appointmentId: slot._id.toString() });

    expect(retryRes.status).toBe(201);
    expect(retryRes.body.success).toBe(true);

    const finalSlot = await Appointment.findById(slot._id);
    expect(finalSlot.status).toBe("BOOKED");
    expect(finalSlot.patient.toString()).toBe(patientId.toString());

    const finalBooking = await Booking.findOne({ appointment: slot._id });
    expect(finalBooking).not.toBeNull();
  });

  it("7. Concurrent requests attempting to book the same slot: at most one succeeds", async () => {
    const slot = await createTestSlot("13:00", "13:30");

    const [res1, res2] = await Promise.all([
      request(app)
        .post("/api/v1/bookings")
        .set("Cookie", `token=${patientToken}`)
        .send({ appointmentId: slot._id.toString() }),
      request(app)
        .post("/api/v1/bookings")
        .set("Cookie", `token=${otherPatientToken}`)
        .send({ appointmentId: slot._id.toString() }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const bookings = await Booking.find({ appointment: slot._id });
    expect(bookings.length).toBe(1);

    const finalSlot = await Appointment.findById(slot._id);
    expect(finalSlot.status).toBe("BOOKED");
    expect([patientId.toString(), otherPatientId.toString()]).toContain(
      finalSlot.patient.toString()
    );
  });

  it("8. Authorization: doctors cannot book, unauthenticated cannot book, patient cannot spoof identity", async () => {
    const slot = await createTestSlot("14:00", "14:30");

    const doctorRes = await request(app)
      .post("/api/v1/bookings")
      .set("Cookie", `token=${doctorToken}`)
      .send({ appointmentId: slot._id.toString() });

    expect(doctorRes.status).toBe(403);
    expect(doctorRes.body.message).toBe("Only patients can book appointments");

    const unauthRes = await request(app)
      .post("/api/v1/bookings")
      .send({ appointmentId: slot._id.toString() });

    expect(unauthRes.status).toBe(401);

    const spoofRes = await request(app)
      .post("/api/v1/bookings")
      .set("Cookie", `token=${patientToken}`)
      .send({
        appointmentId: slot._id.toString(),
        patientId: otherPatientId.toString(),
        patient: otherPatientId.toString(),
      });

    expect(spoofRes.status).toBe(201);

    const booking = await Booking.findOne({ appointment: slot._id });
    expect(booking.patient.toString()).toBe(patientId.toString());
  });

  it("9. Invalid slot IDs and malformed request bodies are rejected with 400", async () => {
    const missingRes = await request(app)
      .post("/api/v1/bookings")
      .set("Cookie", `token=${patientToken}`)
      .send({});

    expect(missingRes.status).toBe(400);
    expect(missingRes.body.success).toBe(false);

    const invalidHexRes = await request(app)
      .post("/api/v1/bookings")
      .set("Cookie", `token=${patientToken}`)
      .send({ appointmentId: "not-a-valid-hex-id!" });

    expect(invalidHexRes.status).toBe(400);
    expect(invalidHexRes.body.success).toBe(false);

    const wrongLengthRes = await request(app)
      .post("/api/v1/bookings")
      .set("Cookie", `token=${patientToken}`)
      .send({ appointmentId: "12345" });

    expect(wrongLengthRes.status).toBe(400);
    expect(wrongLengthRes.body.success).toBe(false);
  });

  it("10. Verified that all participating database writes use the exact same transaction session", async () => {
    const slot = await createTestSlot("15:00", "15:30");

    const findOneAndUpdateSpy = jest.spyOn(Appointment, "findOneAndUpdate");
    const bookingCreateSpy = jest.spyOn(Booking, "create");

    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Cookie", `token=${patientToken}`)
      .send({ appointmentId: slot._id.toString() });

    expect(res.status).toBe(201);
    expect(findOneAndUpdateSpy).toHaveBeenCalled();
    expect(bookingCreateSpy).toHaveBeenCalled();

    const slotCallOpts = findOneAndUpdateSpy.mock.calls[0][2];
    const bookingCallOpts = bookingCreateSpy.mock.calls[0][1];

    expect(slotCallOpts.session).toBeDefined();
    expect(bookingCallOpts.session).toBeDefined();
    expect(slotCallOpts.session).toBe(bookingCallOpts.session);
    expect(slotCallOpts.session.id).toEqual(bookingCallOpts.session.id);

    findOneAndUpdateSpy.mockRestore();
    bookingCreateSpy.mockRestore();
  });
});
