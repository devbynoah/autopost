import fs from "fs/promises";
import path from "path";

const inputPath = process.argv[2];
const outputPath = process.env.JSON_SOURCE_PATH || "./aanbod/kolibri-aanbod.json";

if (!inputPath) {
  throw new Error("Usage: node scripts/import-listing-file.js <listing-json-file>");
}

function repairText(value) {
  if (typeof value === "string") {
    return value
      .replace(/mÂ²/g, "m²")
      .replace(/â‚¬/g, "€")
      .replace(/â€“/g, "–")
      .replace(/â€™/g, "’");
  }
  if (Array.isArray(value)) return value.map(repairText);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, repairText(item)])
    );
  }
  return value;
}

const input = JSON.parse(
  (await fs.readFile(path.resolve(inputPath), "utf8")).replace(/^\uFEFF/, "")
);
const listing = repairText(input);
const destination = path.resolve(outputPath);
const listings = JSON.parse(
  (await fs.readFile(destination, "utf8")).replace(/^\uFEFF/, "")
);

if (!Array.isArray(listings)) {
  throw new Error("The destination JSON must contain an array.");
}

const existingIndex = listings.findIndex(
  (item) => String(item.id) === String(listing.id)
);

if (existingIndex >= 0) {
  listings[existingIndex] = listing;
} else {
  listings.push(listing);
}

await fs.writeFile(destination, `${JSON.stringify(listings, null, 2)}\n`, "utf8");
console.log(
  `${existingIndex >= 0 ? "Updated" : "Added"} listing ${listing.id}: ${listing.title}`
);
