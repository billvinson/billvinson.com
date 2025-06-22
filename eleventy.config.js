import { IdAttributePlugin, InputPathToUrlTransformPlugin, HtmlBasePlugin } from "@11ty/eleventy";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";
import pluginSyntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import pluginNavigation from "@11ty/eleventy-navigation";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import youtubeEmbed from "eleventy-plugin-youtube-embed";
import pluginFilters from "./_config/filters.js";
import yaml from "js-yaml";

import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import ExifReader from "exifreader";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import metadata from './_data/metadata.js';

async function buildFigure(imgPath, inputPath, altOverride = "", useFigure = false) {
  const resolvedImagePath = path.resolve(path.dirname(inputPath), imgPath);
  const absoluteImagePath = path.resolve(__dirname, resolvedImagePath);
  const buffer = await fs.readFile(absoluteImagePath);

  const { width, height } = await sharp(buffer).metadata();
  const tags = ExifReader.load(buffer);
  const caption =
    altOverride ||
    tags?.ImageDescription?.description ||
    tags?.XPTitle?.description ||
    path.basename(imgPath);

  const url = "/" + path.relative("content", resolvedImagePath).replace(/\\/g, "/");

  return `
    <a href="${url}" data-pswp-width="${width}" data-pswp-height="${height}" data-pswp-title="${caption}">
      <img src="${url}" alt="${caption}" loading="lazy" width="${width}" height="${height}">
    </a>
  `;
}

