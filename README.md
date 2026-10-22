# SANAD Healthcare - Auditability Exercise

## Overview

This exercise implements a structured audit logging mechanism for medical-record access and updates.

The goal is to provide a traceable record of who accessed or modified a medical record, their relationship to the patient, whether patient consent was available, and the outcome of the operation.

---

## Objective

The objective of this exercise is to add structured audit events to medical-record operations while preserving important context such as:

- Actor who performed the operation
- Action performed
- Medical record involved
- Patient involved
- Relationship between actor and patient
- Consent status
- Operation outcome
- Timestamp

---

## Scope

The implementation is intentionally limited to the required auditability scenario.

### Included

- Medical record READ operations
- Medical record UPDATE operations
- Structured audit events
- Patient relationship context
- Consent context
- SUCCESS and DENIED outcomes
- Audit log retrieval endpoint
- Automated tests

### Not Included

- Full healthcare authorization system
- Advanced audit analytics
- Audit log deletion/history management
- Admin dashboard
- Production-grade audit storage architecture

---

# Project Structure

```text
src/
├── config/
│   └── database.js
│
├── middlewares/
│   └── auth.js
│
├── modules/
│   ├── appointment/
│   ├── auth/
│   ├── booking/
│   │
│   ├── medicalRecord/
│   │   ├── medicalRecord.model.js
│   │   ├── medicalRecord.controller.js
│   │   └── medicalRecord.routes.js
│   │
│   └── audit/
│       ├── audit.model.js
│       ├── audit.controller.js
│       └── audit.routes.js
│
├── tests/
│   └── audit.test.js
│
└── app.js

server.js
package.json
```

---

# Audit Event Schema

Each audit event contains structured information about the operation.

| Field          | Description                               |
| -------------- | ----------------------------------------- |
| `actor`        | User who performed the operation          |
| `action`       | Operation performed: `READ` or `UPDATE`   |
| `resource`     | Resource being accessed: `MEDICAL_RECORD` |
| `recordId`     | Medical record identifier                 |
| `patientId`    | Patient associated with the record        |
| `relationship` | Actor relationship to the patient         |
| `consent`      | Patient consent status                    |
| `outcome`      | Result of the operation                   |
| `timestamp`    | Time when the audit event was created     |

### Supported Actions

```text
READ
UPDATE
```

### Supported Resource

```text
MEDICAL_RECORD
```

### Supported Relationships

```text
SELF
DOCTOR
```

### Supported Outcomes

```text
SUCCESS
DENIED
FAILED
```

---

# Authorization Rules

## Medical Record Creation

Only a **DOCTOR** may create a medical record.

- The `patientId` must reference an existing user with role `PATIENT`.
- Request body is validated with Joi: `patientId` (required, 24-char hex ObjectId), `diagnosis` (required string), `notes` (optional string), `consentGiven` (optional boolean).
- A patient attempting to create a record receives `403 Forbidden`.
- Invalid input format receives `400 Bad Request` with a list of validation errors.
- A valid-format `patientId` that does not identify an existing patient receives `404 Not Found`.

## Medical Record Access

| Actor | Condition | Outcome |
|---|---|---|
| Patient (record owner) | Always | Allowed |
| Patient (not the owner) | Always | `403 Forbidden` |
| Doctor | `consentGiven = true` | Allowed |
| Doctor | `consentGiven = false` | `403 Forbidden` |

A non-owner patient is **never** treated as a doctor. The `relationship` field in the audit log will never be `DOCTOR` for a user whose role is `PATIENT`.

## Audit Log Access

Only a **DOCTOR** may retrieve audit logs via `GET /api/v1/audit-logs`.

- An unauthenticated request receives `401 Unauthorized`.
- A patient receives `403 Forbidden`.
- Personally Identifiable Information (PII) and Protected Health Information (PHI) minimization: The endpoint strictly omits patient identifiers (name, email) and clinical record contents (diagnosis, notes), returning only the audit event metadata, ObjectIds, and actor role.

