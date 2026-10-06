# SANAD Transaction Exercise

## Project Overview

A Node.js REST API for managing doctor appointment bookings with a core focus on **preventing double booking** using MongoDB transactions and atomic updates.

---

## Features

- Role-based auth: **Doctor** and **Patient**
- Doctor creates available appointment slots
- Prevents **duplicate slots** (same doctor, same time)
- Prevents **overlapping slots**
- Patient books available appointments
- **Atomic booking** — slot status update and booking record created in one transaction
- **MongoDB Transaction** with full **rollback** on failure

---

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- JWT (authentication)
- Joi (validation)
- Postman (testing)

---

## Project Structure

```
src/
├── config/         # Database connection
├── middlewares/    # JWT auth middleware
└── modules/
    ├── auth/       # Register, Login, Logout
    ├── appointment/ # Doctor creates & manages slots
    └── booking/    # Patient books appointments (transaction logic here)
```

---

## Setup & Installation

```bash
yarn install
```

---

## Environment Variables

```env
PORT=8000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_secret
JWT_EXPIRES_IN=1d
TEST_TRANSACTION=false
```

> Set `TEST_TRANSACTION=true` to simulate a forced rollback for testing purposes.

---

## Run Project

```bash
yarn dev
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Register as Doctor or Patient |
| POST | `/api/auth/login` | ❌ | Login and receive JWT |
| POST | `/api/appointments` | ✅ Doctor | Create available slot |
| GET | `/api/appointments/available` | ✅ | Get available slots |
| POST | `/api/bookings` | ✅ Patient | Book an appointment |

---

## Transaction Logic

**Happy Path:**
```
Check slot status = AVAILABLE
        ↓
Atomic update → status = BOOKED
        ↓
Create Booking record
        ↓
Commit Transaction
```

**On any error:**
```
Abort Transaction
        ↓
Rollback (slot stays AVAILABLE, no booking created)
```

---

## Testing

Test cases covered:

| Test Case | Expected Result |
|-----------|----------------|
| Successful Booking | 201 — booking created, slot marked BOOKED |
| Double Booking (same slot) | 409 — "Appointment is not available" |
| Duplicate Slot (same doctor/time) | 400 — validation error |
| Overlapping Slot | 400 — validation error |
| Transaction Rollback (`TEST_TRANSACTION=true`) | 500 — slot stays AVAILABLE, no booking saved |

---

## Testing Evidence

Postman collection available at:
```
doc/sanad_transaction.postman_collection.json
```

Import it into Postman to run all test cases directly.

---

## Final Result

> The system prevents duplicate and overlapping appointment slots and prevents double booking using atomic updates and MongoDB transactions.
