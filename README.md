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

# Access and Consent Logic

The implementation uses the following access rules.

## Patient

A patient can access and update their own medical record.

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

Creates a medical record.

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
* MongoDB
* Mongoose

The test file is:

```text
src/tests/audit.test.js
```

The test suite covers the following scenarios:

| Test                             | Expected Result |
| -------------------------------- | --------------- |
| Patient reads own medical record | SUCCESS         |
| Doctor reads without consent     | DENIED          |
| Doctor updates without consent   | DENIED          |
| Doctor reads with consent        | SUCCESS         |
| Doctor updates with consent      | SUCCESS         |

Additional authentication testing is included for the audit-log endpoint.

---

# Test Result

The automated test suite was executed successfully.

```text
PASS  src/tests/audit.test.js

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Snapshots:   0 total
```

All auditability scenarios passed successfully.

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
yarn test
```

The test command runs Jest in-band and executes the auditability test suite.

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

The implementation was manually verified through API testing and automated tests.

The final automated test execution confirmed:

```text
5 tests passed
1 test suite passed
```

The audit events were also verified through the audit-log endpoint.

---

# Conclusion

This exercise implements a focused auditability mechanism for medical-record access and updates.

Each operation captures the relevant context needed to understand:

* Who performed the operation
* What operation was performed
* Which medical record was affected
* Which patient was involved
* The actor's relationship to the patient
* Whether consent was available
* Whether the operation succeeded or was denied
* When the event occurred

The implementation remains intentionally limited in scope while providing traceable and structured audit evidence.
