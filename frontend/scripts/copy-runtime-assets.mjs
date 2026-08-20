import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtime = {
  components: "3.4.8",
  componentsFront: "3.4.4",
  fragments: "3.4.7",
  three: "0.184.0",
  webIfc: "0.0.77",
};

async function packageVersion(name) {
  const manifest = JSON.parse(
    await readFile(
      resolve(packageRoot, "node_modules", ...name.split("/"), "package.json"),
      "utf8",
    ),
  );
  return manifest.version;
}

const installed = {
  components: await packageVersion("@thatopen/components"),
  componentsFront: await packageVersion("@thatopen/components-front"),
  fragments: await packageVersion("@thatopen/fragments"),
  three: await packageVersion("three"),
  webIfc: await packageVersion("web-ifc"),
};

for (const [name, expected] of Object.entries(runtime)) {
  if (installed[name] !== expected) {
    throw new Error(
      `${name} runtime mismatch: expected ${expected}, found ${installed[name]}`,
    );
  }
}

const workersDirectory = resolve(packageRoot, "public", "workers");
const wasmDirectory = resolve(packageRoot, "public", "wasm");
const runtimeDirectory = resolve(packageRoot, "public", "runtime");
await Promise.all([
  mkdir(workersDirectory, { recursive: true }),
  mkdir(wasmDirectory, { recursive: true }),
  mkdir(runtimeDirectory, { recursive: true }),
]);
await Promise.all([
  copyFile(
    resolve(
      packageRoot,
      "node_modules",
      "@thatopen",
      "fragments",
      "dist",
      "Worker",
      "worker.mjs",
    ),
    resolve(workersDirectory, "fragments-worker.mjs"),
  ),
  copyFile(
    resolve(packageRoot, "node_modules", "web-ifc", "web-ifc.wasm"),
    resolve(wasmDirectory, "web-ifc.wasm"),
  ),
  writeFile(
    resolve(runtimeDirectory, "versions.json"),
    `${JSON.stringify(runtime, null, 2)}\n`,
  ),
]);
