// Generates the website favicon set from the Kesher Social connection logo.
//
// Usage: node scripts/generateFavicons.mjs

import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBSITE = join(__dirname, "..", "website");
const NEUTRAL_LOGO = join(__dirname, "..", "assets", "kesher-logo.png");

const logo = readFileSync(NEUTRAL_LOGO);

for (const [name, size] of [
  ["favicon-32.png", 32],
  ["favicon-180.png", 180],
  ["favicon-512.png", 512],
]) {
  const buf = await sharp(logo)
    .resize(size, size, { fit: "cover" })
    .png()
    .toBuffer();
  writeFileSync(join(WEBSITE, name), buf);
  console.log("wrote", name);
}

writeFileSync(
  join(WEBSITE, "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <image href="favicon-512.png" width="1024" height="1024"/>
</svg>`
);
console.log("wrote favicon.svg");
console.log("Done.");
