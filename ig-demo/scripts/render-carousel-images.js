import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import sharp from "sharp";

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

  const images = Array.isArray(listing.images) ? listing.images : [];
  const uniqueImages = Array.from(new Set(images.filter(Boolean)));
  const maxExtra = Math.min(9, Math.max(0, Number(CAROUSEL_EXTRA_PHOTOS) || 0));
  const extraImages = uniqueImages.slice(0, maxExtra);

  if (extraImages.length === 0) {
    console.log("No carousel extra photos found.");
    return;
  }

  for (const [index, source] of extraImages.entries()) {
    try {
      const input = await loadImage(source);
      const outputPath = path.join(
        outputDir,
        `photo-${String(index + 1).padStart(2, "0")}.jpg`
      );

      const background = await sharp(input)
        .resize({
          width: 1080,
          height: 1350,
          fit: "cover",
          position: "center",
        })
        .blur(18)
        .modulate({ brightness: 0.82 })
        .toBuffer();

      const foreground = await sharp(input)
        .resize({
          width: 1080,
          height: 1350,
          fit: "inside",
          withoutEnlargement: true,
        })
        .sharpen({ sigma: 0.45, m1: 0.7, m2: 1.6 })
        .toBuffer();

      await sharp(background)
        .composite([{ input: foreground, gravity: "center" }])
        .jpeg({
          quality: 96,
          chromaSubsampling: "4:4:4",
          mozjpeg: true,
        })
        .toFile(outputPath);
      console.log(`Rendered carousel photo: ${outputPath}`);
    } catch (err) {
      console.warn(`Could not render carousel image: ${source}`);
      console.warn(err.message || err);
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
