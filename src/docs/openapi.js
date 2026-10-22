/**
 * SANAD Healthcare Platform - OpenAPI 3.0.3 Specification
 * Production URL: https://sanad-healthcare-backend.vercel.app
 */

const openapiSpecification = {
  openapi: "3.0.3",
  info: {
    title: "SANAD Healthcare API",
    version: "1.0.0",
    description: `## Overview
The **SANAD Healthcare API** provides a secure, role-based backend engine for outpatient healthcare operations.
It manages user authentication, doctor availability scheduling, patient appointment reservations with ACID transaction guarantees, confidential electronic medical records (EMR) with strict patient consent controls, and an immutable compliance audit trail.

---

### Authentication & Authorization
The API uses **JSON Web Tokens (JWT)** for stateless request authorization alongside **HTTP-only cookies** for browser security:
- **Obtaining a Token**: Call \`POST /api/v1/auth/login\` with valid credentials, or register via \`POST /api/v1/auth/register\`.
- **Using the Token in Swagger UI**: Click the **Authorize 🔓** button at the top right, enter your token in the \`bearerAuth\` field as \`eyJhbGciOi...\` (without the \`Bearer\` prefix), and click **Authorize**.
- **Supported User Roles**:
  - \`PATIENT\`: Can view available doctor schedules, reserve appointments, access their own medical records, and update permitted clinical profile data.
  - \`DOCTOR\`: Can create schedule availability slots, view booked and pending appointments, create patient medical records, access records with patient consent, and inspect compliance audit logs.

---

### Concurrency & Transaction Guarantees
- Appointment bookings (\`POST /api/v1/bookings\`) leverage **MongoDB Multi-Document ACID Transactions** on replica sets with automatic retry mechanisms for write conflicts, preventing double-booking race conditions under high concurrency.
- If transactions are unsupported in isolated standalone environments, compensating rollback mechanisms guarantee atomic data consistency.

---

### Security, Privacy & Compliance (HIPAA / GDPR Principles)
- **Zero Real PHI/PII**: All examples and schemas use purely fictional placeholder clinical data.
- **Audited Access**: Every read or update attempt on medical records is logged to an immutable audit ledger recording the actor role, relationship (\`SELF\` vs \`DOCTOR\`), patient consent state, and outcome (\`SUCCESS\` or \`DENIED\`).
- **Anonymized Audit Trail**: The audit log exposes only actor roles (\`DOCTOR\`), preventing actor PII leakage.
`,
    contact: {
      name: "SANAD Healthcare Engineering Team",
      url: "https://github.com/rabea-shaban/sanad-healthcare-backend",
    },
    license: {
      name: "ISC",
      url: "https://opensource.org/licenses/ISC",
    },
  },
  servers: [
    {
      url: "https://sanad-healthcare-backend.vercel.app",
      description: "Production Server (Vercel Serverless)",
    },
    {
      url: "http://localhost:5000",
      description: "Local Development Server",
    },
  ],
  tags: [
    {
      name: "System",
      description: "Platform health checks, service liveness, and diagnostics",
    },
    {
      name: "Authentication",
      description: "User registration, credential login, session termination, and profile identity",
    },
    {
      name: "Appointments",
      description: "Doctor schedule slots creation, slot retrieval, and patient availability searches",
    },
    {
      name: "Bookings",
      description: "Atomic patient appointment reservations backed by ACID transactions",
    },
    {
      name: "Medical Records",
      description: "Patient clinical electronic records with patient consent and ownership verification",
    },
    {
      name: "Audit Logs",
      description: "Immutable compliance and security audit trail for electronic medical records",
    },
  ],
  paths: {
    "/api/v1/health": {
      get: {
        tags: ["System"],
        summary: "Check API service health",
        description: "Returns the runtime operational status of the SANAD Healthcare API service. Used for automated uptime monitors, container readiness checks, and load balancer probes.",
        operationId: "getHealth",
        responses: {
          200: {
            description: "Service is online and functioning normally",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    message: {
                      type: "string",
                      example: "SANAD API is running",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/register": {
      post: {
        tags: ["Authentication"],
        summary: "Register a new user account",
        description: "Creates a new user profile with either `PATIENT` or `DOCTOR` role. Sets an HTTP-only authentication cookie (`token`) and returns the created user record.",
        operationId: "registerUser",
        requestBody: {
          required: true,
          description: "User registration payload containing full name, unique email, password, and system role.",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/RegisterRequest",
              },
            },
          },
        },
        responses: {
          201: {
            description: "User registered successfully",
            headers: {
              "Set-Cookie": {
                schema: {
                  type: "string",
                  example: "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Path=/; HttpOnly; SameSite=Lax",
                },
                description: "HTTP-only session cookie containing signed JWT token",
              },
            },
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AuthResponse",
                },
              },
            },
          },
          400: {
            description: "Input validation error (e.g. invalid email format, short password, unsupported role)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ValidationErrorResponse",
                },
              },
            },
          },
          409: {
            description: "Conflict: Email address is already registered",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "Email already registered",
                },
              },
            },
          },
          500: {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Authenticate user and issue JWT",
        description: "Verifies user credentials (email and password). Issues a signed JSON Web Token (JWT) in an HTTP-only cookie and returns user profile details.",
        operationId: "loginUser",
        requestBody: {
          required: true,
          description: "Registered email address and plaintext password.",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LoginRequest",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Authentication successful",
            headers: {
              "Set-Cookie": {
                schema: {
                  type: "string",
                  example: "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Path=/; HttpOnly; SameSite=Lax",
                },
                description: "HTTP-only session cookie containing signed JWT token",
              },
            },
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AuthResponse",
                },
              },
            },
          },
          400: {
            description: "Validation failure (missing required fields or malformed email)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ValidationErrorResponse",
                },
              },
            },
          },
          401: {
            description: "Invalid email or password",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "Invalid email or password",
                },
              },
            },
          },
          500: {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Authentication"],
        summary: "Terminate authenticated session",
        description: "Clears the HTTP-only session cookie (`token`) from the client browser.",
        operationId: "logoutUser",
        responses: {
          200: {
            description: "Session terminated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    message: {
                      type: "string",
                      example: "Logout successful",
                    },
                  },
                },
              },
            },
          },
          500: {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/me": {
      get: {
        tags: ["Authentication"],
        summary: "Get current authenticated user profile",
        description: "Retrieves profile details for the currently authenticated user based on the active JWT Bearer token or session cookie. Excludes password hash.",
        operationId: "getCurrentUser",
        security: [
          { bearerAuth: [] },
          { cookieAuth: [] },
        ],
        responses: {
          200: {
            description: "Profile retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    data: {
                      type: "object",
                      properties: {
                        user: {
                          $ref: "#/components/schemas/User",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized: Missing, invalid, or expired authentication token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "Not authorized to access this route",
                },
              },
            },
          },
          404: {
            description: "User record not found in database",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "User not found",
                },
              },
            },
          },
          500: {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/appointments": {
      post: {
        tags: ["Appointments"],
        summary: "Create doctor appointment availability slot",
        description: "Creates an availability window for patient booking. Requires `DOCTOR` role. Start time must precede end time, and slots cannot overlap with existing slots on the same calendar day for the authenticated doctor.",
        operationId: "createAppointmentSlot",
        security: [
          { bearerAuth: [] },
          { cookieAuth: [] },
        ],
        requestBody: {
          required: true,
          description: "Appointment slot schedule details (date and 24-hour time range).",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateAppointmentRequest",
              },
            },
          },
        },
        responses: {
          201: {
            description: "Appointment slot created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    message: {
                      type: "string",
                      example: "Appointment slot created successfully",
                    },
                    data: {
                      type: "object",
                      properties: {
                        appointment: {
                          $ref: "#/components/schemas/Appointment",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Validation failure or end time is not after start time",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "End time must be after start time",
                },
              },
            },
          },
          401: {
            description: "Unauthorized: Missing or invalid token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          403: {
            description: "Forbidden: Caller is not a registered doctor",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "Only doctors can create appointment slots",
                },
              },
            },
          },
          409: {
            description: "Conflict: Slot overlaps with an existing appointment for this doctor on the same day",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "Appointment slot overlaps with an existing slot",
                },
              },
            },
          },
          500: {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
      get: {
        tags: ["Appointments"],
        summary: "Get all appointment slots for authenticated doctor",
        description: "Retrieves all appointment slots created by the authenticated doctor, sorted chronologically by date and start time. Includes populated patient summary data when booked. Requires `DOCTOR` role.",
        operationId: "getDoctorAppointments",
        security: [
          { bearerAuth: [] },
          { cookieAuth: [] },
        ],
        responses: {
          200: {
            description: "Appointments fetched successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    message: {
                      type: "string",
                      example: "Appointments fetched successfully",
                    },
                    data: {
                      type: "object",
                      properties: {
                        appointments: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/Appointment",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          403: {
            description: "Forbidden: Only doctors can view their appointment slots",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "Only doctors can view their appointments",
                },
              },
            },
          },
          500: {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/appointments/booked": {
      get: {
        tags: ["Appointments"],
        summary: "Get booked appointment slots for authenticated doctor",
        description: "Retrieves only appointments with status `BOOKED` for the calling doctor, populated with patient details (`name`, `email`, `role`). Requires `DOCTOR` role.",
        operationId: "getDoctorBookedAppointments",
        security: [
          { bearerAuth: [] },
          { cookieAuth: [] },
        ],
        responses: {
          200: {
            description: "Booked appointments fetched successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    message: {
                      type: "string",
                      example: "Booked appointments fetched successfully",
                    },
                    data: {
                      type: "object",
                      properties: {
                        appointments: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/Appointment",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          403: {
            description: "Forbidden: Doctor role required",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "Only doctors can view booked appointments",
                },
              },
            },
          },
          500: {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/appointments/available": {
      get: {
        tags: ["Appointments"],
        summary: "List all available appointment slots across doctors",
        description: "Retrieves all unreserved appointment slots with `status: \"AVAILABLE\"` across all active doctors, sorted chronologically. Populated with doctor details (`name`, `email`). Accessible by authenticated patients and doctors.",
        operationId: "getAvailableAppointments",
        security: [
          { bearerAuth: [] },
          { cookieAuth: [] },
        ],
        responses: {
          200: {
            description: "Available appointments fetched successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    message: {
                      type: "string",
                      example: "Available appointments fetched successfully",
                    },
                    data: {
                      type: "object",
                      properties: {
                        appointments: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/Appointment",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized: Missing authentication token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          500: {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/bookings": {
      post: {
        tags: ["Bookings"],
        summary: "Book an available appointment slot (ACID Transaction)",
        description: `Atomically reserves an appointment slot for the authenticated patient using **MongoDB Multi-Document ACID Transactions**.
- Guarantees strict isolation and prevents double-booking race conditions.
- Automatically handles transient write conflicts with exponential backoff retries.
- Requires \`PATIENT\` role.
- If the appointment is already booked or not found, returns HTTP \`409 Conflict\`.`,
        operationId: "createBooking",
        security: [
          { bearerAuth: [] },
          { cookieAuth: [] },
        ],
        requestBody: {
          required: true,
          description: "24-character hexadecimal MongoDB ObjectId of the appointment to book.",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateBookingRequest",
              },
            },
          },
        },
        responses: {
          201: {
            description: "Appointment successfully booked within an atomic transaction",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/BookingSuccessResponse",
                },
              },
            },
          },
          400: {
            description: "Validation error: Appointment ID missing or malformed (must be 24-character hex string)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ValidationErrorResponse",
                },
              },
            },
          },
          401: {
            description: "Unauthorized: Authentication token missing or invalid",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          403: {
            description: "Forbidden: Caller is not a patient",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "Only patients can book appointments",
                },
              },
            },
          },
          409: {
            description: "Conflict: Appointment is not available (already booked or nonexistent)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "Appointment is not available",
                },
              },
            },
          },
          500: {
            description: "Internal server error during transaction processing",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/medical-records": {
      post: {
        tags: ["Medical Records"],
        summary: "Create a patient medical record",
        description: "Creates an electronic clinical record for a patient. Requires `DOCTOR` role. `patientId` must reference a valid user with role `PATIENT`. `consentGiven` sets initial access authorization for subsequent queries.",
        operationId: "createMedicalRecord",
        security: [
          { bearerAuth: [] },
          { cookieAuth: [] },
        ],
        requestBody: {
          required: true,
          description: "Clinical details including patient ID, diagnosis, optional clinical notes, and consent flag.",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateMedicalRecordRequest",
              },
            },
          },
        },
        responses: {
          201: {
            description: "Medical record created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    message: {
                      type: "string",
                      example: "Medical record created successfully",
                    },
                    data: {
                      $ref: "#/components/schemas/MedicalRecord",
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Validation error in diagnosis or patientId",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ValidationErrorResponse",
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          403: {
            description: "Forbidden: Doctor role required",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          404: {
            description: "Patient user not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "Patient not found",
                },
              },
            },
          },
          500: {
            description: "Failed to create medical record",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/medical-records/{id}": {
      get: {
        tags: ["Medical Records"],
        summary: "Retrieve medical record by ID (Audited)",
        description: `Retrieves a specific medical record. Strict healthcare access control is enforced:
- **Record Owner (\`PATIENT\`)**: Allowed access (\`relationship: "SELF"\`).
- **Doctor (\`DOCTOR\`)**: Allowed access **only if** \`consentGiven: true\` on the record.
- **Audit Logging**: Every access attempt (whether granted or denied) creates an immutable record in the compliance audit trail.`,
        operationId: "getMedicalRecordById",
        security: [
          { bearerAuth: [] },
          { cookieAuth: [] },
        ],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "24-character hexadecimal MongoDB ObjectId of the medical record",
            schema: {
              type: "string",
              pattern: "^[0-9a-fA-F]{24}$",
              example: "68f9a1b2c3d4e5f60718293a",
            },
          },
        ],
        responses: {
          200: {
            description: "Medical record retrieved successfully (Audited as SUCCESS)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    data: {
                      $ref: "#/components/schemas/MedicalRecord",
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          403: {
            description: "Forbidden: Access denied (Audited as DENIED when doctor lacks patient consent or patient is not the record owner)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "Access denied",
                },
              },
            },
          },
          404: {
            description: "Medical record not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "Medical record not found",
                },
              },
            },
          },
          500: {
            description: "Failed to access medical record",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Medical Records"],
        summary: "Update medical record diagnosis or notes (Audited)",
        description: `Updates clinical information (\`diagnosis\` and/or \`notes\`) on an existing medical record.
- **Authorization**: Allowed for the record owner (\`PATIENT\`) or a \`DOCTOR\` with verified patient consent (\`consentGiven: true\`).
- **Audit Logging**: Success and denied outcomes are persistently audited in the audit ledger.`,
        operationId: "updateMedicalRecordById",
        security: [
          { bearerAuth: [] },
          { cookieAuth: [] },
        ],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "24-character hexadecimal MongoDB ObjectId of the medical record",
            schema: {
              type: "string",
              pattern: "^[0-9a-fA-F]{24}$",
              example: "68f9a1b2c3d4e5f60718293a",
            },
          },
        ],
        requestBody: {
          required: true,
          description: "Updated diagnosis or clinical notes.",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UpdateMedicalRecordRequest",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Medical record updated successfully (Audited as SUCCESS)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    message: {
                      type: "string",
                      example: "Medical record updated successfully",
                    },
                    data: {
                      $ref: "#/components/schemas/MedicalRecord",
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          403: {
            description: "Access denied: Patient is not record owner or doctor lacks consent (Audited as DENIED)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "Access denied",
                },
              },
            },
          },
          404: {
            description: "Medical record not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "Medical record not found",
                },
              },
            },
          },
          500: {
            description: "Failed to update medical record",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/audit-logs": {
      get: {
        tags: ["Audit Logs"],
        summary: "Retrieve immutable compliance audit logs",
        description: "Retrieves a chronologically sorted audit trail of access events on medical records (read and update actions, whether successful or denied). Populates actor details with system role only to prevent exposing actor PII. Requires `DOCTOR` role.",
        operationId: "getAuditLogs",
        security: [
          { bearerAuth: [] },
          { cookieAuth: [] },
        ],
        responses: {
          200: {
            description: "Audit logs retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    count: {
                      type: "integer",
                      example: 1,
                    },
                    data: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/AuditLog",
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized: Missing authentication token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          403: {
            description: "Forbidden: Caller is not a doctor",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
                example: {
                  success: false,
                  message: "Forbidden: insufficient permissions",
                },
              },
            },
          },
          500: {
            description: "Failed to retrieve audit logs",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Standard HTTP Bearer JWT authentication header. Provide token obtained from `POST /api/v1/auth/login` or `POST /api/v1/auth/register`.",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "token",
        description: "HTTP-only session cookie set automatically upon successful login or registration.",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          _id: {
            type: "string",
            example: "68f9a1b2c3d4e5f607182901",
          },
          name: {
            type: "string",
            example: "Layla Al-Mansoor",
          },
          email: {
            type: "string",
            format: "email",
            example: "layla.patient@example.com",
          },
          role: {
            type: "string",
            enum: ["PATIENT", "DOCTOR"],
            example: "PATIENT",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2026-10-20T08:30:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2026-10-20T08:30:00.000Z",
          },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["name", "email", "password", "role"],
        properties: {
          name: {
            type: "string",
            minLength: 2,
            maxLength: 50,
            example: "Layla Al-Mansoor",
          },
          email: {
            type: "string",
            format: "email",
            example: "layla.patient@example.com",
          },
          password: {
            type: "string",
            format: "password",
            minLength: 6,
            maxLength: 100,
            example: "SecureP@ssw0rd2026",
          },
          role: {
            type: "string",
            enum: ["PATIENT", "DOCTOR"],
            example: "PATIENT",
          },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "layla.patient@example.com",
          },
          password: {
            type: "string",
            format: "password",
            example: "SecureP@ssw0rd2026",
          },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          message: {
            type: "string",
            example: "Login successful",
          },
          data: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    example: "68f9a1b2c3d4e5f607182901",
                  },
                  name: {
                    type: "string",
                    example: "Layla Al-Mansoor",
                  },
                  email: {
                    type: "string",
                    example: "layla.patient@example.com",
                  },
                  role: {
                    type: "string",
                    enum: ["PATIENT", "DOCTOR"],
                    example: "PATIENT",
                  },
                },
              },
            },
          },
        },
      },
      Appointment: {
        type: "object",
        properties: {
          _id: {
            type: "string",
            example: "68f9a1b2c3d4e5f607182910",
          },
          doctor: {
            oneOf: [
              {
                type: "string",
                example: "68f9a1b2c3d4e5f607182902",
              },
              {
                type: "object",
                properties: {
                  _id: { type: "string", example: "68f9a1b2c3d4e5f607182902" },
                  name: { type: "string", example: "Dr. Tariq Al-Hashimi" },
                  email: { type: "string", example: "tariq.doctor@example.com" },
                },
              },
            ],
          },
          date: {
            type: "string",
            format: "date-time",
            example: "2026-11-15T00:00:00.000Z",
          },
          startTime: {
            type: "string",
            pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
            example: "09:00",
          },
          endTime: {
            type: "string",
            pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
            example: "09:30",
          },
          patient: {
            nullable: true,
            oneOf: [
              {
                type: "string",
                example: "68f9a1b2c3d4e5f607182901",
              },
              {
                type: "object",
                properties: {
                  _id: { type: "string", example: "68f9a1b2c3d4e5f607182901" },
                  name: { type: "string", example: "Layla Al-Mansoor" },
                  email: { type: "string", example: "layla.patient@example.com" },
                  role: { type: "string", example: "PATIENT" },
                },
              },
            ],
          },
          status: {
            type: "string",
            enum: ["AVAILABLE", "BOOKED"],
            example: "AVAILABLE",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2026-10-21T09:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2026-10-21T09:00:00.000Z",
          },
        },
      },
      CreateAppointmentRequest: {
        type: "object",
        required: ["date", "startTime", "endTime"],
        properties: {
          date: {
            type: "string",
            format: "date",
            example: "2026-11-15",
            description: "Date of the appointment slot",
          },
          startTime: {
            type: "string",
            pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
            example: "09:00",
            description: "Slot start time in 24-hour HH:MM format",
          },
          endTime: {
            type: "string",
            pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
            example: "09:30",
            description: "Slot end time in 24-hour HH:MM format (must be strictly after startTime)",
          },
        },
      },
      Booking: {
        type: "object",
        properties: {
          _id: {
            type: "string",
            example: "68f9a1b2c3d4e5f607182920",
          },
          appointment: {
            type: "string",
            example: "68f9a1b2c3d4e5f607182910",
          },
          patient: {
            type: "string",
            example: "68f9a1b2c3d4e5f607182901",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2026-10-22T10:15:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2026-10-22T10:15:00.000Z",
          },
        },
      },
      CreateBookingRequest: {
        type: "object",
        required: ["appointmentId"],
        properties: {
          appointmentId: {
            type: "string",
            pattern: "^[0-9a-fA-F]{24}$",
            example: "68f9a1b2c3d4e5f607182910",
            description: "24-character hexadecimal MongoDB ObjectId of the available appointment slot",
          },
        },
      },
      BookingSuccessResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          message: {
            type: "string",
            example: "Appointment booked successfully",
          },
          data: {
            type: "object",
            properties: {
              booking: {
                $ref: "#/components/schemas/Booking",
              },
              appointment: {
                $ref: "#/components/schemas/Appointment",
              },
            },
          },
        },
      },
      MedicalRecord: {
        type: "object",
        properties: {
          _id: {
            type: "string",
            example: "68f9a1b2c3d4e5f60718293a",
          },
          patient: {
            type: "string",
            example: "68f9a1b2c3d4e5f607182901",
          },
          diagnosis: {
            type: "string",
            example: "Mild Seasonal Allergic Rhinitis",
          },
          notes: {
            type: "string",
            example: "Prescribed non-drowsy antihistamine 10mg daily for 14 days. Advised follow-up if symptoms persist.",
          },
          consentGiven: {
            type: "boolean",
            example: true,
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2026-10-21T11:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2026-10-21T11:00:00.000Z",
          },
        },
      },
      CreateMedicalRecordRequest: {
        type: "object",
        required: ["patientId", "diagnosis"],
        properties: {
          patientId: {
            type: "string",
            pattern: "^[0-9a-fA-F]{24}$",
            example: "68f9a1b2c3d4e5f607182901",
            description: "24-character hex MongoDB ObjectId of the registered patient",
          },
          diagnosis: {
            type: "string",
            minLength: 1,
            maxLength: 500,
            example: "Mild Seasonal Allergic Rhinitis",
          },
          notes: {
            type: "string",
            maxLength: 1000,
            example: "Prescribed non-drowsy antihistamine 10mg daily for 14 days.",
          },
          consentGiven: {
            type: "boolean",
            default: false,
            example: true,
            description: "Explicit patient consent allowing attending doctors to view and update this record",
          },
        },
      },
      UpdateMedicalRecordRequest: {
        type: "object",
        properties: {
          diagnosis: {
            type: "string",
            example: "Resolved Seasonal Allergic Rhinitis",
          },
          notes: {
            type: "string",
            example: "Patient reports complete symptom resolution. Treatment successfully concluded.",
          },
        },
      },
      AuditLog: {
        type: "object",
        properties: {
          _id: {
            type: "string",
            example: "68f9a1b2c3d4e5f60718294b",
          },
          actor: {
            type: "object",
            properties: {
              _id: {
                type: "string",
                example: "68f9a1b2c3d4e5f607182902",
              },
              role: {
                type: "string",
                enum: ["PATIENT", "DOCTOR"],
                example: "DOCTOR",
              },
            },
          },
          action: {
            type: "string",
            enum: ["READ", "UPDATE"],
            example: "READ",
          },
          resource: {
            type: "string",
            enum: ["MEDICAL_RECORD"],
            example: "MEDICAL_RECORD",
          },
          recordId: {
            type: "string",
            example: "68f9a1b2c3d4e5f60718293a",
          },
          patientId: {
            type: "string",
            example: "68f9a1b2c3d4e5f607182901",
          },
          relationship: {
            type: "string",
            enum: ["SELF", "DOCTOR"],
            example: "DOCTOR",
          },
          consent: {
            type: "boolean",
            example: true,
          },
          outcome: {
            type: "string",
            enum: ["SUCCESS", "DENIED", "FAILED"],
            example: "SUCCESS",
          },
          timestamp: {
            type: "string",
            format: "date-time",
            example: "2026-10-22T14:30:00.000Z",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2026-10-22T14:30:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2026-10-22T14:30:00.000Z",
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: false,
          },
          message: {
            type: "string",
            example: "Internal server error",
          },
        },
      },
      ValidationErrorResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: false,
          },
          message: {
            type: "string",
            example: "Validation failed",
          },
          errors: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["\"email\" must be a valid email", "\"password\" length must be at least 6 characters long"],
          },
        },
      },
    },
  },
};

module.exports = openapiSpecification;
