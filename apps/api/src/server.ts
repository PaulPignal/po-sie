import { buildApp } from "./app";

const app = buildApp();

app.listen({
  port: app.appConfig.port,
  host: app.appConfig.host
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});