---

# Access and Consent Logic

The implementation uses the following access rules.

## Patient

A patient can access and update only their own medical record.

The audit event records:

```text
relationship = SELF
```

The patient's consent value is still recorded as part of the audit context.

---

## Doctor

A doctor can access or update a patient's medical record only when:

```text
consentGiven = true
```

When consent is available:

```text
relationship = DOCTOR
consent = true
outcome = SUCCESS
```

Without consent:

```text
relationship = DOCTOR
consent = false
outcome = DENIED
```

---

# API Endpoints

## Medical Record

### Create Medical Record

```http
POST /api/v1/medical-records
```

Creates a medical record. Requires DOCTOR role.

Request body:

```json
{
  "patientId": "<ObjectId>",
  "diagnosis": "string (required)",
  "notes": "string (optional)",
  "consentGiven": false
}
```

---

### Read Medical Record

```http
GET /api/v1/medical-records/:id
```

The operation generates an audit event containing:

* Actor
* Relationship
* Consent
* Outcome

---

### Update Medical Record

```http
PATCH /api/v1/medical-records/:id
```

The operation generates an audit event containing:

* Actor
* Relationship
* Consent
* Outcome

---

# Audit Logs

### Get Audit Logs

```http
GET /api/v1/audit-logs
```

Returns the generated audit events.

Example:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "action": "READ",
      "resource": "MEDICAL_RECORD",
      "relationship": "DOCTOR",
      "consent": true,
      "outcome": "SUCCESS"
    }
  ]
}
```

---

# Example Audit Events

## Doctor Access With Consent

```json
{
  "action": "READ",
  "resource": "MEDICAL_RECORD",
  "relationship": "DOCTOR",
  "consent": true,
  "outcome": "SUCCESS"
}
```

---

## Doctor Access Without Consent

```json
{
  "action": "READ",
  "resource": "MEDICAL_RECORD",
  "relationship": "DOCTOR",
  "consent": false,
  "outcome": "DENIED"
}
```

---

## Doctor Update With Consent

```json
{
  "action": "UPDATE",
  "resource": "MEDICAL_RECORD",
  "relationship": "DOCTOR",
  "consent": true,
  "outcome": "SUCCESS"
}
```

---

## Doctor Update Without Consent

```json
{
  "action": "UPDATE",
  "resource": "MEDICAL_RECORD",
  "relationship": "DOCTOR",
  "consent": false,
  "outcome": "DENIED"
}
```

---

# Automated Testing

Automated tests were implemented using:

* Jest
* Supertest
* MongoDB Atlas (dedicated test database)
* Mongoose

The test file is:

```text
src/tests/audit.test.js
```

The test suite covers the following scenarios:

| Test | Expected Result |
|---|---|
| Patient reads own medical record | SUCCESS |
| Doctor reads without consent | DENIED |
| Doctor updates without consent | DENIED |
| Doctor reads with consent | SUCCESS |
| Doctor updates with consent | SUCCESS |
| Patient reads own record (regression) | 200 |
| Patient cannot read another patient's record (consent=true) | 403 |
| Patient cannot update another patient's record | 403 |
| Doctor without consent cannot read | 403 |
| Doctor without consent cannot update | 403 |
| Doctor with consent can read | 200 |
| Doctor with consent can update | 200 |
| Patient cannot create a medical record | 403 |
| Invalid create request format is rejected | 400 |
| Valid-format non-existent patient returns not found | 404 |
| Non-owner patient never logged as DOCTOR | audit integrity |
| Unauthenticated user cannot retrieve audit logs | 401 |
| Patient cannot retrieve audit logs | 403 |
| Doctor can retrieve audit logs | 200 |
| Audit logs minimize PII and PHI (no email/name/clinical data) | privacy verified |

---

# Test Database Configuration

Tests connect to a **dedicated test database** (`sanad_test`), completely separate from the application database.

The test suite will **fail immediately** if `TEST_MONGO_URI` is not set or if it is identical to `MONGO_URI`, preventing accidental writes or cleanups against the application database.

After each run, the test suite deletes only the records it created (targeted `deleteMany` by test email and patientId). It does not drop the database.

## Required Environment Variables for Testing

Create a `.env.test` file (never commit it — it is in `.gitignore`):

```text
MONGO_URI=mongodb://127.0.0.1:27017/sanad_test_placeholder
TEST_MONGO_URI=mongodb://127.0.0.1:27017/sanad_test
JWT_SECRET=<dedicated-test-secret-never-copy-from-prod>
JWT_EXPIRES_IN=1d
NODE_ENV=test
```

- `MONGO_URI` is set to a placeholder so the application never connects to the production database during tests.
- `TEST_MONGO_URI` must point to a dedicated test database (e.g. `sanad_test`), completely separate from the application database.
- `JWT_SECRET` must be a dedicated test secret. Never copy the production JWT secret into `.env.test`.

---

# Test Result

The automated test suite was executed successfully.

```text
PASS src/tests/booking.test.js
  Week 2 — Appointment Booking & Transaction Guarantees
    √ 0. Precondition: verifies test database is a genuine Replica Set supporting native transactions
    √ 1. Successful booking: returns 201, slot is BOOKED, booking record exists
    √ 2. Duplicate booking: second attempt on already booked slot returns 409
    √ 3. Unavailable slot: non-existent slot returns 409 and creates no booking
    √ 4. Forced failure after slot update: rolls back and slot remains AVAILABLE
    √ 5. Failed transaction leaves no orphaned booking
    √ 6. Retrying after a rollback succeeds when the slot is available
    √ 7. Concurrent requests attempting to book the same slot: at most one succeeds
    √ 8. Authorization: doctors cannot book, unauthenticated cannot book, patient cannot spoof identity
    √ 9. Invalid slot IDs and malformed request bodies are rejected with 400
    √ 10. Verified that all participating database writes use the exact same transaction session

