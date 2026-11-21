import sharp from "sharp";
import fs from "node:fs";
// 16px 광학 보정본 — 고리 사이를 최소 1px 띄운다(같은 비율, 간격만 넓힘)
const rings = [
  { r: 6.25, w: 1.35, gapDeg: 24, start: 58, color: "#0a1a3c" },
  { r: 3.95, w: 1.35, gapDeg: 50, start: 48, color: "#1f4ffd" },
  { r: 1.85, w: 1.35, gapDeg: 86, start: 40, color: "#0a1a3c" },
];
const arc = (r, start, gap) => {
  const a0 = start, a1 = start + 360 - gap;
  const p = (deg) => [8 + r * Math.cos((deg * Math.PI) / 180), 8 - r * Math.sin((deg * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 0 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
const body = rings
  .map((g) => `<path d="${arc(g.r, g.start, g.gapDeg)}" fill="none" stroke="${g.color}" stroke-width="${g.w}" stroke-linecap="butt"/>`)
  .join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">${body}</svg>`;
fs.writeFileSync("tmp/brand-assets/v-optical16.svg", svg);
for (const d of [512, 2400]) {
  await sharp(Buffer.from(svg)).resize(d, d).png().toFile(`tmp/brand-assets/opt16-at${d}.png`);
}
const png = await sharp(Buffer.from(svg)).png().toFile("tmp/brand-assets/opt16-16.png");
const up = await sharp("tmp/brand-assets/opt16-16.png").resize(160, 160, { kernel: "nearest" }).png().toBuffer();
await sharp({ create: { width: 200, height: 200, channels: 4, background: "#faf7ef" } })
  .composite([{ input: up, left: 20, top: 20 }]).png().toFile("tmp/brand-assets/opt16-zoom.png");
console.log("ok");
