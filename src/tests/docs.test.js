const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const openapiSpecification = require("../docs/openapi");

describe("Swagger / OpenAPI 3.0.3 Documentation", () => {
  describe("GET /api-docs.json (OpenAPI Specification)", () => {
    it("should serve the valid OpenAPI 3.0.3 specification JSON", async () => {
      const res = await request(app)
        .get("/api-docs.json")
        .expect("Content-Type", /json/)
        .expect(200);

      expect(res.body.openapi).toBe("3.0.3");
      expect(res.body.info).toBeDefined();
      expect(res.body.info.title).toBe("SANAD Healthcare API");
      expect(res.body.info.version).toBe("1.0.0");
      expect(res.body.servers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: "https://sanad-healthcare-backend.vercel.app",
          }),
        ])
      );
    });

    it("should document exactly all 14 verified endpoints", async () => {
      const res = await request(app).get("/api-docs.json").expect(200);
      const paths = res.body.paths;

      const expectedEndpoints = [
        { path: "/api/v1/health", method: "get" },
        { path: "/api/v1/auth/register", method: "post" },
        { path: "/api/v1/auth/login", method: "post" },
        { path: "/api/v1/auth/logout", method: "post" },
        { path: "/api/v1/auth/me", method: "get" },
        { path: "/api/v1/appointments", method: "post" },
        { path: "/api/v1/appointments", method: "get" },
        { path: "/api/v1/appointments/booked", method: "get" },
        { path: "/api/v1/appointments/available", method: "get" },
        { path: "/api/v1/bookings", method: "post" },
        { path: "/api/v1/medical-records", method: "post" },
        { path: "/api/v1/medical-records/{id}", method: "get" },
        { path: "/api/v1/medical-records/{id}", method: "patch" },
        { path: "/api/v1/audit-logs", method: "get" },
      ];

      let count = 0;
      for (const endpoint of expectedEndpoints) {
        expect(paths).toHaveProperty(endpoint.path);
        expect(paths[endpoint.path]).toHaveProperty(endpoint.method);
        const op = paths[endpoint.path][endpoint.method];
        expect(op.summary).toBeDefined();
        expect(op.responses).toBeDefined();
        count++;
      }

      expect(count).toBe(14);
    });

    it("should configure JWT Bearer and Cookie security schemes", async () => {
      const res = await request(app).get("/api-docs.json").expect(200);
      const securitySchemes = res.body.components.securitySchemes;

      expect(securitySchemes).toHaveProperty("bearerAuth");
      expect(securitySchemes.bearerAuth.type).toBe("http");
      expect(securitySchemes.bearerAuth.scheme).toBe("bearer");
      expect(securitySchemes.bearerAuth.bearerFormat).toBe("JWT");

      expect(securitySchemes).toHaveProperty("cookieAuth");
      expect(securitySchemes.cookieAuth.type).toBe("apiKey");
      expect(securitySchemes.cookieAuth.in).toBe("cookie");
      expect(securitySchemes.cookieAuth.name).toBe("token");
    });

    it("should have comprehensive schemas for all core resources", async () => {
      const res = await request(app).get("/api-docs.json").expect(200);
      const schemas = res.body.components.schemas;

      const requiredSchemas = [
        "User",
        "RegisterRequest",
        "LoginRequest",
        "AuthResponse",
        "Appointment",
        "CreateAppointmentRequest",
        "Booking",
        "CreateBookingRequest",
        "BookingSuccessResponse",
        "MedicalRecord",
        "CreateMedicalRecordRequest",
        "UpdateMedicalRecordRequest",
        "AuditLog",
        "ErrorResponse",
        "ValidationErrorResponse",
      ];

      for (const schemaName of requiredSchemas) {
        expect(schemas).toHaveProperty(schemaName);
      }
    });
  });

  describe("GET /api-docs and /api-docs/ (Interactive Swagger UI)", () => {
    it("should serve professional HTML for /api-docs", async () => {
      const res = await request(app)
        .get("/api-docs")
        .expect("Content-Type", /text\/html/)
        .expect(200);

      expect(res.text).toContain("SANAD Healthcare API");
      expect(res.text).toContain("swagger-ui");
      expect(res.text).toContain("SwaggerUIBundle");
      expect(res.text).toContain("/api-docs.json");
      expect(res.text).toContain("validatorUrl: null");
    });

    it("should serve HTML for /api-docs/", async () => {
      const res = await request(app)
        .get("/api-docs/")
        .expect("Content-Type", /text\/html/)
        .expect(200);

      expect(res.text).toContain("SANAD Healthcare API");
    });

    it("should redirect / to /api-docs", async () => {
      const res = await request(app).get("/").expect(302);
      expect(res.headers.location).toBe("/api-docs");
    });

    it("should redirect /docs to /api-docs", async () => {
      const res = await request(app).get("/docs").expect(301);
      expect(res.headers.location).toBe("/api-docs");
    });

    it("should redirect /docs.json to /api-docs.json", async () => {
      const res = await request(app).get("/docs.json").expect(301);
      expect(res.headers.location).toBe("/api-docs.json");
    });
  });

  describe("Authentication Bearer Token Integration", () => {
    const express = require("express");
    const { protect } = require("../middlewares/auth.middleware");
    const testApp = express();
    testApp.use(express.json());
    testApp.get("/test-protected", protect, (req, res) => {
      res.status(200).json({ success: true, user: req.user });
    });

    it("should authenticate requests using Authorization Bearer header", async () => {
      const testUserPayload = {
        id: "68f9a1b2c3d4e5f607182901",
        role: "PATIENT",
      };
      const token = jwt.sign(testUserPayload, process.env.JWT_SECRET || "test-jwt-secret-key-sanad", {
        expiresIn: "1h",
      });

      const res = await request(testApp)
        .get("/test-protected")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user.id).toBe("68f9a1b2c3d4e5f607182901");
      expect(res.body.user.role).toBe("PATIENT");
    });

    it("should reject invalid Bearer tokens with 401", async () => {
      const res = await request(testApp)
        .get("/test-protected")
        .set("Authorization", "Bearer invalid.token.value")
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid or expired token");
    });

    it("should reject requests missing authorization header or cookie with 401", async () => {
      const res = await request(testApp)
        .get("/test-protected")
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Authentication required");
    });
  });
});
