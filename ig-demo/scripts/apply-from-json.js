import "dotenv/config";
import fs from "fs/promises";
import path from "path";

const {
  JSON_SOURCE_PATH = "./aanbod/kolibri-aanbod.json",
  LISTING_ID,
  LISTING_BASE_URL,
} = process.env;

function normalizeString(value) {
  if (!value) return "";
  return String(value).trim().replace(/^\"|\"$/g, "");
}

function cleanDescription(value) {
  let text = normalizeString(value)
    .replace(/\s+/g, " ")
    .replace(/\uFFFD/g, "")
    .trim();
  const englishIdx = text.toLowerCase().indexOf("english version");
  if (englishIdx >= 0) {
    text = text.slice(0, englishIdx).trim();
  }
  return text;
}


function toUrl(base, rel) {
  if (!base || !rel) return "";
  const trimmedBase = base.replace(/\/$/, "");
  const trimmedRel = rel.replace(/^\//, "");
  return `${trimmedBase}/${trimmedRel}`;
}

async function updateEnv(values) {
  const envPath = path.resolve(".env");
  const content = await fs.readFile(envPath, "utf8");
  const lines = content.split(/\r?\n/);

  const keys = Object.keys(values);
  const next = lines.map((line) => {
    for (const key of keys) {
      if (line.startsWith(`${key}=`)) {
        return `${key}=${values[key]}`;
      }
    }
    return line;
  });

  const existingKeys = new Set(
    lines
      .filter((line) => line.includes("="))
      .map((line) => line.split("=")[0])
  );

  for (const key of keys) {
    if (!existingKeys.has(key)) {
      next.push(`${key}=${values[key]}`);
    }
  }

  await fs.writeFile(envPath, next.join("\n"), "utf8");
}

async function main() {
  const jsonPath = path.resolve(JSON_SOURCE_PATH);
  const raw = await fs.readFile(jsonPath, "utf8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("JSON contains no listings.");
  }

  const listing = LISTING_ID
    ? data.find((item) => String(item.id) === String(LISTING_ID))
    : data[data.length - 1];

  if (!listing) {
    throw new Error(`Listing not found for id: ${LISTING_ID}`);
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

  const images = Array.isArray(listing.images) ? listing.images : [];
  const fallbackImage = listing.image || images[0] || "";

  const imageRight = images[0] || fallbackImage;
  const imageTopLeft = images[1] || fallbackImage;
  const imageMidLeft = images[2] || fallbackImage;
  const imageBottomLeft = images[3] || fallbackImage;

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
  };

  await updateEnv(values);

  console.log(".env updated from JSON listing:", listing.id);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