/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default async function(eleventyConfig) {

	eleventyConfig.addFilter("keys", obj => Object.keys(obj));

	// Receives file contents, return parsed data
	eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));

			// Shortcode for single image
	eleventyConfig.addNunjucksAsyncShortcode("smartImage", async function (src, alt = "") {
		const html = await buildFigure(src, this.page.inputPath, alt, false); // false = no <figure>
		return `<div class="post-gallery" data-pswp-gallery>\n${html}\n</div>`;
	});

		// Shortcode for galleries
	eleventyConfig.addNunjucksAsyncShortcode("smartGallery", async function (images) {

		if (!images || !Array.isArray(images)) {
			console.warn("smartGallery: expected an array of image filenames, but got:", images);
			return "<!-- smartGallery: no images found -->";
		}

		const links = await Promise.all(
			images.map((img) => buildFigure(img, this.page.inputPath, "", false))
		);
		return `<div class="post-gallery" data-pswp-gallery>\n${links.join("\n")}\n</div>`;
	});

	// Drafts, see also _data/eleventyDataSchema.js
	eleventyConfig.addPreprocessor("drafts", "*", (data, content) => {
		if(data.draft && process.env.ELEVENTY_RUN_MODE === "build") {
			return false;
		}
	});

	// Copy the contents of the `public` folder to the output folder
	// For example, `./public/css/` ends up in `_site/css/`
	eleventyConfig
		.addPassthroughCopy({
			"./public/": "/"
		})
		.addPassthroughCopy("./content/feed/pretty-atom-feed.xsl")
		.addPassthroughCopy({ "node_modules/photoswipe/dist": "assets/photoswipe" })
		.addPassthroughCopy({ "node_modules/photoswipe-dynamic-caption-plugin/*.css": "assets/photoswipe-dynamic-caption-plugin" })
		.addPassthroughCopy({ "node_modules/photoswipe-dynamic-caption-plugin/dist": "assets/photoswipe-dynamic-caption-plugin" })
	  .addPassthroughCopy("content/blog/**/*.jpg");
	
	// Run Eleventy when these files change:
	// https://www.11ty.dev/docs/watch-serve/#add-your-own-watch-targets

	// Watch CSS files
	eleventyConfig.addWatchTarget("css/**/*.css");
	// Watch images for the image pipeline.
	eleventyConfig.addWatchTarget("content/**/*.{svg,webp,png,jpg,jpeg,gif}");

	// Per-page bundles, see https://github.com/11ty/eleventy-plugin-bundle
	// Bundle <style> content and adds a {% css %} paired shortcode
	eleventyConfig.addBundle("css", {
		toFileDirectory: "dist",
		// Add all <style> content to `css` bundle (use <style eleventy:ignore> to opt-out)
		// Supported selectors: https://www.npmjs.com/package/posthtml-match-helper
		bundleHtmlContentFromSelector: "style",
	});

	// Bundle <script> content and adds a {% js %} paired shortcode
	eleventyConfig.addBundle("js", {
		toFileDirectory: "dist",
		// Add all <script> content to the `js` bundle (use <script eleventy:ignore> to opt-out)
		// Supported selectors: https://www.npmjs.com/package/posthtml-match-helper
		bundleHtmlContentFromSelector: "script",
	});

	// Official plugins
	eleventyConfig.addPlugin(pluginSyntaxHighlight, {
		preAttributes: { tabindex: 0 }
	});
	eleventyConfig.addPlugin(pluginNavigation);
	eleventyConfig.addPlugin(HtmlBasePlugin);
	eleventyConfig.addPlugin(InputPathToUrlTransformPlugin);

	eleventyConfig.addPlugin(feedPlugin, {
		type: "atom", // or "rss", "json"
		outputPath: "/feed/feed.xml",
		stylesheet: "pretty-atom-feed.xsl",
		templateData: {
			eleventyNavigation: {
				key: "Feed",
				order: 4
			}
		},
		collection: {
			name: "posts",
			limit: 10,
		},
		metadata: {
			// Metadata is populated using values found in the _data/metadata.js file
			language: metadata.language,
			title: metadata.title,
			subtitle: metadata.description,
			base: metadata.url,
			author: {
				name: metadata.author.name
			}
		}
	});

	// Image optimization: https://www.11ty.dev/docs/plugins/image/#eleventy-transform
	eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
		// Output formats for each image.
		formats: ["avif", "webp", "auto"],

		// widths: ["auto"],

		failOnError: false,
		htmlOptions: {
			imgAttributes: {
				// e.g. <img loading decoding> assigned on the HTML tag will override these values.
				loading: "lazy",
				decoding: "async",
			}
		},

		sharpOptions: {
			animated: true,
		},
	});

	// Filters
	eleventyConfig.addPlugin(pluginFilters);

	eleventyConfig.addPlugin(IdAttributePlugin, {
		// by default we use Eleventy’s built-in `slugify` filter:
		// slugify: eleventyConfig.getFilter("slugify"),
		// selector: "h1,h2,h3,h4,h5,h6", // default
	});

	eleventyConfig.addShortcode("imageLightbox", function(src, alt = "", width = 1200, height = 800) {
    return `
			<div class="post-gallery">
				<a href="${src}" data-pswp-width="${width}" data-pswp-height="${height}" target="_blank" rel="noopener">
					<img src="${src}" alt="${alt}" loading="lazy">
				</a>
			</div>
    `;
  });

	eleventyConfig.addShortcode("currentBuildDate", () => {
		return (new Date()).toISOString();
	});

	// Features to make your build faster (when you need them)

	// If your passthrough copy gets heavy and cumbersome, add this line
	// to emulate the file copy on the dev server. Learn more:
	// https://www.11ty.dev/docs/copy/#emulate-passthrough-copy-during-serve

	// eleventyConfig.setServerPassthroughCopyBehavior("passthrough");

  eleventyConfig.addPlugin(youtubeEmbed, {
    // optional: plugin options
    privacyEnhanced: true // uses youtube-nocookie.com
  });
};

export const config = {
	// Control which files Eleventy will process
	// e.g.: *.md, *.njk, *.html, *.liquid
	templateFormats: [
		"md",
		"njk",
		"html",
		"liquid",
		"11ty.js",
	],

	// Pre-process *.md files with: (default: `liquid`)
	markdownTemplateEngine: "njk",

	// Pre-process *.html files with: (default: `liquid`)
	htmlTemplateEngine: "njk",

	// These are all optional:
	dir: {
		input: "content",          // default: "."
		includes: "../_includes",  // default: "_includes" (`input` relative)
		data: "../_data",          // default: "_data" (`input` relative)
		output: "_site"
	},

	// -----------------------------------------------------------------
	// Optional items:
	// -----------------------------------------------------------------

	// If your site deploys to a subdirectory, change `pathPrefix`.
	// Read more: https://www.11ty.dev/docs/config/#deploy-to-a-subdirectory-with-a-path-prefix

	// When paired with the HTML <base> plugin https://www.11ty.dev/docs/plugins/html-base/
	// it will transform any absolute URLs in your HTML to include this
	// folder name and does **not** affect where things go in the output folder.

	// pathPrefix: "/",
};