PASS src/tests/audit.test.js
  Audit log creation on medical record access
    √ should log READ + SUCCESS when patient reads own record
    √ should log READ + DENIED when doctor reads record without consent
    √ should log UPDATE + DENIED when doctor updates record without consent
    √ should log READ + SUCCESS when doctor reads with consent
    √ should log UPDATE + SUCCESS when doctor updates with consent
  Medical record authorization — security regression
    √ 1. patient reads own record — 200
    √ 2. patient cannot read another patient's record even when consent is true — 403
    √ 3. patient cannot update another patient's record — 403
    √ 4. doctor without consent cannot read the record — 403
    √ 5. doctor without consent cannot update the record — 403
    √ 6. doctor with consent can read the record — 200
    √ 7. doctor with consent can update the record — 200
    √ 8. patient cannot create a medical record — 403
    √ 9. invalid request data is rejected on create — 400
    √ valid-format patient ID for non-existent patient returns 404 on create
    √ audit log: non-owner patient is never logged as DOCTOR
  Audit log endpoint authorization
    √ 10. unauthenticated user cannot retrieve audit logs — 401
    √ 11. patient cannot retrieve audit logs — 403
    √ 12. doctor can retrieve audit logs — 200
    √ 13. audit logs minimize PII and PHI (no patient email/name, no diagnosis/notes)

