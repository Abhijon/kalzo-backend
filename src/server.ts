import { env } from "./config/env";
import app from "./app";

app.listen(env.PORT, () => {
  const baseUrl = `http://localhost:${env.PORT}`;
  console.log(`Kalzo API running on ${baseUrl} (${env.NODE_ENV})`);
  console.log(`API:     ${baseUrl}/api/v1`);
  console.log(`Health:  ${baseUrl}/health`);
  console.log(`Docs:    ${baseUrl}/docs`);
});
