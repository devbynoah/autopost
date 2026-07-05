import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { selectListingPhotos } from "./photo-selection.js";
import { config, replaceRuntimeConfig } from "./runtime-config.js";

const {
  JSON_SOURCE_PATH = "./aanbod/kolibri-aanbod.json",
  LISTING_ID,
  LISTING_QUERY,
  LISTING_BASE_URL,
} = config;

function normalizeString(value) {
  if (!value) return "";
  return String(value).trim().replace(/^\"|\"$/g, "");
}

function cleanDescription(value) {
  let text = normalizeString(value)
    .replace(/\uFFFD/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  const englishIdx = text.toLowerCase().indexOf("english version");
  if (englishIdx >= 0) {
    text = text.slice(0, englishIdx).trim();
  }

  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((paragraph) => {
      if (/^[-•]/.test(paragraph)) return paragraph;
      if (/[.!?;:]$/.test(paragraph)) return paragraph;
      return `${paragraph}.`;
    })
    .join(" ");
}


function toUrl(base, rel) {
  if (!base || !rel) return "";
  const trimmedBase = base.replace(/\/$/, "");
  const trimmedRel = rel.replace(/^\//, "");
  return `${trimmedBase}/${trimmedRel}`;
}

async function main() {
  const jsonPath = path.resolve(JSON_SOURCE_PATH);
  const raw = await fs.readFile(jsonPath, "utf8");
  const data = JSON.parse(raw.replace(/^\uFEFF/, ""));

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("JSON contains no listings.");
  }

  const query = normalizeString(LISTING_QUERY).toLowerCase();
  let listing = null;

  if (LISTING_ID) {
    listing = data.find((item) => String(item.id) === String(LISTING_ID));
  } else if (query) {
    const matches = data.filter((item) => {
      const haystack = [
        item.title,
        item.street,
        item.slug,
        item.url,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
    listing = matches[matches.length - 1] || null;
  } else {
    listing = data[data.length - 1];
  }

  if (!listing) {
    if (LISTING_ID) {
      throw new Error(`Listing not found for id: ${LISTING_ID}`);
    }
    if (query) {
      throw new Error(`Listing not found for query: ${LISTING_QUERY}`);
    }
    throw new Error("Listing not found.");
  }
  const pickedInfo = [
    listing.id && `id=${listing.id}`,
    listing.title,
    listing.street || listing.houseNumber
      ? `${listing.street || ""} ${listing.houseNumber || ""}`.trim()
      : "",
    listing.city,
  ]
    .filter(Boolean)
    .join(" | ")
    .replace(/\s+/g, " ")
    .trim();
  console.log(`Using listing: ${pickedInfo}`);

  const address = [listing.street, listing.houseNumber].filter(Boolean).join(" ");
  const listingUrl = toUrl(LISTING_BASE_URL, listing.url);

  const { cardPhotos } = selectListingPhotos(listing);
  const fallbackImage = cardPhotos[0] || "";

  const imageRight = cardPhotos[0] || fallbackImage;
  const imageTopLeft = cardPhotos[1] || fallbackImage;
  const imageMidLeft = cardPhotos[2] || fallbackImage;
  const imageBottomLeft = cardPhotos[3] || fallbackImage;

  const rawDescription =
    listing.description ||
    listing.groundFloorDescription ||
    listing.detailsDescription ||
    "";
  const description = cleanDescription(rawDescription);

  const values = {
    LISTING_TITLE: normalizeString(listing.title),
    ADDRESS: normalizeString(address),
    CITY: normalizeString(listing.city),
    PRICE_EUR: listing.price ?? "",
    AREA_M2: listing.livingArea ?? "",
    ROOMS: listing.rooms ?? "",
    ENERGY_LABEL: normalizeString(listing.energyLabel),
    LISTING_URL: normalizeString(listingUrl),
    CONTACT_PHONE: normalizeString(listing.contactPhone || listing.contactMobile),
    CONTACT_MOBILE: normalizeString(listing.contactMobile),
    CONTACT_EMAIL: normalizeString(listing.contactEmail),
    PROPERTY_TYPE: normalizeString(listing.type),
    PROPERTY_CATEGORY: normalizeString(listing.soortWoning),
    PROPERTY_SUBTYPE: normalizeString(listing.soortWoonhuis || listing.apartmentType),
    PROPERTY_HOUSE_TYPE: normalizeString(listing.typeWoonhuis),
    PROPERTY_APARTMENT_FEATURE: normalizeString(listing.apartmentFeature),
    LISTING_STATUS: normalizeString(listing.status),
    LISTING_LABELS: Array.isArray(listing.labels)
      ? listing.labels.join(",")
      : normalizeString(listing.labels),
    DESCRIPTION_TEXT: description,
    IMAGE_TOP_LEFT: imageTopLeft,
    IMAGE_MID_LEFT: imageMidLeft,
    IMAGE_BOTTOM_LEFT: imageBottomLeft,
    IMAGE_RIGHT: imageRight,
    IMAGE_URL: "",
    CAROUSEL_IMAGE_URLS: "",
  };

  await replaceRuntimeConfig(values);

  console.log("Runtime config updated from JSON listing:", listing.id);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
