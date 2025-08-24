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
  pageInputPath = null,
  imageClassName = null,
  imageOnly = false,
  useThumbnail = false, // 150px square for index
}) {
  if (!src) throw new Error("renderImage: src is required");

  // --- resolve full path and public path ---------------------------------
  let fullPath, publicPath, outputDir, urlPath;

  if (!pageInputPath && typeof this !== "undefined" && this.page?.inputPath) pageInputPath = this.page.inputPath;
  if (!pageInputPath) throw new Error("renderImage: pageInputPath is required");

  // const postFolder = path.dirname(pageInputPath).replace(/^\.?\/?content[\\/]?/, "").replace(/\\/g, "/");
  const postFolder = path.dirname(pageInputPath)
    .replace(/^\.?\/?content[\\/]/, "") // strip *any* leading ./content/
    .replace(/^content[\\/]/, "")       // strip plain content/ too
    .replace(/\\/g, "/");
  const resolved = await resolvePaths(src, postFolder);

  fullPath   = resolved.fullPath;
  publicPath = resolved.publicPath;
  outputDir  = path.dirname(publicPath).replace(/^\//, '');
  urlPath    = path.dirname(publicPath);

  console.log("Processing:", src, urlPath, fullPath);

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

  // --- generate gallery/lightbox images ---------------------------------
  const uncropped = await Image(fullPath, {
    widths: [300, 600, 1600],
    formats: ["webp", "jpeg"],
    outputDir: path.join("_site", outputDir),
    urlPath,
    sharpOptions: { withoutEnlargement: true },
    sharpJpegOptions: { quality: 80 },
  });

  // --- generate thumbnail ------------------------------------------------
  // if (fullPath.includes("content")) {
  //   console.log('fullPath HAS content', fullPath)
  // }
  // if (urlPath.includes("content")) {
  //   console.log('urlPath HAS content', urlPath)    
  // }
  const thumbMeta = await Image(fullPath, {
    widths: [150],
    formats: ["jpeg"],
    outputDir: path.join("_site", outputDir),
    urlPath,
    sharpOptions: { fit: "cover", position: "center", width: 150, height: 150 },
    sharpJpegOptions: { quality: 80 },
  });

  // console.log("thumbMeta:", JSON.stringify(thumbMeta, null, 2));

  if (!thumbMeta.jpeg[0]) throw new Error(`Thumbnail JPEG not generated for ${fullPath}`);

  // --- pick display & lightbox images -----------------------------------
  let displayImages, lightboxImage, imageHTML;
  if (useThumbnail) {
    displayImages = [thumbMeta.jpeg[0]];
    lightboxImage = thumbMeta.jpeg[0];
    imageHTML = Image.generateHTML(thumbMeta, {
      alt,
      class: imageClassName,
      loading: "lazy",
      decoding: "async",
      picture: false
    });
  } else {
    const galleryJpeg = uncropped.jpeg.find(img => img.width === 300) || uncropped.jpeg[0];
    displayImages = [galleryJpeg];
    lightboxImage = uncropped.jpeg[uncropped.jpeg.length - 1]; // largest
    console.log(galleryJpeg)
    imageHTML = Image.generateHTML({jpeg: [galleryJpeg]}, {
      alt,
      class: imageClassName,
      loading: "lazy",
      decoding: "async",
    });
  }

  if (imageOnly) return imageHTML;

  // console.log('LightBoxImage', lightboxImage.url);
  // console.log('imageHtml', imageHTML);
  return `<figure>
    <a href="${lightboxImage.url}" data-pswp-gallery="main" data-pswp-width="${lightboxImage.width}" data-pswp-height="${lightboxImage.height}">
      ${imageHTML}
      ${lightboxCaptionHtml ? `<span class="pswp-caption-content">${lightboxCaptionHtml}</span>` : ""}
    </a>
    ${figureCaptionHtml ? `<figcaption>${figureCaptionHtml}</figcaption>` : ""}
  </figure>`;
}