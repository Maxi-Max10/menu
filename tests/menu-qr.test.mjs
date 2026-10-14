import { test } from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { publicMenuUrl, generateMenuQr } from "../lib/menu-qr.ts";

test("QR codes encode the permanent menu URL and can be scanned", async () => {
  const previousOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://menu-tan-one.vercel.app";
  try {
    for (const slug of ["cafe-del-parque", "restaurante-" + "a".repeat(48)]) {
      const url = publicMenuUrl(slug, "https://temporary-preview.vercel.app");
      assert.equal(url, `https://menu-tan-one.vercel.app/menu/${slug}`);
      const { png, svg } = await generateMenuQr(url);
      const image = PNG.sync.read(Buffer.from(png.split(",")[1], "base64"));
      assert.equal(image.width, 1200);
      assert.equal(image.height, 1200);
      const result = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
      assert.equal(result?.data, url);
      assert.match(svg, /<svg[\s>]/);
    }
  } finally {
    if (previousOrigin === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousOrigin;
  }
});

test("local QR generation uses the current site when no production URL is set", () => {
  const previousOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  try {
    assert.equal(publicMenuUrl("mi-cafeteria", "http://localhost:3000"), "http://localhost:3000/menu/mi-cafeteria");
  } finally {
    if (previousOrigin !== undefined) process.env.NEXT_PUBLIC_SITE_URL = previousOrigin;
  }
});
