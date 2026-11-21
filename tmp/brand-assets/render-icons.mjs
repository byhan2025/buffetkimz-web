import sharp from "sharp";
import fs from "node:fs";
const svg = fs.readFileSync("public/favicon.svg");
const out = "tmp/brand-assets";
for (const size of [512, 180, 32, 16]) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(`${out}/icon-${size}.png`);
}
// contact sheet: 512 on cream, navy, white
const bg = fs.readFileSync(`${out}/icon-512.png`);
for (const [name, color] of [["cream", "#faf7ef"], ["navy", "#0b1428"], ["white", "#ffffff"]]) {
  await sharp({ create: { width: 560, height: 560, channels: 4, background: color } })
    .composite([{ input: bg, left: 24, top: 24 }])
    .png()
    .toFile(`${out}/icon-512-on-${name}.png`);
}
// small sizes upscaled 6x nearest for inspection
for (const s of [16, 32]) {
  const buf = await sharp(fs.readFileSync(`${out}/icon-${s}.png`)).resize(s * 8, s * 8, { kernel: "nearest" }).png().toBuffer();
  await sharp({ create: { width: s * 8 + 40, height: s * 8 + 40, channels: 4, background: "#faf7ef" } })
    .composite([{ input: buf, left: 20, top: 20 }])
    .png()
    .toFile(`${out}/icon-${s}-zoom.png`);
}
console.log("ok");