Test Suites: 2 passed, 2 total
Tests:       31 passed, 31 total
Snapshots:   0 total
```

All 31 tests across both booking (with genuine multi-document transactions) and medical record audit suites passed.

---

# Week 2 — Appointment Slot Booking & Transaction Guarantees

## Booking Workflow

Patients book available appointment slots through `POST /api/v1/bookings` with `{ "appointmentId": "<ObjectId>" }`.

### Guarantees
1. **Atomic State Transition**: Slots transition conditionally from `AVAILABLE` to `BOOKED` (`status: "AVAILABLE"` match).
2. **Double Booking Prevention**: Concurrent or repeated booking requests for the same slot receive `409 Conflict` (`Appointment is not available`).
3. **Transaction & Rollback**:
   - On replica-set/sharded deployments: Multi-document ACID transaction guarantees atomic slot update and booking creation.
   - On standalone deployments: Compensating rollback guarantees the slot is restored to `AVAILABLE` without orphaned records if downstream operations fail.
4. **Authorization & Identity Protection**:
   - Only users with role `PATIENT` can book. Doctors receive `403 Forbidden`.
   - The booking record strictly uses the authenticated user ID (`req.user.id`). Manipulation of request body patient IDs is ignored.
5. **Input Validation**: Request body is validated with Joi; malformed or non-hex 24-character IDs return `400 Bad Request`.

---

# Technologies

```text
Node.js
Express.js
MongoDB
Mongoose
JWT
Jest
Supertest
bcryptjs
Joi
```

---

# How to Run

## Install Dependencies

Using Yarn:

```bash
yarn install
```

---

## Run Development Server

```bash
yarn dev
```

---

## Run Tests

```bash
npm test
```

The test command runs Jest in-band against the dedicated `sanad_test` database on an isolated MongoDB Replica Set.

Before running tests, ensure `.env.test` exists with `TEST_MONGO_URI` set to a dedicated test database (e.g. `mongodb://127.0.0.1:27018/sanad_test?replicaSet=rs0&directConnection=true`). The suite will fail immediately if this variable is missing or identical to `MONGO_URI`.

The test suite includes a Jest `globalSetup` and `globalTeardown` hook (`src/tests/replicaSetManager.js`) that automatically initializes a local single-node Replica Set (`rs0`) on port 27018 with its own data directory (`.test-rs-data`) if not already running, and cleanly shuts it down after test completion.

---

# Auditability Flow

The implemented flow can be summarized as:

```text
Authenticated User
        |
        v
Medical Record Request
        |
        v
Identify Actor
        |
        v
Determine Relationship
        |
        v
Check Consent
        |
        +-------------------+
        |                   |
        v                   v
     Allowed             Denied
        |                   |
        v                   v
   Operation            403 Response
        |                   |
        +---------+---------+
                  |
                  v
           Create Audit Event
                  |
                  v
        Actor + Action + Record
        + Relationship + Consent
        + Outcome + Timestamp
```

---

# Evidence

The implementation was verified through automated end-to-end integration and security regression tests.

The automated test execution confirmed:

```text
Test Suites: 3 passed, 3 total
Tests:       43 passed, 43 total (0 failed, 0 blocked)
- src/tests/appointment.test.js: 12 passed (slot creation, validation, overlap conflict 409, doctor schedule, available slots)
- src/tests/booking.test.js:     11 passed (ACID transaction commit, rollback, retry, isolation, concurrency)
- src/tests/audit.test.js:       20 passed (access control, audit integrity, PII/PHI sanitization)
```

The audit events and transaction guarantees were verified against genuine MongoDB multi-document transactions.

---

# Week 6 — Mini Backend Service

The **SANAD Healthcare Mini Backend Service** provides a production-grade, modular REST API encompassing:

1. **Authentication & Identity (`auth`)**:
   - Role-based access control (`DOCTOR`, `PATIENT`).
   - Secure password hashing with bcryptjs (10 salt rounds).
   - JWT tokens signed with expiration and validated on every protected route.

2. **Appointment Scheduling & Slot Conflict Prevention (`appointment`)**:
   - Doctors create discrete appointment slots validated via Joi (`createAppointmentSchema`).
   - Algorithmic overlap and duplicate conflict detection (`startMinutes < existingEnd && endMinutes > existingStart`) returning `409 Conflict`.
   - Distinct views for doctor schedule (`/api/v1/appointments`, `/api/v1/appointments/booked`) and patient discovery (`/api/v1/appointments/available`).

