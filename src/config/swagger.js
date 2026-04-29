import swaggerJSDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Tuk Tracking API",
      version: "1.0.0",
      description: "REST API for tuk tracking and movement logging"
    },
    // Use relative URL by default so Swagger "Try it out" works
    // both locally and on hosted environments.
    servers: [{ url: process.env.SWAGGER_SERVER_URL || "/api/v1" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    }
  },
  apis: ["./src/routes/*.js"]
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
