const sharp = require("sharp");
const pngToIco = require("png-to-ico").default || require("png-to-ico");
const fs = require("fs/promises");
const path = require("path");

async function resize(input, output, size) {
  await sharp(input)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(output);
}

async function main() {
  const publicDir = path.join(__dirname, "..", "public");
  const input = path.join(publicDir, "logo_no_bg.png");

  try {
    await fs.access(input);
  } catch (err) {
    console.error("Input file not found:", input);
    process.exit(1);
  }

  const outputs = [
    { name: "favicon-16x16.png", size: 16 },
    { name: "favicon-32x32.png", size: 32 },
    { name: "apple-touch-icon.png", size: 180 },
    { name: "android-chrome-192x192.png", size: 192 },
    { name: "android-chrome-512x512.png", size: 512 },
  ];

  for (const o of outputs) {
    const outPath = path.join(publicDir, o.name);
    console.log(`Generating ${o.name} (${o.size}x${o.size})`);
    await resize(input, outPath, o.size);
  }

  // create favicon.ico from 16 and 32
  try {
    const png16 = await fs.readFile(path.join(publicDir, "favicon-16x16.png"));
    const png32 = await fs.readFile(path.join(publicDir, "favicon-32x32.png"));
    const ico = await pngToIco([png16, png32]);
    await fs.writeFile(path.join(publicDir, "favicon.ico"), ico);
    console.log("Generated favicon.ico");
  } catch (err) {
    console.error("Failed to create favicon.ico:", err);
  }

  console.log("All icons generated in /public");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
