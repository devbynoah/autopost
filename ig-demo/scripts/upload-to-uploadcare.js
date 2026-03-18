import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { Blob } from "buffer";

const {
  OUTPUT_IMAGE_PATH = "./output/ig-card.jpg",
  UPLOADCARE_PUBLIC_KEY,
  UPLOADCARE_STORE = "1",
  UPLOADCARE_CDN_BASE = "https://ucarecdn.com",
  UPLOADCARE_TRANSFORM = "-/format/jpg/",
  UPLOADCARE_FILENAME = "",
} = process.env;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing ${name}. Set it in .env`);
  }
}

function buildCdnUrl(base, fileId, transform, filename) {
  const trimmedBase = base.replace(/\/$/, "");
  const cleanTransform = transform
    ? `/${transform.replace(/^\/+|\/+$/g, "")}/`
    : "/";
  const cleanFilename = filename ? filename.replace(/^\/+/, "") : "";
  return `${trimmedBase}/${fileId}${cleanTransform}${cleanFilename}`;
}

async function updateEnvImageUrl(url) {
  const envPath = path.resolve(".env");
  const content = await fs.readFile(envPath, "utf8");
  const lines = content.split(/\r?\n/);
  let replaced = false;
  const next = lines.map((line) => {
    const normalized = line.replace(/^\uFEFF/, "");
    if (normalized.startsWith("IMAGE_URL=")) {
      if (!replaced) {
        replaced = true;
        return `IMAGE_URL=${url}`;
      }
      return null;
    }
    return line;
  });
  if (!replaced) {
    next.unshift(`IMAGE_URL=${url}`);
  }
  await fs.writeFile(
    envPath,
    next.filter((line) => line !== null).join("\n"),
    "utf8"
  );
}

async function main() {
  requireEnv("UPLOADCARE_PUBLIC_KEY", UPLOADCARE_PUBLIC_KEY);
  console.log(`Upload start: ${new Date().toISOString()}`);

  const filePath = path.resolve(OUTPUT_IMAGE_PATH);
  const buffer = await fs.readFile(filePath);

  const form = new FormData();
  form.append("UPLOADCARE_PUB_KEY", UPLOADCARE_PUBLIC_KEY);
  form.append("UPLOADCARE_STORE", UPLOADCARE_STORE);
  form.append(
    "file",
    new Blob([buffer], { type: "image/jpeg" }),
    path.basename(filePath)
  );

  const res = await fetch("https://upload.uploadcare.com/base/", {
    method: "POST",
    body: form,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Upload failed: ${JSON.stringify(json)}`);
  }

  const fileId =
    json.file ||
    json.uuid ||
    Object.values(json).find((value) => typeof value === "string");
  if (!fileId) {
    throw new Error(`Upload response missing file id: ${JSON.stringify(json)}`);
  }

  // Try to fetch cdn_url once (may be empty right after upload)
  let cdnUrl = "";
  try {
    const infoForm = new FormData();
    infoForm.append("pub_key", UPLOADCARE_PUBLIC_KEY);
    infoForm.append("file_id", fileId);
    const infoRes = await fetch("https://upload.uploadcare.com/info/", {
      method: "POST",
      body: infoForm,
    });
    const infoJson = await infoRes.json();
    cdnUrl = infoJson?.cdn_url || "";
  } catch {}

  const cleanTransform = UPLOADCARE_TRANSFORM
    ? `/${UPLOADCARE_TRANSFORM.replace(/^\/+|\/+$/g, "")}/`
    : "/";
  const cleanFilename = UPLOADCARE_FILENAME
    ? UPLOADCARE_FILENAME.replace(/^\/+/, "")
    : "";
  let imageUrl = "";
  if (cdnUrl) {
    const base = cdnUrl.replace(/\/$/, "");
    imageUrl = `${base}${cleanTransform}${cleanFilename}`;
  } else {
    imageUrl = `https://1so6kc9c7w.ucarecd.net/${fileId.replace(/^\/+|\/+$/g, "")}/${cleanTransform}${cleanFilename}`.replace(
      /\/{2,}/g,
      "/"
    );
  }

  await updateEnvImageUrl(imageUrl);
  console.log(`Uploadcare URL set to: ${imageUrl}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
