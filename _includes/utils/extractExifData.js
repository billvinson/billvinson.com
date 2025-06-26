import ExifReader from "exifreader";

/**
 * Extracts and formats EXIF caption + camera data.
 * @param {Buffer} buffer - Image file buffer
 * @returns {{ alt: string, figcaption: string }} - alt text and <figcaption> HTML
 */
export default function extractExifData(buffer) {
  try {
    const tags = ExifReader.load(buffer);

    const rawCaption = tags?.ImageDescription?.description || "";
    const make = tags?.Make?.description || "";
    const model = tags?.Model?.description || "";
    const lens = tags?.LensModel?.description || "";
    const exposure = tags?.ExposureTime?.description || "";
    const aperture = tags?.FNumber?.description || "";
    const iso = tags?.ISO?.description || "";

    // Clean alt text (no HTML)
    const alt = rawCaption.replace(/(<([^>]+)>)/gi, "").trim() || "";

    // figcaption HTML
    let figcaptionParts = [];
    if (rawCaption) figcaptionParts.push(rawCaption);

    const cameraParts = [];
    if (make || model) cameraParts.push(`${make} ${model}`.trim());
    if (lens) cameraParts.push(`Lens: ${lens}`);

    const settings = [];
    if (exposure) settings.push(exposure);
    if (aperture) settings.push(`f/${aperture}`);
    if (iso) settings.push(`ISO ${iso}`);
    if (settings.length > 0) cameraParts.push(settings.join(", "));

    if (cameraParts.length > 0) {
      figcaptionParts.push(`<small class="camera-info">${cameraParts.join(" • ")}</small>`);
    }

    return {
      alt,
      figcaption: figcaptionParts.length > 0 ? figcaptionParts.join("\n") : "",
    };
  } catch {
    return {
      alt: "",
      figcaption: "",
    };
  }
}