const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

// Development runs the TypeScript sources; the production build runs compiled JS from dist/.
const isProduction = process.env.NODE_ENV === "production";
const backendRoot = path.resolve(__dirname, "..", "..");
const routesDir = path.join(backendRoot, isProduction ? "dist" : "src", "routes");
const routeFiles = isProduction ? "**/*.routes.js" : "**/*.routes.ts";

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Kalzo API",
      version: "1.0.0",
      description: "REST API for the Kalzo web and mobile apps. Auth is email OTP (static OTP while email delivery is pending).",
    },
    servers: [{ url: "/api/v1" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["CUSTOMER", "ARTIST", "ADMIN"] },
            isActive: { type: "boolean", description: "false until the signup OTP is verified" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                token: { type: "string" },
                user: { $ref: "#/components/schemas/User" },
              },
            },
          },
        },
        CustomerProfile: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            fullName: { type: "string" },
            location: { type: "string" },
            customerType: { type: "string" },
            reasonForBooking: { type: "string" },
            businessName: { type: "string", nullable: true },
            mobileNumber: { type: "string" },
          },
        },
        ArtistProfile: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            mobileNumber: { type: "string" },
          },
        },
        CustomerSignupRequest: {
          type: "object",
          required: ["email", "fullName", "location", "customerType", "reasonForBooking", "mobileNumber"],
          properties: {
            email: { type: "string", format: "email" },
            fullName: { type: "string" },
            location: { type: "string", description: "City" },
            customerType: { type: "string", description: '"You are" dropdown value, e.g. Individual / family' },
            reasonForBooking: { type: "string", description: "Reason for booking dropdown value" },
            businessName: { type: "string", maxLength: 120, description: "Optional; for business customers (hotel, corporate, café, etc.)" },
            mobileNumber: { type: "string", pattern: "^\\d{10}$", description: "10-digit mobile number without +91" },
          },
        },
        ArtistSignupRequest: {
          type: "object",
          required: ["email", "mobileNumber"],
          properties: {
            email: { type: "string", format: "email" },
            mobileNumber: { type: "string", pattern: "^\\d{10}$", description: "10-digit mobile number without +91" },
          },
        },
        MeResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                user: { $ref: "#/components/schemas/User" },
                profile: {
                  description: "CustomerProfile for customers, ArtistProfile for artists, null otherwise",
                  nullable: true,
                  oneOf: [
                    { $ref: "#/components/schemas/CustomerProfile" },
                    { $ref: "#/components/schemas/ArtistProfile" },
                  ],
                },
              },
            },
          },
        },
        CustomerSignupResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                message: { type: "string", example: "Account created. Verify the OTP to activate it." },
                user: { $ref: "#/components/schemas/User" },
                profile: { $ref: "#/components/schemas/CustomerProfile" },
              },
            },
          },
        },
        ArtistSignupResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                message: { type: "string", example: "Account created. Verify the OTP to activate it." },
                user: { $ref: "#/components/schemas/User" },
                profile: { $ref: "#/components/schemas/ArtistProfile" },
              },
            },
          },
        },
      },
    },
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Backend server status",
          servers: [{ url: "/" }],
          responses: {
            200: {
              description: "Server is running",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "ok" },
                      message: { type: "string", example: "Backend server is healthy" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  // swagger-jsdoc globs need forward slashes, including on Windows.
  apis: [path.join(routesDir, routeFiles).replace(/\\/g, "/")],
};

module.exports = swaggerJsdoc(options);
