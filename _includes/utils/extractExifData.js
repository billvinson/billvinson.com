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

    // Clean alt text (no HTML)
    const alt = (rawCaption).replace(/(<([^>]+)>)/gi, "").trim() || "";

    var captionHTML = ""
    var lightboxCaptionHTML = ""
    var captionText = ""
    var captionCamera = ""
    if (!make) { 
      console.log(`Skipping image with empty camera exif values`)
    } else if (make.toLowerCase() == 'epson') {
      console.log(`Skipping image with scanner exif values`)
    } else {
      // Construct left/right figcaption layout
      const cameraText = (make || model) ? `${make} ${model}`.trim() : "";
      captionCamera = `${cameraText ? `<span class="caption-camera"><i class="fa-solid fa-camera"></i> ${cameraText}</span>` : ""}`
    }
    if (rawCaption) {
      captionText = rawCaption
    }
    captionHTML = `<div class="caption">${captionText}</div>`.trim();
    lightboxCaptionHTML = `<span class="caption-text">${rawCaption}</span>${captionCamera}`.trim();

    return {
      alt,
      figcaption: captionHTML,
      lightboxcaption: lightboxCaptionHTML
    };
  } catch (error) {
    console.error("An error occurred:");
    console.error("Error message:", error.message); // Prints the specific error message
    console.error("Error name:", error.name);     // Prints the type of error (e.g., SyntaxError, TypeError)
    console.error("Error stack:", error.stack);   // Prints the call stack, useful for debugging

    return {
      alt: "",
      figcaption: "",
      lightboxcaption: ""
    };
  }
}