// _includes/utils/renderImage.js
import fs from "node:fs/promises";
import path from "path";
import Image from "@11ty/eleventy-img";
import extractExifData from "./extractExifData.js";

// --- helpers ------------------------------------------------------------
async function fileExists(p) {
  try { await fs.access(p); return true; }
  catch { return false; }
}

async function resolvePaths(src, postFolder) {
  const isFilename = (str) => str === path.basename(str);
  if (!src) throw new Error("renderImage: 'src' is required");

  // absolute URL
  if (src.startsWith("/")) {
    const candidates = [src.replace(/^\//, ""), path.join("content", src.replace(/^\//, ""))];
    for (const cand of candidates) if (await fileExists(cand)) return { fullPath: cand, publicPath: src };
    throw new Error(`Could not find absolute "${src}"`);
  }

  // filename only
  if (isFilename(src)) {
    const cand = path.join("content", postFolder, src);
    if (await fileExists(cand)) return { fullPath: cand, publicPath: "/" + path.join(postFolder, src).replace(/\\/g, "/") };
    throw new Error(`Filename "${src}" not found. Tried: ${cand}`);
  }

  // relative path
  const candidates = [src, path.join("content", src)];
  for (const cand of candidates) {
    if (await fileExists(cand)) {
      let publicPath = cand.replace(/^content[\\/]/, "").replace(/\\/g, "/");
      if (!publicPath.startsWith("/")) publicPath = "/" + publicPath;
      return { fullPath: cand, publicPath };
    }
  }
  throw new Error(`Could not resolve path for "${src}"`);
}

// --- main renderer ------------------------------------------------------
export default async function renderImage({
  src,
  usage = 'standalone', // standalone, gallery, index
  pageInputPath = null,
  imageClassName = null,
  widths = [300, 600, 1600],
  imageOnly = false,
}) {
  const validUsageOptions = new Set(["standalone", "gallery", "index"]);
  if (!src) throw new Error("renderImage: src is required");
  if (!pageInputPath && typeof this !== "undefined" && this.page?.inputPath) pageInputPath = this.page.inputPath;
  if (!pageInputPath) throw new Error("renderImage: pageInputPath is required");
  if (!validUsageOptions.has(usage.toLocaleLowerCase())) {
    usage = 'standalone';
  }
  
  // const postFolder = path.dirname(pageInputPath).replace(/^\.?\/?content[\\/]?/, "").replace(/\\/g, "/");
  const postFolder = path.dirname(pageInputPath)
    .replace(/^\.?\/?content[\\/]/, "") // strip *any* leading ./content/
    .replace(/^content[\\/]/, "")       // strip plain content/ too
    .replace(/\\/g, "/");
  const resolved = await resolvePaths(src, postFolder);
  const { fullPath, publicPath } = await resolvePaths(src, postFolder);
  const outputDir = path.dirname(publicPath).replace(/^\//, '');
  const urlPath = path.join("/", outputDir);

  console.log("Processing: ", src);

  // --- EXIF data ---------------------------------------------------------
  let alt = "", figureCaptionHtml = "", lightboxCaptionHtml = "";
  try {
    const buffer = await fs.readFile(fullPath);
    const { alt: exAlt, figcaption, lightboxcaption } = extractExifData(buffer);
    if (exAlt) alt = exAlt;
    if (figcaption) figureCaptionHtml = figcaption;
    if (lightboxcaption) lightboxCaptionHtml = lightboxcaption;
  } catch (err) {
    console.warn("EXIF extraction failed:", err);
  }
  
  let displayImages, lightboxImage, imageHTML;
  if (usage.toLowerCase() != 'index' ) {
    let metadata = await Image(fullPath, {
      widths: widths,
      formats: ["jpeg"],
      outputDir: path.join("_site", outputDir),
      urlPath,
      sharpOptions: { withoutEnlargement: true },
      sharpJpegOptions: { quality: 80 },
    });

    let thumbnail = null;
    if (usage.toLocaleLowerCase() == 'standalone') {
      thumbnail = metadata.jpeg.find(img => img.width === 600) || metadata.jpeg[0];
    } else {
      thumbnail = metadata.jpeg.find(img => img.width === 300) || metadata.jpeg[0];
    }
    displayImages = [thumbnail];
    lightboxImage = metadata.jpeg[metadata.jpeg.length - 1]; // largest
    imageHTML = Image.generateHTML({jpeg: [thumbnail]}, {
      alt,
      class: imageClassName,
      loading: "lazy",
      decoding: "async",
    });
  } else {
    let metadata = await Image(fullPath, {
      widths: [150],
      formats: ["jpeg"],
      outputDir: path.join("_site", outputDir),
      urlPath,
      sharpOptions: { fit: "cover", position: "center", width: 150, height: 150 },
      sharpJpegOptions: { quality: 80 },
    });

    // console.log("thumbMeta:", JSON.stringify(thumbMeta, null, 2));
    if (!metadata.jpeg[0]) throw new Error(`Thumbnail JPEG not generated for ${fullPath}`);

    displayImages = [metadata.jpeg[0]];
    lightboxImage = metadata.jpeg[0];
    imageHTML = Image.generateHTML(metadata, {
      alt,
      class: imageClassName,
      loading: "lazy",
      decoding: "async",
      picture: false
    });
  }

  if (imageOnly) return imageHTML;

  return `<figure>
    <a href="${lightboxImage.url}" data-pswp-gallery="main" data-pswp-width="${lightboxImage.width}" data-pswp-height="${lightboxImage.height}">
      ${imageHTML}
      ${lightboxCaptionHtml ? `<span class="pswp-caption-content">${lightboxCaptionHtml}</span>` : ""}
    </a>
    ${figureCaptionHtml ? `<figcaption>${figureCaptionHtml}</figcaption>` : ""}
  </figure>`;
}