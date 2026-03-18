import "dotenv/config";
import fetch from "node-fetch";

const {
  IG_USER_ID,
  IG_ACCESS_TOKEN,
  IMAGE_URL,
  CAPTION,
  HEADER_LINE,
  LISTING_TITLE,
  ADDRESS,
  CITY,
  PRICE_EUR,
  AREA_M2,
  ROOMS,
  ENERGY_LABEL,
  LISTING_URL,
  CONTACT_PHONE,
  CONTACT_MOBILE,
  CONTACT_EMAIL,
  DESCRIPTION_TEXT,
  HASHTAGS,
  CTA_LINE,
  IG_API_VERSION = "v24.0",
  PUBLISH_RETRIES = "6",
  PUBLISH_WAIT_SECONDS = "5",
} = process.env;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing ${name}. Set it in .env`);
  }
}

requireEnv("IG_USER_ID", IG_USER_ID);
requireEnv("IG_ACCESS_TOKEN", IG_ACCESS_TOKEN);
requireEnv("IMAGE_URL", IMAGE_URL);

function formatPrice(value) {
  if (!value) return null;
  const digits = String(value).replace(/[^0-9]/g, "");
  if (!digits) return String(value).trim();
  const number = Number(digits);
  if (!Number.isFinite(number)) return String(value).trim();
  return new Intl.NumberFormat("nl-NL").format(number);
}

function buildCaption() {
  if (CAPTION && CAPTION.trim()) return CAPTION.trim();

  const headerLine = HEADER_LINE?.trim() || "🏡 Nieuw in verkoop!";
  const title = LISTING_TITLE?.trim();
  const address = ADDRESS?.trim();
  const city = CITY?.trim();
  const priceRaw = PRICE_EUR?.trim();
  const area = AREA_M2?.trim();
  const rooms = ROOMS?.trim();
  const label = ENERGY_LABEL?.trim();
  const url = LISTING_URL?.trim();
  const phone = "070-21 70 271";
  const mobile = CONTACT_MOBILE?.trim();
  const email = CONTACT_EMAIL?.trim() || "city@remax.nl";
  const hashtags = HASHTAGS?.trim() ||
    "#tekoop #woning #makelaar #luxewonen #nieuwaanbod #vastgoed";
  const cta = CTA_LINE?.trim() ||
    "Wilt u meer informatie ontvangen of een bezichtiging inplannen? Neem dan gerust contact met ons op, wij helpen u graag verder!";
  const description = DESCRIPTION_TEXT?.trim();

  const location = [address, city].filter(Boolean).join(", ");
  const priceFormatted = formatPrice(priceRaw);

  const detailLines = [];
  if (priceFormatted) detailLines.push(`💶 Vraagprijs: EUR ${priceFormatted}`);
  if (area) detailLines.push(`📐 Woonoppervlak: ${area} m2`);
  if (rooms) detailLines.push(`🛏️ Kamers: ${rooms}`);
  if (label) detailLines.push(`⚡ Energielabel: ${label}`);
  if (url) detailLines.push(`🔗 Bekijk de brochure: ${url}`);

  const lines = [
    headerLine,
    location ? `📍 ${location}` : null,
    ...detailLines,
    description ? "" : null,
    description || null,
    "",
    cta,
    "",
    phone ? `T: ${phone}` : null,
    mobile ? `M: ${mobile}` : null,
    email ? `E: ${email}` : null,
    "",
    hashtags,
  ];

  return lines
    .filter((line) => line !== null && line !== undefined)
    .join("\n");
}

const caption = buildCaption();

const baseUrl = `https://graph.facebook.com/${IG_API_VERSION}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function publishWithRetry(creationId) {
  const retries = Math.max(0, Number(PUBLISH_RETRIES));
  const waitMs = Math.max(1000, Number(PUBLISH_WAIT_SECONDS) * 1000);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const publishParams = new URLSearchParams({
      creation_id: creationId,
      access_token: IG_ACCESS_TOKEN,
    });

    const publishRes = await fetch(
      `${baseUrl}/${IG_USER_ID}/media_publish?${publishParams}`,
      { method: "POST" }
    );

    const publishJson = await publishRes.json();
    if (publishRes.ok) return publishJson;

    const isNotReady =
      publishJson?.error?.code === 9007 ||
      publishJson?.error?.error_subcode === 2207027;

    if (!isNotReady || attempt === retries) {
      throw new Error(`Publish failed: ${JSON.stringify(publishJson)}`);
    }

    console.log(
      `Media nog niet klaar, retry ${attempt + 1}/${retries} over ${
        waitMs / 1000
      }s...`
    );
    await sleep(waitMs);
  }
}

async function postToInstagram() {
  // Step 1: Create media container
  const createParams = new URLSearchParams({
    image_url: IMAGE_URL,
    caption,
    access_token: IG_ACCESS_TOKEN,
  });

  const createRes = await fetch(
    `${baseUrl}/${IG_USER_ID}/media?${createParams}`,
    { method: "POST" }
  );

  const createJson = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`Create media failed: ${JSON.stringify(createJson)}`);
  }

  const creationId = createJson.id;
  if (!creationId) {
    throw new Error("No creation_id returned.");
  }

  // Step 2: Publish container (with retry)
  const publishJson = await publishWithRetry(creationId);

  console.log("Posted successfully:", publishJson);
}

postToInstagram().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
