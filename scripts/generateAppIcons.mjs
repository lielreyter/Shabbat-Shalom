// Deterministic app-icon generator.
//
// Renders Kesher app icons from vector primitives (Jewish, Christian) and the
// shared Kesher Social connection logo for the primary / neutral App Store icon.
//
// Usage:  node scripts/generateAppIcons.mjs
//
// Requires: @resvg/resvg-js, sharp (installed locally).

import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONSET_ROOT = join(
  __dirname,
  "..",
  "ios",
  "shabbat_shalomv1",
  "Images.xcassets"
);
const NEUTRAL_LOGO = join(__dirname, "..", "assets", "kesher-logo.png");

const CANVAS = 1024;

const COLORS = {
  white: "#FFFFFF",
  jewish: "#2563EB",
  jewishDot: "#1E40AF",
  christian: "#7C3AED",
  lightBlue: "#DBEAFE",
  lightPurple: "#EDE9FE",
};

/** Outlined Star of David centered at (cx, cy) with circumradius R. */
function star(cx, cy, R, stroke, color, dotColor) {
  const sin60 = Math.sqrt(3) / 2;
  const p = (x, y) => `${(cx + x).toFixed(2)},${(cy + y).toFixed(2)}`;
  const up = `M ${p(0, -R)} L ${p(sin60 * R, 0.5 * R)} L ${p(-sin60 * R, 0.5 * R)} Z`;
  const down = `M ${p(0, R)} L ${p(-sin60 * R, -0.5 * R)} L ${p(sin60 * R, -0.5 * R)} Z`;
  const dot = dotColor
    ? `<circle cx="${cx}" cy="${cy}" r="${(stroke * 0.62).toFixed(2)}" fill="${dotColor}"/>`
    : "";
  return `
    <path d="${up} ${down}" fill="none" stroke="${color}" stroke-width="${stroke}"
          stroke-linejoin="round" stroke-linecap="round"/>
    ${dot}`;
}

/** Rounded cross centered at (cx, cy). `size` is the overall bounding scale. */
function cross(cx, cy, size, color) {
  const stroke = size * 0.16;
  const vertical = size * 0.82;
  const horizontal = size * 0.52;
  const barTop = vertical * 0.26;
  const vx = cx - stroke / 2;
  const vy = cy - vertical / 2;
  const hy = vy + barTop - stroke / 2;
  const hx = cx - horizontal / 2;
  const r = stroke / 2;
  return `
    <rect x="${vx.toFixed(2)}" y="${vy.toFixed(2)}" width="${stroke.toFixed(2)}" height="${vertical.toFixed(2)}" rx="${r.toFixed(2)}" fill="${color}"/>
    <rect x="${hx.toFixed(2)}" y="${hy.toFixed(2)}" width="${horizontal.toFixed(2)}" height="${stroke.toFixed(2)}" rx="${r.toFixed(2)}" fill="${color}"/>`;
}

function wrap(bgCircle, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
    <rect width="${CANVAS}" height="${CANVAS}" fill="${COLORS.white}"/>
    <circle cx="512" cy="512" r="430" fill="${bgCircle}"/>
    ${inner}
  </svg>`;
}

const SVGS = {
  AppIconJewish: wrap(
    COLORS.lightBlue,
    star(512, 512, 232, 42, COLORS.jewish, COLORS.jewishDot)
  ),
  AppIconChristian: wrap(COLORS.lightPurple, cross(512, 512, 560, COLORS.christian)),
};

async function renderFromSvg(svg, px) {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: px } });
  const rgba = resvg.render().asPng();
  return sharp(rgba).flatten({ background: "#FFFFFF" }).png().toBuffer();
}

async function renderFromLogo(px) {
  return sharp(readFileSync(NEUTRAL_LOGO))
    .resize(px, px, { fit: "cover" })
    .flatten({ background: "#FFFFFF" })
    .png()
    .toBuffer();
}

async function generateForSet(setName) {
  const setDir = join(ICONSET_ROOT, `${setName}.appiconset`);
  const contents = JSON.parse(readFileSync(join(setDir, "Contents.json"), "utf8"));
  const useLogo = setName === "AppIcon" || setName === "AppIconNeutral";
  const svg = SVGS[setName];
  for (const image of contents.images) {
    if (!image.filename) continue;
    const base = parseFloat(image.size.split("x")[0]);
    const scale = parseInt(image.scale, 10) || 1;
    const px = Math.round(base * scale);
    const png = useLogo ? await renderFromLogo(px) : await renderFromSvg(svg, px);
    writeFileSync(join(setDir, image.filename), png);
    console.log(`  ${setName}/${image.filename}  (${px}x${px})`);
  }
}

for (const setName of ["AppIcon", "AppIconJewish", "AppIconChristian", "AppIconNeutral"]) {
  console.log(`Generating ${setName}…`);
  await generateForSet(setName);
}
console.log("Done.");