3. **ACID Transactional Booking Engine (`booking`)**:
   - Multi-document transactions on MongoDB Replica Sets passing a single session across slot reservation and booking document creation.
   - Idempotency and double-booking prevention returning `409 Conflict`.
   - WiredTiger write conflict retry loop with exponential backoff.
   - Guaranteed rollback (slot remains `AVAILABLE`, zero orphaned bookings) upon mid-transaction failures.
   - Compensating rollback fallback for standalone MongoDB instances.

4. **Medical Record Access & Auditability (`medicalRecord` & `audit`)**:
   - Fine-grained authorization: Patient self-access, doctor consent-gated access (`consentGiven === true`).
   - Immutable audit logging for every access (`READ`) and mutation (`UPDATE`), recording `actor`, `action`, `resource`, `recordId`, `patientId`, `relationship`, `consent`, `outcome` (`SUCCESS` / `DENIED`), and `timestamp`.
   - Audit write failures prevent sensitive data leaks.
   - Audit trail endpoint restricted to authorized roles with PII/PHI sanitization.

5. **Automated Testing & Environment Isolation**:
   - 43 automated tests across 3 suites executed via Jest and Supertest.
   - Portable local MongoDB Replica Set manager (`replicaSetManager.js`) that auto-starts a single-node replica set (`rs0`) on port 27018 with its own data directory (`.test-rs-data`) and cleans up after test execution.

# Deployment & Live Demo

