import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const {
  LOCAL_IMAGE_PATH,
  OUTPUT_IMAGE_PATH = "./output/ig-card.jpg",
  LOGO_PATH,
  ADDRESS,
  CITY,
  PRICE_EUR,
  BRAND_BLUE = "#000e36",
  BRAND_RED = "#ff1100",
  BADGE_COLOR = "#1f63ff",
  TEXT_COLOR = "#ffffff",
  HEADLINE_TEXT = "NIEUW IN DE VERKOOP",
  DESCRIPTION_TEXT =
    "Zoek je een fijn, ruim appartement met alle voorzieningen binnen handbereik? Voeg hier je eigen beschrijving toe.",
} = process.env;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing ${name}. Set it in .env`);
  }
}

requireEnv("LOCAL_IMAGE_PATH", LOCAL_IMAGE_PATH);

function formatPrice(value) {
  if (!value) return "";
  const digits = String(value).replace(/[^0-9]/g, "");
  if (!digits) return String(value).trim();
  const number = Number(digits);
  if (!Number.isFinite(number)) return String(value).trim();
  return new Intl.NumberFormat("nl-NL").format(number);
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function render() {
  const canvasW = 1080;
  const canvasH = 1350;
  const margin = 40;
  const gap = 18;
  const topH = 560;
  const smallH = 240;
  const topW = canvasW - margin * 2;
  const smallW = Math.floor((topW - gap * 2) / 3);

  const topY = margin;
  const smallY = topY + topH + gap;
  const textY = smallY + smallH + gap + 10;

  const base = sharp(LOCAL_IMAGE_PATH);
  const topBuffer = await base
    .clone()
    .resize({ width: topW, height: topH, fit: "cover" })
    .toBuffer();

  const smallBuffer = await base
    .clone()
    .resize({ width: smallW, height: smallH, fit: "cover" })
    .toBuffer();

  const addressLine = [ADDRESS, CITY].filter(Boolean).join(", ");
  const price = formatPrice(PRICE_EUR);

  const headlineLines = wrapText(HEADLINE_TEXT, 18).slice(0, 2);
  const descLines = wrapText(DESCRIPTION_TEXT, 54).slice(0, 6);

  const badgePaddingX = 22;
  const badgePaddingY = 14;
  const badgeLineHeight = 44;
  const badgeW = 480;
  const badgeH =
    badgePaddingY * 2 + badgeLineHeight * headlineLines.length;

  const badgeX = margin + 10;
  const badgeY = margin + 10;

  const pinR = 38;
  const pinX = canvasW - margin - pinR - 8;
  const pinY = margin + pinR + 8;

  const textStartX = margin;
  const textLineHeight = 36;
  const textSize = 30;

  const descSvgLines = descLines
    .map((line, i) => {
      return `<text x="${textStartX}" y="${textY + i * textLineHeight}" font-family="Arial, sans-serif" font-size="${textSize}" font-weight="400" fill="${TEXT_COLOR}">${escapeXml(line)}</text>`;
    })
    .join("");

  const detailLines = [];
  if (addressLine) detailLines.push(`📍 ${addressLine}`);
  if (price) detailLines.push(`💶 Vraagprijs EUR ${price},- k.k.`);
  const detailSvgLines = detailLines
    .map((line, i) => {
      return `<text x="${textStartX}" y="${textY - 16 - (detailLines.length - 1 - i) * textLineHeight}" font-family="Arial, sans-serif" font-size="${textSize}" font-weight="600" fill="${TEXT_COLOR}">${escapeXml(line)}</text>`;
    })
    .join("");

  const badgeText = headlineLines
    .map((line, i) => {
      return `<text x="${badgeX + badgePaddingX}" y="${badgeY + badgePaddingY + badgeLineHeight * (i + 1) - 8}" font-family="Arial, sans-serif" font-size="36" font-weight="800" fill="#ffffff">${escapeXml(line)}</text>`;
    })
    .join("");

  const pinSvg = `
    <g>
      <defs>
        <clipPath id="pinClip">
          <circle cx="${pinX}" cy="${pinY}" r="${pinR}" />
        </clipPath>
      </defs>
      <circle cx="${pinX}" cy="${pinY}" r="${pinR + 4}" fill="#ffffff" />
      <g clip-path="url(#pinClip)">
        <rect x="${pinX - pinR}" y="${pinY - pinR}" width="${pinR * 2}" height="${(pinR * 2) / 3}" fill="#ae1c28" />
        <rect x="${pinX - pinR}" y="${pinY - pinR + (pinR * 2) / 3}" width="${pinR * 2}" height="${(pinR * 2) / 3}" fill="#ffffff" />
        <rect x="${pinX - pinR}" y="${pinY - pinR + (pinR * 4) / 3}" width="${pinR * 2}" height="${(pinR * 2) / 3}" fill="#21468b" />
      </g>
      <circle cx="${pinX}" cy="${pinY}" r="${pinR}" fill="none" stroke="#ffffff" stroke-width="2" />
      <polygon points="${pinX},${pinY + pinR + 8} ${pinX - 10},${pinY + pinR - 2} ${pinX + 10},${pinY + pinR - 2}" fill="#ffffff" />
    </g>
  `;

  const overlaySvg = `
<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${canvasW}" height="${canvasH}" fill="${BRAND_BLUE}" />
  <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" fill="${BADGE_COLOR}" />
  ${badgeText}
  ${pinSvg}
  ${detailSvgLines}
  ${descSvgLines}
</svg>`;

  const outputPath = path.resolve(OUTPUT_IMAGE_PATH);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: BRAND_BLUE,
    },
  })
    .composite([
      { input: topBuffer, left: margin, top: topY },
      { input: smallBuffer, left: margin, top: smallY },
      { input: smallBuffer, left: margin + smallW + gap, top: smallY },
      { input: smallBuffer, left: margin + (smallW + gap) * 2, top: smallY },
      { input: Buffer.from(overlaySvg) },
    ])
    .jpeg({ quality: 90 })
    .toFile(outputPath);

  console.log(`Rendered image: ${outputPath}`);
}

render().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});