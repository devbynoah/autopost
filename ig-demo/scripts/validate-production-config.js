import { config } from "./runtime-config.js";
import fetch from "node-fetch";

const required = [
  "IG_USER_ID",
  "IG_ACCESS_TOKEN",
  "UPLOADCARE_PUBLIC_KEY",
  "JSON_SOURCE_PATH",
  "LISTING_BASE_URL",
];

const missing = required.filter((key) => !String(config[key] || "").trim());
if (missing.length > 0) {
  throw new Error(`Missing production configuration: ${missing.join(", ")}`);
}

if (
  config.UPLOADCARE_SIGNED_UPLOADS === "1" &&
  !String(config.UPLOADCARE_SECRET_KEY || "").trim()
) {
  throw new Error(
    "UPLOADCARE_SECRET_KEY is required when signed uploads are enabled."
  );
}

if (!/^https:\/\//i.test(config.LISTING_BASE_URL)) {
  throw new Error("LISTING_BASE_URL must be an HTTPS URL.");
}

if (!config.LISTING_ID && !config.LISTING_QUERY) {
  console.warn(
    "No LISTING_ID or LISTING_QUERY set; the latest listing will be selected."
  );
}

if (config.UPLOADCARE_SIGNED_UPLOADS !== "1") {
  console.warn(
    "Uploadcare signed uploads are disabled. Enable them for production."
  );
}

if (config.VALIDATE_REMOTE_CREDENTIALS !== "0") {
  const version = config.IG_API_VERSION || "v24.0";
  const params = new URLSearchParams({
    fields: "id,username",
    access_token: config.IG_ACCESS_TOKEN,
  });
  const response = await fetch(
    `https://graph.facebook.com/${version}/${config.IG_USER_ID}?${params}`
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Instagram credentials are invalid: ${message}`);
  }
  console.log("Instagram credentials are valid.");
}

console.log("Production configuration is valid.");
