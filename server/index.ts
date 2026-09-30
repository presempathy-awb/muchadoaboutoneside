import { resolve } from "node:path";
import { createApp } from "./app";
import { loadWebModule } from "./modules";
import { FileWorksheetAccountStore } from "./worksheet-account";

const host = process.env.HOST?.trim() || "127.0.0.1";
const rawPort = process.env.PORT?.trim() || "3001";
const port = Number(rawPort);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(
    `PORT must be an integer from 1 to 65535; received ${JSON.stringify(rawPort)}`,
  );
}

const collabDir = process.env.COLLAB_DIR?.trim() || undefined;
// The Erebe crew board: a web module served for its own host, on only when
// its built directory is configured.
const erebeDir = process.env.EREBE_DIR?.trim() || undefined;
const modules = erebeDir
  ? [
      await loadWebModule({
        name: "erebe",
        host: process.env.EREBE_HOST?.trim() || "erebe.muchadoaboutoneside.com",
        dir: erebeDir,
      }),
    ]
  : [];
const stateDir = process.env.EREBE_STATE_DIR?.trim();
const accountDir =
  process.env.WORKSHEET_ACCOUNT_DIR?.trim() ||
  (stateDir ? resolve(stateDir, "worksheet-accounts") : undefined);
const app = createApp({
  collabDir,
  modules,
  worksheetAccounts: accountDir
    ? new FileWorksheetAccountStore(accountDir)
    : undefined,
}).listen({ hostname: host, port });
console.log(
  `Much Ado About One Side API listening on http://${host}:${port}${
    collabDir ? ` · live poem drafts in ${collabDir}` : ""
  }`,
);
if (collabDir) {
  // Write the drafts out before the process ends.
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      Promise.resolve(app.stop(true)).finally(() => process.exit(0));
    });
}
