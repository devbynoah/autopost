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
  if (address && city) return `${address}, ${city}`;
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
  const overlap = 124;
  const imageGap = 20;
  const bottomH = 220;
  const topAreaH = canvasH - bottomH - margin * 2;

  const leftW = 315;
  const rightX = margin + leftW - overlap;
  const rightW = canvasW - margin - rightX;
  const leftH = leftW;
  const sideStackH = leftH * 3 + imageGap * 2;

  const leftX = margin;
  const rightY = margin;
  const leftY1 = Math.round(rightY + (topAreaH - sideStackH) / 2);
  const leftY2 = leftY1 + leftH + imageGap;
  const leftY3 = leftY1 + (leftH + imageGap) * 2;

  const frameStroke = 5;

  const brandBlue = normalizeColor(BRAND_BLUE, "#0b1c39");
  const textColor = normalizeColor(TEXT_COLOR, "#ffffff");

  const topLeftPath = IMAGE_TOP_LEFT || LOCAL_IMAGE_PATH;
  const midLeftPath = IMAGE_MID_LEFT || LOCAL_IMAGE_PATH;
  const bottomLeftPath = IMAGE_BOTTOM_LEFT || LOCAL_IMAGE_PATH;
  const rightPath = IMAGE_RIGHT || LOCAL_IMAGE_PATH;

  const leftBufferTop = await loadImageBuffer(topLeftPath, {
    width: leftW,
    height: leftH,
    fit: "cover",
  });

  const leftBufferMid = await loadImageBuffer(midLeftPath, {
    width: leftW,
    height: leftH,
    fit: "cover",
  });

  const leftBufferBottom = await loadImageBuffer(bottomLeftPath, {
    width: leftW,
    height: leftH,
    fit: "cover",
  });

  const rightBuffer = await loadImageBuffer(rightPath, {
    width: rightW,
    height: topAreaH,
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

  const bgSvg = `
<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${canvasW}" height="${canvasH}" fill="${brandBlue}" />
</svg>`;

  const sideFrameSvg = `
<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${leftX}" y="${leftY1}" width="${leftW}" height="${leftH}" fill="none" stroke="#0a0a0a" stroke-width="${frameStroke}" />
  <rect x="${leftX}" y="${leftY2}" width="${leftW}" height="${leftH}" fill="none" stroke="#0a0a0a" stroke-width="${frameStroke}" />
  <rect x="${leftX}" y="${leftY3}" width="${leftW}" height="${leftH}" fill="none" stroke="#0a0a0a" stroke-width="${frameStroke}" />
</svg>`;

  const textSvg = `
<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
  <text x="${textX}" y="${textY}" font-family="Arial, sans-serif" font-size="${headlineFontSize}" font-weight="800" fill="${textColor}">
    ${escapeXml(headline)}
  </text>
  ${subheadline ? `<text x="${textX}" y="${textY + 58}" font-family="Arial, sans-serif" font-size="34" font-weight="400" fill="${textColor}">${escapeXml(subheadline)}</text>` : ""}
</svg>`;

  const outputPath = path.resolve(OUTPUT_IMAGE_PATH);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const composites = [
    { input: Buffer.from(bgSvg) },
    {
      input: rightBuffer,
      left: rightX,
      top: rightY,
    },
    {
      input: leftBufferTop,
      left: leftX,
      top: leftY1,
    },
    {
      input: leftBufferMid,
      left: leftX,
      top: leftY2,
    },
    {
      input: leftBufferBottom,
      left: leftX,
      top: leftY3,
    },
    { input: Buffer.from(sideFrameSvg) },
    { input: Buffer.from(textSvg) },
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
