import fs from "node:fs/promises";
import Image from "@11ty/eleventy-img";
import extractExifData from "../utils/extractExifData.js";

export default async function photoShortcode(src, year, gallery) {
  const originalPath = `img/${year}/${gallery}/${src}`;
  const thumbOutputDir = `_site/img/${year}/${gallery}/thumbs`;
  const thumbUrlPath = `/img/${year}/${gallery}/thumbs/`;

  const metadata = await Image(originalPath, {
    widths: [300, 600, 1200, "auto"],
    formats: ["webp", "jpeg"],
    outputDir: thumbOutputDir,
    urlPath: thumbUrlPath,
    sharpOptions: {
      fit: "cover",
      position: "center",
      width: 600,
      height: 600,
    },
    sharpWebpOptions: { quality: 75 },
    sharpJpegOptions: { quality: 80 },
  });

  // ✅ Declare before usage
  let alt = "";
  let figcaptionHTML = "";
  let lightboxcaptionHTML = "";

  try {
    const buffer = await fs.readFile(originalPath);
    const { alt: extractedAlt, figcaption, lightboxcaption } =  extractExifData(buffer); // <-- await here
    alt = extractedAlt;
    figcaptionHTML = figcaption;
    lightboxcaptionHTML = lightboxcaption;
  } catch (err) {
    console.warn("EXIF extraction failed:", err);
  }

  const jpegMetadata = metadata.jpeg[metadata.jpeg.length - 1];
  const pswpWidth = jpegMetadata.width;
  const pswpHeight = jpegMetadata.height;

  const imageHTML = Image.generateHTML(metadata, {
    alt,
    loading: "lazy",
    decoding: "async",
    sizes: "300px",
  });

  const fullUrl = `/img/${year}/${gallery}/${src}`;

  return `<figure>
    <a href="${fullUrl}" data-pswp-width="${pswpWidth}" data-pswp-height="${pswpHeight}">
      ${imageHTML}
      ${lightboxcaptionHTML ? `<span class="pswp-caption-content">${lightboxcaptionHTML}</span>` : ""}  
    </a>
    ${figcaptionHTML ? `<figcaption>${figcaptionHTML}</figcaption>` : ""}
  </figure>`;
}