import { createApp } from "./app";

const host = process.env.HOST?.trim() || "127.0.0.1";
const rawPort = process.env.PORT?.trim() || "3001";
const port = Number(rawPort);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(
    `PORT must be an integer from 1 to 65535; received ${JSON.stringify(rawPort)}`,
  );
}

createApp().listen({ hostname: host, port });
console.log(`Much Ado About One Side API listening on http://${host}:${port}`);
