const children = [
  Bun.spawn([process.execPath, "run", "--watch", "server/index.ts"], {
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, PORT: "3001", HOST: "127.0.0.1" },
  }),
  Bun.spawn([process.execPath, "--bun", "vite", "--host", "127.0.0.1"], {
    stdout: "inherit",
    stderr: "inherit",
  }),
];

let stopping = false;
function stop(code: number) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  void Promise.all(children.map((child) => child.exited)).then(() =>
    process.exit(code),
  );
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
void Promise.race(children.map((child) => child.exited)).then((code) =>
  stop(code || 1),
);
