import type { CapturedFile } from "../shared/review.js";
import { fileBytes } from "../git/state.js";

const maxBytes = 10 * 1024 * 1024;
const maxEdge = 8192;
const maxPixels = 24_000_000;

export type ImagePreview =
  | { ok: true; mime: string; width: number; height: number; bytes: Buffer }
  | { ok: false; status: number; reason: string };

function dimensions(bytes: Buffer): { mime: string; width: number; height: number } | null {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    if (bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii", 12, 16) !== "IHDR") return null;
    return { mime: "image/png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 10 && /^(GIF87a|GIF89a)$/.test(bytes.toString("ascii", 0, 6))) {
    return { mime: "image/gif", width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  if (
    bytes.length >= 25 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    const kind = bytes.toString("ascii", 12, 16);
    const chunkSize = bytes.readUInt32LE(16);
    if (chunkSize > bytes.length - 20) return null;
    if (kind === "VP8X" && chunkSize >= 10) {
      return {
        mime: "image/webp",
        width: bytes.readUIntLE(24, 3) + 1,
        height: bytes.readUIntLE(27, 3) + 1,
      };
    }
    if (kind === "VP8 " && chunkSize >= 10 && bytes.toString("hex", 23, 26) === "9d012a") {
      return {
        mime: "image/webp",
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
    }
    if (kind === "VP8L" && chunkSize >= 5 && bytes[20] === 0x2f) {
      return {
        mime: "image/webp",
        width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
        height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
      };
    }
    return null;
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda || marker === undefined) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker,
        )
      ) {
        if (length < 7) break;
        return {
          mime: "image/jpeg",
          width: bytes.readUInt16BE(offset + 5),
          height: bytes.readUInt16BE(offset + 3),
        };
      }
      offset += length;
    }
  }
  return null;
}

export function inspectImage(file: CapturedFile): ImagePreview {
  if (file.mode !== "100644" && file.mode !== "100755") {
    return { ok: false, status: 415, reason: "Symlinks and submodules cannot be previewed." };
  }
  if (Buffer.byteLength(file.content, file.encoding) > maxBytes) {
    return { ok: false, status: 413, reason: "Image exceeds the 10 MiB preview limit." };
  }
  const bytes = fileBytes(file);
  const image = dimensions(bytes);
  if (!image) return { ok: false, status: 415, reason: "Unsupported or invalid image format." };
  if (
    !image.width ||
    !image.height ||
    image.width > maxEdge ||
    image.height > maxEdge ||
    image.width * image.height > maxPixels
  ) {
    return {
      ok: false,
      status: 413,
      reason: "Image exceeds the preview dimension limit (8,192 px per side; 24 million pixels).",
    };
  }
  return { ok: true, ...image, bytes };
}
