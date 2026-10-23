import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdirSync } from "node:fs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
mkdirSync(path.join(backend, "bin"), { recursive: true });
const executable = path.join(
  backend,
  "bin",
  process.platform === "win32" ? "server.exe" : "server",
);
const build = spawn("go", ["build", "-o", executable, "./cmd/server"], {
  cwd: backend,
  stdio: "inherit",
});
build.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
build.on("exit", (code) => {
  if (code !== 0) {
    process.exitCode = code || 1;
    return;
  }
  const children = [
    spawn(executable, ["-root", root], { cwd: root, stdio: "inherit" }),
    spawn(
      process.execPath,
      [
        path.join(root, "frontend/node_modules/vite/bin/vite.js"),
        ...(process.argv.includes("--preview") ? ["preview"] : []),
        "--host",
        "127.0.0.1",
        "--port",
        "3000",
        "--strictPort",
      ],
      { cwd: path.join(root, "frontend"), stdio: "inherit" },
    ),
  ];
  let stopping = false;
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill("SIGTERM");
    process.exitCode = code;
  }
  for (const child of children) {
    child.on("error", (e) => {
      console.error(e.message);
      stop(1);
    });
    child.on("exit", (code) => {
      if (!stopping) stop(code || 0);
    });
  }
  process.on("SIGINT", () => stop());
  process.on("SIGTERM", () => stop());
});
