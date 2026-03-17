import "dotenv/config";
import fetch from "node-fetch";

const {
  IG_USER_ID,
  IG_ACCESS_TOKEN,
  IMAGE_URL,
  CAPTION,
  IG_API_VERSION = "v24.0",
} = process.env;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing ${name}. Set it in .env`);
  }
}

requireEnv("IG_USER_ID", IG_USER_ID);
requireEnv("IG_ACCESS_TOKEN", IG_ACCESS_TOKEN);
requireEnv("IMAGE_URL", IMAGE_URL);

const caption = CAPTION ?? "Demo post vanuit Node (autopost)";

const baseUrl = `https://graph.facebook.com/${IG_API_VERSION}`;

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

  // Step 2: Publish container
  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: IG_ACCESS_TOKEN,
  });

  const publishRes = await fetch(
    `${baseUrl}/${IG_USER_ID}/media_publish?${publishParams}`,
    { method: "POST" }
  );

  const publishJson = await publishRes.json();
  if (!publishRes.ok) {
    throw new Error(`Publish failed: ${JSON.stringify(publishJson)}`);
  }

  console.log("Posted successfully:", publishJson);
}

postToInstagram().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});