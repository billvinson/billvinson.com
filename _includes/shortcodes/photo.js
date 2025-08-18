import fs from "node:fs/promises";
import Image from "@11ty/eleventy-img";
import path from "path";
import extractExifData from "../utils/extractExifData.js";

export default async function photoShortcode(src, year = null, gallery = null, imageClassName = null, imageOnly = false) {
  let alt = "";
  let figcaptionHTML = "";
  let lightboxcaptionHTML = "";
  let fullUrl = ""

  // Determine paths
  let fullPath, publicPath, thumbPath, thumbUrl;

  // console.log(`Processing content from ${this.page.inputPath}`)
  if (year && gallery) {
    // console.log(`Gallery mode for: ${src}`)
    fullPath = `img/${year}/${gallery}/${src}`;
    thumbPath = `_site/img/${year}/${gallery}/thumbs/${src}`;
    publicPath = `/img/${year}/${gallery}/${src}`;
    thumbUrl = `/img/${year}/${gallery}/thumbs/${src}`;
    fullUrl = `/img/${year}/${gallery}/${src}`;
  } else {
    console.log(`Blog post mode for: ${src}`)
    const postInputPath = this.page.inputPath; // e.g. content/blog/my-post/post.md
    console.log(postInputPath);
    const postFolder = path.dirname(postInputPath).replace(/^.\/content/, "").replace(/\\/g, "/");
    console.log(`POST FOLDER = ${postFolder}`);
    fullPath = path.join("content", postFolder, src);
    console.log(`PUBLIC PATH = ${fullPath}`);
    publicPath = path.join(postFolder, src).replace(/\\/g, "/");
    console.log(`PUBLIC PATH = ${publicPath}`);

    const thumbDir = path.join(postFolder, "thumbs");
    // await fs.mkdir(thumbDir, { recursive: true });

    thumbPath = path.join('_site', thumbDir, src);
    thumbUrl = path.join(postFolder, "thumbs", src).replace(/\\/g, "/");
    fullUrl = path.join(postFolder, src).replace(/\\/g, "/");
  }

  const metadata = await Image(fullPath, {
    // widths: [300, 600, 1200, "auto"],
    widths: ["auto"],
    formats: ["webp", "jpeg"],
    outputDir: thumbPath,
    urlPath: thumbUrl,
    sharpOptions: {
      fit: "cover",
      position: "center",
      width: 600,
      height: 600,
    },
    sharpWebpOptions: { quality: 75 },
    sharpJpegOptions: { quality: 80 },
  });

  try {
    const buffer = await fs.readFile(fullPath);
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
    class: imageClassName,
    loading: "lazy",
    decoding: "async",
    // sizes: "300px",
  });

  if (imageOnly) {
    return `${imageHTML}`;
  }
  return `<div class="post-gallery" data-pswp-gallery="">
  <figure>
    <a href="${fullUrl}" data-pswp-width="${pswpWidth}" data-pswp-height="${pswpHeight}">
      ${imageHTML}
      ${lightboxcaptionHTML ? `<span class="pswp-caption-content">${lightboxcaptionHTML}</span>` : ""}  
    </a>
    ${figcaptionHTML ? `<figcaption>${figcaptionHTML}</figcaption>` : ""}
  </figure>
  </div>`;
}