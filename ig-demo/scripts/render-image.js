import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import sharp from "sharp";

const {
  LOCAL_IMAGE_PATH,
  IMAGE_TOP_LEFT,
  IMAGE_MID_LEFT,
  IMAGE_BOTTOM_LEFT,
  IMAGE_RIGHT,
  OUTPUT_IMAGE_PATH = "./output/ig-card.jpg",
  LOGO_PATH = "./assets/img/remax-city-logo-wit.png",
  BALLOON_PATH = "./assets/img/remax-balloon-2025.png",
  ADDRESS,
  CITY,
  BRAND_BLUE = "#0b1c39",
  TEXT_COLOR = "#ffffff",
  HEADLINE_TEXT = "NIEUW IN DE VERKOOP!",
  SUBHEADLINE_TEXT,
  LOGO_OFFSET_Y = "0",
  LOGO_OFFSET_X = "0",
} = process.env;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing ${name}. Set it in .env`);
  }
}

requireEnv("LOCAL_IMAGE_PATH", LOCAL_IMAGE_PATH);

function normalizeString(value) {
  if (!value) return "";
  return String(value).trim().replace(/^\"|\"$/g, "");
}

function normalizeColor(value, fallback) {
  const cleaned = normalizeString(value);
  return cleaned || fallback;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildSubheadline() {
  const custom = normalizeString(SUBHEADLINE_TEXT);
  if (custom) return custom;
  const address = normalizeString(ADDRESS);
  const city = normalizeString(CITY);
  if (address && city) return `${address} te ${city}`;
  return [address, city].filter(Boolean).join(", ");
}

async function loadImageBuffer(source, resizeOptions, { trim = false } = {}) {
  if (!source) return null;
  try {
    let image;
    if (/^https?:\/\//i.test(source)) {
      const res = await fetch(source);
      if (!res.ok) {
        throw new Error(`Failed to fetch image: ${res.status}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      image = sharp(Buffer.from(arrayBuffer));
    } else {
      image = sharp(source);
    }

    if (trim) image = image.trim();
    if (resizeOptions) image = image.resize(resizeOptions);
    return await image.toBuffer();
  } catch (err) {
    console.warn(`Could not load image: ${source}`);
    return null;
  }
}

