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

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

async function renderTile(input, width, height, fit = "cover") {
  return sharp(input)
    .resize({
      width,
      height,
      fit,
      position: sharp.strategy.attention,
      background: "#0b1c39",
    })
    .sharpen({ sigma: 0.4, m1: 0.6, m2: 1.4 })
    .jpeg({
      quality: 96,
      chromaSubsampling: "4:4:4",
      mozjpeg: true,
    })
    .toBuffer();
}

function getSlideLayout(index, entries, layoutOverride = "") {
  const gap = 12;
  const photoCount = entries.length;

  if (photoCount === 1) {
    return [
      {
        left: 0,
        top: 0,
        width: 1080,
        height: 1350,
        fit: "contain",
      },
    ];
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

  if (layoutOverride === "two-top-one-bottom") {
    const topWidth = Math.floor((1080 - gap) / 2);
    const topHeight = 518;
    const bottomY = topHeight + gap;
    return [
      { left: 0, top: 0, width: topWidth, height: topHeight },
      {
        left: topWidth + gap,
        top: 0,
        width: 1080 - topWidth - gap,
        height: topHeight,
      },
      {
        left: 0,
        top: bottomY,
        width: 1080,
        height: 1350 - bottomY,
      },
    ];
  }

  if (index % 2 === 1) {
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

async function renderCtaSlide(listing, heroSource, outputPath) {
  const heroInput = await loadImage(heroSource);
  const hero = await sharp(heroInput)
    .resize({
      width: 1080,
      height: 710,
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .toBuffer();
  const logo = await sharp(
    path.resolve("./assets/img/remax-city-logo-wit.png")
  )
    .resize({ width: 300, withoutEnlargement: true })
    .toBuffer();
  const address =
    [listing.street, listing.houseNumber].filter(Boolean).join(" ") ||
    listing.title ||
    "";
  const location = [address, listing.city].filter(Boolean).join(", ");
  const text = Buffer.from(`
    <svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="710" width="1080" height="640" fill="#0b1c39"/>
      <rect x="72" y="815" width="94" height="8" fill="#e11d2e"/>
      <text x="72" y="900" fill="#ffffff" font-family="Arial, sans-serif"
        font-size="58" font-weight="700">INTERESSE IN DEZE WONING?</text>
      <text x="72" y="978" fill="#ffffff" font-family="Arial, sans-serif"
        font-size="46" font-weight="400">Plan een bezichtiging</text>
      <text x="72" y="1055" fill="#dbe6f5" font-family="Arial, sans-serif"
        font-size="32">${escapeXml(location)}</text>
      <line x1="72" y1="1105" x2="1008" y2="1105" stroke="#52627c" stroke-width="2"/>
      <text x="72" y="1175" fill="#ffffff" font-family="Arial, sans-serif"
        font-size="30">T: 070-21 70 721</text>
      <text x="72" y="1225" fill="#ffffff" font-family="Arial, sans-serif"
        font-size="30">E: city@remax.nl</text>
    </svg>
  `);

  await sharp({
    create: {
      width: 1080,
      height: 1350,
      channels: 3,
      background: "#0b1c39",
    },
  })
    .composite([
      { input: hero, left: 0, top: 0 },
      { input: text, left: 0, top: 0 },
      { input: logo, left: 708, top: 1240 - 95 },
    ])
    .jpeg({
      quality: 96,
      chromaSubsampling: "4:4:4",
      mozjpeg: true,
    })
    .toFile(outputPath);
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
  const regularPhotoSlideLimit = Math.max(0, maxSlides - 1);
  const photosPerSlide = 3;
  const preferredLastSlide = Array.isArray(listing.carouselLastSlideImages)
    ? listing.carouselLastSlideImages
        .filter((source) => carouselPhotos.includes(source))
        .slice(0, photosPerSlide)
    : [];
  const preferredSet = new Set(preferredLastSlide);
  const standardCarouselPhotos = carouselPhotos.filter(
    (source) => !preferredSet.has(source)
  );
  const standardSlideLimit = Math.max(
    0,
    regularPhotoSlideLimit - (preferredLastSlide.length > 0 ? 1 : 0)
  );
  const extraImages = standardCarouselPhotos.slice(
    0,
    standardSlideLimit * photosPerSlide
  );

  async function loadEntries(sources) {
    return Promise.all(
      sources.map(async (source) => {
        const input = await loadImage(source);
        const metadata = await sharp(input).metadata();
        return {
          source,
          input,
          orientation:
            (metadata.height || 0) > (metadata.width || 0)
              ? "portrait"
              : "landscape",
        };
      })
    );
  }

  const entries = await loadEntries(extraImages);
  const regularSlides = Array.from(
    { length: Math.ceil(entries.length / photosPerSlide) },
    (_, index) =>
      entries.slice(
        index * photosPerSlide,
        (index + 1) * photosPerSlide
      )
  );
  const slides = [...regularSlides];

  if (preferredLastSlide.length > 0) {
    const preferredEntries = await loadEntries(preferredLastSlide);
    const heroSource = normalizeString(listing.carouselLastSlideHeroImage);
    const heroIndex = preferredEntries.findIndex(
      (entry) => entry.source === heroSource
    );

    if (
      heroIndex >= 0 &&
      normalizeString(listing.carouselLastSlideLayout) ===
        "two-top-one-bottom"
    ) {
      const [heroEntry] = preferredEntries.splice(heroIndex, 1);
      preferredEntries.push(heroEntry);
    }

    slides.push(preferredEntries);
  }

  for (const [index, slideEntries] of slides.entries()) {
    try {
      const outputPath = path.join(
        outputDir,
        `photo-${String(index + 1).padStart(2, "0")}.jpg`
      );

      const isPreferredLastSlide =
        preferredLastSlide.length > 0 && index === slides.length - 1;
      const layoutOverride = isPreferredLastSlide
        ? normalizeString(listing.carouselLastSlideLayout)
        : "";
      const layout = getSlideLayout(index, slideEntries, layoutOverride);
      const tiles = await Promise.all(
        slideEntries.map(async (entry, tileIndex) => {
          const position = layout[tileIndex];
          return {
            input: await renderTile(
              entry.input,
              position.width,
              position.height,
              position.fit
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
        `Rendered carousel slide with ${slideEntries.length} photos: ${outputPath}`
      );
    } catch (err) {
      console.warn(`Could not render carousel slide ${index + 1}.`);
      console.warn(err.message || err);
    }
  }

  if (maxSlides > 0 && cardPhotos[0]) {
    const ctaPath = path.join(
      outputDir,
      `photo-${String(slides.length + 1).padStart(2, "0")}.jpg`
    );
    await renderCtaSlide(listing, cardPhotos[0], ctaPath);
    console.log(`Rendered carousel CTA slide: ${ctaPath}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
