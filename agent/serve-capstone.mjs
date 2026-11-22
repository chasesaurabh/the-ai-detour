import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
const [candidate, database, port] = process.argv.slice(2);
if (!candidate || !database || !port)
  throw Error("npm run capstone:serve -- <built-candidate> <database> <port>");
const child = spawn(
  process.execPath,
  [
    join(resolve(candidate), "dist/src/server.js"),
    "--db",
    database,
    "--port",
    port,
  ],
  { windowsHide: true, stdio: "inherit" },
);
child.on("exit", (code) => (process.exitCode = code ?? 1));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