The backend is configured for serverless deployment on **Vercel** or containerized/Node.js PaaS platforms (e.g. Render, Railway, Fly.io) via [`vercel.json`](file:///d:/Darwish%20&%20Co/New%20folder/Sanad_healthcare/sanad%20Rabea/vercel.json) and [`api/index.js`](file:///d:/Darwish%20&%20Co/New%20folder/Sanad_healthcare/sanad%20Rabea/api/index.js).

### Option 1: Deploy to Vercel (Recommended)
1. Import the repository [`Dawrish-Co/sanad-Rabea`](https://github.com/Dawrish-Co/sanad-Rabea) into your Vercel Dashboard.
2. In Project Settings > Environment Variables, configure:
   - `MONGO_URI`: Your MongoDB Atlas Replica Set connection string (e.g. `mongodb+srv://...`).
   - `JWT_SECRET`: A secure production secret.
   - `JWT_EXPIRES_IN`: `1d`
   - `NODE_ENV`: `production`
3. Click **Deploy**. Vercel routes all incoming traffic to `api/index.js` via the root rewrites rule.

### Option 2: Live Demo Tunneling (Local Development Demonstration)
To expose a local running instance for a live demonstration:
1. Start the server connected to an active MongoDB instance:
   ```bash
   node server.js
   ```
2. In a separate terminal, expose the port via localtunnel or cloudflared:
   ```bash
   npx localtunnel --port 5000
   ```
3. Access the live endpoint at the generated URL: `https://<subdomain>.loca.lt/api/v1/health`.

---

# Delivery Checklist

| Week | Track & Topic | Required Deliverable | Status | Evidence Location |
| :--- | :--- | :--- | :---: | :--- |
| **Week 2** | **SANAD — Transaction Exercise** | Appointment-slot transaction simulation preventing double-booking; commit & rollback handling | **COMPLETE** | • [`src/modules/booking/booking.controller.js`](file:///d:/Darwish%20&%20Co/New%20folder/Sanad_healthcare/sanad%20Rabea/src/modules/booking/booking.controller.js)<br>• [`src/tests/booking.test.js`](file:///d:/Darwish%20&%20Co/New%20folder/Sanad_healthcare/sanad%20Rabea/src/tests/booking.test.js) (11 tests)<br>• Presentation: `doc/SANAD_Transaction_Exercise.pptx`<br>• Postman: `doc/sanad_transaction.postman_collection.json` |
| **Week 4** | **SANAD — Auditability Exercise** | Structured medical-record access/update audit events with patient relationship & consent context | **COMPLETE** | • [`src/modules/medicalRecord/`](file:///d:/Darwish%20&%20Co/New%20folder/Sanad_healthcare/sanad%20Rabea/src/modules/medicalRecord/) & [`src/modules/audit/`](file:///d:/Darwish%20&%20Co/New%20folder/Sanad_healthcare/sanad%20Rabea/src/modules/audit/)<br>• [`src/tests/audit.test.js`](file:///d:/Darwish%20&%20Co/New%20folder/Sanad_healthcare/sanad%20Rabea/src/tests/audit.test.js) (20 tests)<br>• Presentation: `doc/SANAD_Auditability_Exercise_Presentation.pptx` |
| **Week 6** | **SANAD — Mini Backend Service** | Standalone API for appointment scheduling & booking with auth, validation, audit, tests & docs | **COMPLETE** | • Repository: [`https://github.com/Dawrish-Co/sanad-Rabea`](https://github.com/Dawrish-Co/sanad-Rabea)<br>• Branch: `main`<br>• Automated test suite (43 passed tests across 3 suites)<br>• Deployment config: [`vercel.json`](file:///d:/Darwish%20&%20Co/New%20folder/Sanad_healthcare/sanad%20Rabea/vercel.json) & [`api/index.js`](file:///d:/Darwish%20&%20Co/New%20folder/Sanad_healthcare/sanad%20Rabea/api/index.js)<br>• Complete API reference & setup instructions |

---

# API Reference Summary

| Method | Endpoint | Auth Required | Allowed Roles | Description |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/v1/health` | No | Any | Service health check |
| `POST` | `/api/v1/auth/register` | No | Public | Register as `DOCTOR` or `PATIENT` |
| `POST` | `/api/v1/auth/login` | No | Public | Authenticate and receive JWT cookie |
| `POST` | `/api/v1/auth/logout` | No | Public | Clear session cookie |
| `POST` | `/api/v1/appointments` | Yes | `DOCTOR` | Create appointment slot (with overlap detection) |
| `GET` | `/api/v1/appointments` | Yes | `DOCTOR` | View all doctor's slots |
| `GET` | `/api/v1/appointments/booked` | Yes | `DOCTOR` | View doctor's booked appointments |
| `GET` | `/api/v1/appointments/available` | No / Yes | Any | Discover open `AVAILABLE` appointment slots |
| `POST` | `/api/v1/bookings` | Yes | `PATIENT` | Book appointment slot via ACID transaction |
| `POST` | `/api/v1/medical-records` | Yes | `DOCTOR` | Create medical record for a patient |
| `GET` | `/api/v1/medical-records/:id` | Yes | `SELF` or `DOCTOR` | View medical record (audited; consent required for doctor) |
| `PATCH` | `/api/v1/medical-records/:id` | Yes | `SELF` or `DOCTOR` | Update medical record (audited; consent required for doctor) |
| `GET` | `/api/v1/audit-logs` | Yes | `DOCTOR` | Query structured audit events (PII/PHI sanitized) |

---

# Conclusion

The SANAD Healthcare Backend Service satisfies all training objectives:
- **Week 1 Auditability & Security Hardening**: Strict medical-record access control, atomic audit logging after authorization, denial auditing, PII/PHI minimization, and role-based audit endpoint protection.
- **Week 2 Booking Transaction Guarantees**: Multi-document ACID transactions with genuine replica set verification, single-session binding across slot reservation and booking document creation, rollback guarantees with zero orphaned bookings on failure, transient write conflict retry handling, and unique appointment index constraints.
- **Week 6 Mini Backend Service**: Full end-to-end integration of authentication, appointment slot conflict management, transactional booking, medical record access control, structured auditing, and automated regression coverage (43 passed tests).
