import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

const readEnvFile = () => {
  try {
    const contents = readFileSync(envPath, "utf8");
    return Object.fromEntries(
      contents
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const separator = line.indexOf("=");
          if (separator === -1) {
            return [line, ""];
          }
          return [line.slice(0, separator), line.slice(separator + 1)];
        })
    );
  } catch {
    return {};
  }
};

const env = { ...readEnvFile(), ...process.env };

const config = {
  apiKey: env.FIREBASE_WEB_API_KEY || env.FIREBASE_API_KEY || "",
  authDomain: env.FIREBASE_AUTH_DOMAIN || "",
  projectId: env.FIREBASE_PROJECT_ID || "",
};

const missing = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(
    `Missing Firebase website config: ${missing.join(", ")}. Set them in .env or the environment.`
  );
  process.exit(1);
}

const output = `window.__KESHER_FIREBASE_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`;
const target = join(root, "website", "firebase-config.js");

writeFileSync(target, output, "utf8");
console.log(`Wrote ${target}`);
