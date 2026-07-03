import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import sharp from "sharp";
import { selectListingPhotos } from "./photo-selection.js";

const {
  JSON_SOURCE_PATH = "./aanbod/kolibri-aanbod.json",
  LISTING_ID,
  LISTING_QUERY,
  CAROUSEL_ENABLED = "1",
  CAROUSEL_EXTRA_PHOTOS = "9",
  CAROUSEL_OUTPUT_DIR = "./output/carousel",
} = process.env;

function isEnabled(value) {
  return value !== "0" && String(value).toLowerCase() !== "false";
}

function normalizeString(value) {
  if (!value) return "";
  return String(value).trim().replace(/^\"|\"$/g, "");
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function findListing() {
  const jsonPath = path.resolve(JSON_SOURCE_PATH);
  const data = await readJson(jsonPath);

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("JSON contains no listings.");
  }

  const query = normalizeString(LISTING_QUERY).toLowerCase();
  if (LISTING_ID) {
    return data.find((item) => String(item.id) === String(LISTING_ID)) || null;
  }

  if (query) {
    const matches = data.filter((item) => {
      const haystack = [item.title, item.street, item.slug, item.url]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
    return matches[matches.length - 1] || null;
  }

  return data[data.length - 1];
}

async function loadImage(source) {
  if (!source) return null;
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch carousel image: ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  return fs.readFile(source);
}

async function clearOutputDir(dir) {
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir);
  await Promise.all(
    entries
      .filter((name) => /^photo-\d+\.jpg$/i.test(name))
      .map((name) => fs.unlink(path.join(dir, name)).catch(() => {}))
  );
}

async function renderTile(input, width, height) {
  return sharp(input)
    .resize({
      width,
      height,
      fit: "cover",
      position: "centre",
    })
    .sharpen({ sigma: 0.4, m1: 0.6, m2: 1.4 })
    .toBuffer();
}

function getSlideLayout(index, photoCount) {
  const gap = 12;

  if (photoCount === 1) {
    return [{ left: 0, top: 0, width: 1080, height: 1350 }];
  }

  if (photoCount === 2) {
    const topHeight = Math.floor((1350 - gap) / 2);
    return [
      { left: 0, top: 0, width: 1080, height: topHeight },
      {
        left: 0,
        top: topHeight + gap,
        width: 1080,
        height: 1350 - topHeight - gap,
      },
    ];
  }

  if (index % 3 === 1) {
    const rowHeight = Math.floor((1350 - gap * 2) / 3);
    return [
      { left: 0, top: 0, width: 1080, height: rowHeight },
      {
        left: 0,
        top: rowHeight + gap,
        width: 1080,
        height: rowHeight,
      },
      {
        left: 0,
        top: (rowHeight + gap) * 2,
        width: 1080,
        height: 1350 - (rowHeight + gap) * 2,
      },
    ];
  }

  if (index % 3 === 2) {
    const smallWidth = Math.floor((1080 - gap) / 2);
    const smallHeight = 518;
    const largeY = smallHeight + gap;
    return [
      { left: 0, top: largeY, width: 1080, height: 1350 - largeY },
      { left: 0, top: 0, width: smallWidth, height: smallHeight },
      {
        left: smallWidth + gap,
        top: 0,
        width: 1080 - smallWidth - gap,
        height: smallHeight,
      },
    ];
  }

  const largeHeight = 820;
  const smallY = largeHeight + gap;
  const smallWidth = Math.floor((1080 - gap) / 2);
  return [
    { left: 0, top: 0, width: 1080, height: largeHeight },
    {
      left: 0,
      top: smallY,
      width: smallWidth,
      height: 1350 - smallY,
    },
    {
      left: smallWidth + gap,
      top: smallY,
      width: 1080 - smallWidth - gap,
      height: 1350 - smallY,
    },
  ];
}

async function main() {
  const outputDir = path.resolve(CAROUSEL_OUTPUT_DIR);
  await clearOutputDir(outputDir);

  if (!isEnabled(CAROUSEL_ENABLED)) {
    console.log("Carousel extra photos disabled.");
    return;
  }

  const listing = await findListing();
  if (!listing) {
    throw new Error("Listing not found for carousel photos.");
  }

  const { cardPhotos, carouselPhotos } = selectListingPhotos(listing);
  const maxSlides = Math.min(
    9,
    Math.max(0, Number(CAROUSEL_EXTRA_PHOTOS) || 0)
  );
  const photosPerSlide = 3;
  const extraImages = carouselPhotos.slice(0, maxSlides * photosPerSlide);

  if (extraImages.length === 0) {
    console.log(
      `No carousel photos remain after reserving ${cardPhotos.length} for the IG card.`
    );
    return;
  }

  const slides = Array.from(
    { length: Math.ceil(extraImages.length / photosPerSlide) },
    (_, index) =>
      extraImages.slice(
        index * photosPerSlide,
        (index + 1) * photosPerSlide
      )
  );

  for (const [index, sources] of slides.entries()) {
    try {
      const inputs = await Promise.all(sources.map(loadImage));
      const outputPath = path.join(
        outputDir,
        `photo-${String(index + 1).padStart(2, "0")}.jpg`
      );

      const layout = getSlideLayout(index, inputs.length);
      const tiles = await Promise.all(
        inputs.map(async (input, tileIndex) => {
          const position = layout[tileIndex];
          return {
            input: await renderTile(
              input,
              position.width,
              position.height
            ),
            left: position.left,
            top: position.top,
          };
        })
      );

      await sharp({
        create: {
          width: 1080,
          height: 1350,
          channels: 3,
          background: "#0b1c39",
        },
      })
        .composite(tiles)
        .jpeg({
          quality: 96,
          chromaSubsampling: "4:4:4",
          mozjpeg: true,
        })
        .toFile(outputPath);
      console.log(
        `Rendered carousel slide with ${sources.length} photos: ${outputPath}`
      );
    } catch (err) {
      console.warn(`Could not render carousel slide ${index + 1}.`);
      console.warn(err.message || err);
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
