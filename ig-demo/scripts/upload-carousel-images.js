import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { Blob } from "buffer";

const {
  CAROUSEL_OUTPUT_DIR = "./output/carousel",
  UPLOADCARE_PUBLIC_KEY,
  UPLOADCARE_STORE = "1",
  UPLOADCARE_TRANSFORM = "-/format/jpg/",
  UPLOADCARE_FILENAME = "",
} = process.env;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing ${name}. Set it in .env`);
  }
}

async function updateEnvValue(key, value) {
  const envPath = path.resolve(".env");
  const content = await fs.readFile(envPath, "utf8");
  const lines = content.split(/\r?\n/);
  let replaced = false;

  const next = lines.map((line) => {
    const normalized = line.replace(/^\uFEFF/, "");
    if (normalized.startsWith(`${key}=`)) {
      if (!replaced) {
        replaced = true;
        return `${key}=${value}`;
      }
      return null;
    }
    return line;
  });

  if (!replaced) {
    next.push(`${key}=${value}`);
  }

  await fs.writeFile(
    envPath,
    next.filter((line) => line !== null).join("\n"),
    "utf8"
  );
}

async function uploadImage(filePath) {
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

  if (cdnUrl) {
    return `${cdnUrl.replace(/\/$/, "")}${cleanTransform}${cleanFilename}`;
  }

  return `https://1so6kc9c7w.ucarecd.net/${fileId.replace(
    /^\/+|\/+$/g,
    ""
  )}${cleanTransform}${cleanFilename}`;
}

async function main() {
  requireEnv("UPLOADCARE_PUBLIC_KEY", UPLOADCARE_PUBLIC_KEY);

  const outputDir = path.resolve(CAROUSEL_OUTPUT_DIR);
  let files = [];
  try {
    files = (await fs.readdir(outputDir))
      .filter((name) => /^photo-\d+\.jpg$/i.test(name))
      .sort()
      .map((name) => path.join(outputDir, name));
  } catch {
    files = [];
  }

  if (files.length === 0) {
    await updateEnvValue("CAROUSEL_IMAGE_URLS", "");
    console.log("No carousel images to upload.");
    return;
  }

  console.log(`Uploading ${files.length} carousel photo(s)...`);
  const urls = [];
  for (const file of files) {
    const url = await uploadImage(file);
    urls.push(url);
    console.log(`Uploaded carousel photo: ${url}`);
  }

  await updateEnvValue("CAROUSEL_IMAGE_URLS", urls.join(","));
  console.log(`CAROUSEL_IMAGE_URLS set with ${urls.length} photo(s).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
