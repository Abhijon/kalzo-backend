import { env } from "./config/env";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.config";
import routes from "./routes";
import { errorHandler, notFound } from "./utils/errorHandler";

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()) }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", message: "Backend server is healthy" });
});

app.get("/docs.json", (_req, res) => {
  res.json(swaggerSpec);
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/v1", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
