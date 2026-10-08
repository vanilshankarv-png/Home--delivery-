import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary } from "cloudinary";

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const localUploadDirectory = resolve(serverRoot, "uploads");
const fileExtensions = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/avif", ".avif"],
  ["application/pdf", ".pdf"]
]);

function cloudinaryConfigured() {
  const keys = [
    process.env.CLOUDINARY_CLOUD_NAME,
    process.env.CLOUDINARY_API_KEY,
    process.env.CLOUDINARY_API_SECRET
  ];
  if (keys.every(Boolean)) {
    cloudinary.config({
      cloud_name: keys[0],
      api_key: keys[1],
      api_secret: keys[2],
      secure: true
    });
    return true;
  }
  if (keys.some(Boolean)) {
    throw new Error("Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET together.");
  }
  return false;
}

function uploadToCloudinary(file, folder) {
  const mimeType = file.mimetype;
  const resourceType = mimeType === "application/pdf" ? "raw" : "image";
  const extension = fileExtensions.get(mimeType) || extname(file.originalname).toLowerCase();

  return new Promise((resolveUpload, rejectUpload) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `home-delivery/${folder}`, resource_type: resourceType, format: extension.slice(1) },
      (error, result) => {
        if (error) return rejectUpload(error);
        if (!result?.secure_url) return rejectUpload(new Error("Cloudinary did not return a file URL."));
        return resolveUpload(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
}

export async function storeUploadedFile(file, folder = "verification") {
  if (!file?.buffer) {
    throw new Error("An uploaded file is required.");
  }
  if (cloudinaryConfigured()) {
    return uploadToCloudinary(file, folder);
  }

  await mkdir(localUploadDirectory, { recursive: true });
  const extension = fileExtensions.get(file.mimetype);
  if (!extension) {
    const error = new Error("Unsupported upload content type.");
    error.statusCode = 415;
    throw error;
  }
  const fileName = `${randomUUID()}${extension}`;
  await writeFile(resolve(localUploadDirectory, fileName), file.buffer, { flag: "wx" });
  return `${process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`}/uploads/${fileName}`;
}

export default storeUploadedFile;
