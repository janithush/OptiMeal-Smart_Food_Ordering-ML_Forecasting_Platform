/**
 * image-sanitize.ts — client-side photo sanitizer.
 *
 * Strips hidden GPS/EXIF metadata from photo uploads using Canvas
 * re-encoding (per security spec). Use before uploading menu photos
 * or profile pictures:
 *
 *   const clean = await sanitizeImageFile(file);
 *
 * - Whitelist: JPEG, PNG, WebP only. Others throw.
 * - Limit: 5MB input. Larger throws.
 * - Output: re-encoded image (same MIME when allowed, else JPEG)
 *   with EXIF/GPS stripped, max dimension 1920px.
 */
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIM = 1920;

export async function sanitizeImageFile(file: File): Promise<Blob> {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Image must be JPEG, PNG, or WebP");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image too large (max 5MB)");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  // Re-encode: drawing to canvas drops all EXIF/GPS metadata.
  const outType = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, outType, 0.92)
  );
  if (!blob) throw new Error("Image re-encode failed");
  return blob;
}
