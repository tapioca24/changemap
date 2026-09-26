import { expect, test } from "vitest";
import { capturedFile } from "../src/git/state.js";
import { inspectImage } from "../src/server/image-preview.js";

function png(width: number, height: number) {
  const bytes = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

test("detects supported image formats by bytes regardless of filename or UTF-8 classification", () => {
  const jpeg = Buffer.from("ffd8ffe000044a46ffc00008080010002000", "hex");
  const gif = Buffer.from("47494638396120001000", "hex");
  const webp = Buffer.alloc(30);
  webp.write("RIFF", 0);
  webp.write("WEBP", 8);
  webp.write("VP8X", 12);
  webp.writeUInt32LE(10, 16);
  webp.writeUIntLE(31, 24, 3);
  webp.writeUIntLE(15, 27, 3);
  for (const [bytes, mime, width, height] of [
    [png(32, 16), "image/png", 32, 16],
    [jpeg, "image/jpeg", 32, 16],
    [gif, "image/gif", 32, 16],
    [webp, "image/webp", 32, 16],
  ] as const) {
    expect(inspectImage(capturedFile("100644", bytes))).toMatchObject({
      ok: true,
      mime,
      width,
      height,
    });
  }
});

test("rejects unsupported modes, oversized bytes, dimensions and malformed headers", () => {
  expect(inspectImage(capturedFile("120000", png(32, 16)))).toMatchObject({
    ok: false,
    status: 415,
  });
  expect(inspectImage(capturedFile("160000", png(32, 16)))).toMatchObject({
    ok: false,
    status: 415,
  });
  expect(inspectImage(capturedFile("100644", Buffer.alloc(10 * 1024 * 1024 + 1)))).toMatchObject({
    ok: false,
    status: 413,
  });
  expect(inspectImage(capturedFile("100644", png(8193, 1)))).toMatchObject({
    ok: false,
    status: 413,
  });
  expect(inspectImage(capturedFile("100644", png(6000, 4001)))).toMatchObject({
    ok: false,
    status: 413,
  });
  expect(inspectImage(capturedFile("100644", Buffer.from("<svg></svg>")))).toMatchObject({
    ok: false,
    status: 415,
  });
  expect(inspectImage(capturedFile("100644", png(32, 16).subarray(0, 19)))).toMatchObject({
    ok: false,
    status: 415,
  });
});