async function render() {
  const canvasW = 1080;
  const canvasH = 1350;
  const margin = 30;
  const gap = 20;
  const bottomH = 220;
  const topAreaH = canvasH - bottomH - margin * 2;

  const leftW = 320;
  const rightW = canvasW - margin * 2 - leftW - gap;
  const leftH = Math.floor((topAreaH - gap * 2) / 3);

  const leftX = margin;
  const leftY1 = margin;
  const leftY2 = margin + leftH + gap;
  const leftY3 = margin + (leftH + gap) * 2;

  const rightX = margin + leftW + gap;
  const rightY = margin;

  const framePad = 6;
  const frameStroke = 4;

  const brandBlue = normalizeColor(BRAND_BLUE, "#0b1c39");
  const textColor = normalizeColor(TEXT_COLOR, "#ffffff");

  const topLeftPath = IMAGE_TOP_LEFT || LOCAL_IMAGE_PATH;
  const midLeftPath = IMAGE_MID_LEFT || LOCAL_IMAGE_PATH;
  const bottomLeftPath = IMAGE_BOTTOM_LEFT || LOCAL_IMAGE_PATH;
  const rightPath = IMAGE_RIGHT || LOCAL_IMAGE_PATH;

  const leftBufferTop = await loadImageBuffer(topLeftPath, {
    width: leftW - framePad * 2,
    height: leftH - framePad * 2,
    fit: "cover",
  });

  const leftBufferMid = await loadImageBuffer(midLeftPath, {
    width: leftW - framePad * 2,
    height: leftH - framePad * 2,
    fit: "cover",
  });

  const leftBufferBottom = await loadImageBuffer(bottomLeftPath, {
    width: leftW - framePad * 2,
    height: leftH - framePad * 2,
    fit: "cover",
  });

  const rightBuffer = await loadImageBuffer(rightPath, {
    width: rightW - framePad * 2,
    height: topAreaH - framePad * 2,
    fit: "cover",
  });
  if (!leftBufferTop || !leftBufferMid || !leftBufferBottom || !rightBuffer) {
    throw new Error("One or more listing images could not be loaded.");
  }

  const logoWidth = 300;
  const logoHeight = 140;
  const logoBuffer = await loadImageBuffer(
    LOGO_PATH,
    {
      width: logoWidth,
      height: logoHeight,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
    { trim: true }
  );

  const balloonSize = 130;
  const balloonBuffer = await loadImageBuffer(BALLOON_PATH, {
    width: balloonSize,
    height: balloonSize,
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  const headline = normalizeString(HEADLINE_TEXT) || "NIEUW IN DE VERKOOP!";
  const subheadline = buildSubheadline();

  const headlineFontSize = 50;
  const headlineAscent = 0.8; // approximate ascent ratio for baseline alignment
  const textX = margin + logoWidth + 50;
  const textY = canvasH - bottomH + 70;
  const headlineTop = textY - headlineFontSize * headlineAscent;
  const logoYOffset = Number(LOGO_OFFSET_Y) || 0;
  const logoXOffset = Number(LOGO_OFFSET_X) || 0;
  const logoY = Math.round(headlineTop + logoYOffset);

  const overlaySvg = `
<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${canvasW}" height="${canvasH}" fill="${brandBlue}" />
  <rect x="${leftX}" y="${leftY1}" width="${leftW}" height="${leftH}" fill="#ffffff" />
  <rect x="${leftX}" y="${leftY2}" width="${leftW}" height="${leftH}" fill="#ffffff" />
  <rect x="${leftX}" y="${leftY3}" width="${leftW}" height="${leftH}" fill="#ffffff" />
  <rect x="${rightX}" y="${rightY}" width="${rightW}" height="${topAreaH}" fill="#ffffff" />

  <rect x="${leftX}" y="${leftY1}" width="${leftW}" height="${leftH}" fill="none" stroke="#0a0a0a" stroke-width="${frameStroke}" />
  <rect x="${leftX}" y="${leftY2}" width="${leftW}" height="${leftH}" fill="none" stroke="#0a0a0a" stroke-width="${frameStroke}" />
  <rect x="${leftX}" y="${leftY3}" width="${leftW}" height="${leftH}" fill="none" stroke="#0a0a0a" stroke-width="${frameStroke}" />
  <rect x="${rightX}" y="${rightY}" width="${rightW}" height="${topAreaH}" fill="none" stroke="#0a0a0a" stroke-width="${frameStroke}" />

  <text x="${textX}" y="${textY}" font-family="Arial, sans-serif" font-size="${headlineFontSize}" font-weight="800" fill="${textColor}">
    ${escapeXml(headline)}
  </text>
  ${subheadline ? `<text x="${textX}" y="${textY + 58}" font-family="Arial, sans-serif" font-size="34" font-weight="400" fill="${textColor}">${escapeXml(subheadline)}</text>` : ""}
</svg>`;

  const outputPath = path.resolve(OUTPUT_IMAGE_PATH);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const composites = [
    { input: Buffer.from(overlaySvg) },
    {
      input: leftBufferTop,
      left: leftX + framePad,
      top: leftY1 + framePad,
    },
    {
      input: leftBufferMid,
      left: leftX + framePad,
      top: leftY2 + framePad,
    },
    {
      input: leftBufferBottom,
      left: leftX + framePad,
      top: leftY3 + framePad,
    },
    {
      input: rightBuffer,
      left: rightX + framePad,
      top: rightY + framePad,
    },
  ];

  if (logoBuffer) {
    composites.push({
      input: logoBuffer,
      left: margin + logoXOffset,
      top: logoY,
    });
  }

  if (balloonBuffer) {
    composites.push({
      input: balloonBuffer,
      left: rightX + rightW - balloonSize - 12,
      top: rightY + 12,
    });
  }

  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: brandBlue,
    },
  })
    .composite(composites)
    .jpeg({ quality: 90 })
    .toFile(outputPath);

  console.log(`Rendered image: ${outputPath}`);
}

render().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
