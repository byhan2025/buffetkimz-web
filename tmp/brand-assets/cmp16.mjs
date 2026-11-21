import sharp from "sharp";
import fs from "node:fs";
for (const n of ["plain","crisp"]) {
  const buf = fs.readFileSync(`tmp/brand-assets/v-${n}.svg`);
  await sharp(buf,{density:600}).resize(16,16).png().toFile(`tmp/brand-assets/i16-${n}.png`);
  const up = await sharp(fs.readFileSync(`tmp/brand-assets/i16-${n}.png`)).resize(160,160,{kernel:"nearest"}).png().toBuffer();
  await sharp({create:{width:200,height:200,channels:4,background:"#faf7ef"}}).composite([{input:up,left:20,top:20}]).png().toFile(`tmp/brand-assets/i16-${n}-zoom.png`);
}
console.log("ok");
