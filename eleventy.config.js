import { IdAttributePlugin, InputPathToUrlTransformPlugin, HtmlBasePlugin } from "@11ty/eleventy";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";
import pluginSyntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import pluginNavigation from "@11ty/eleventy-navigation";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import youtubeEmbed from "eleventy-plugin-youtube-embed";
import pluginFilters from "./_config/filters.js";
import renderImage from "./_includes/utils/renderImage.js";
import metadata from './_data/metadata.js';
import path from "path";
import yaml from "js-yaml";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));


/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default async function(eleventyConfig) {
  // --- Thumb shortcode (150x150) ---
  eleventyConfig.addNunjucksAsyncShortcode("thumb", async function(src, imageClassName = "") {
    return await renderImage({
      src,
      imageClassName,
      pageInputPath: this.page.inputPath,
      imageOnly: true,
      useThumbnail: true, // force 150x150 cropped thumbnail
    });
  });

  // --- Photo shortcode (full gallery/lightbox) ---
  eleventyConfig.addNunjucksAsyncShortcode("photo", async function(src, imageClassName = "") {
    return await renderImage({
      src,
      imageClassName,
      imageOnly: false,
      useThumbnail: false, // full gallery/lightbox
      pageInputPath: this.page.inputPath
    });
  });

  // Optional: raw image only (no figure/lightbox)
  eleventyConfig.addNunjucksAsyncShortcode("imgOnly", async function(src, imageClassName = "") {
    return await renderImage({
      src,
      imageClassName,
      imageOnly: true,
      useThumbnail: false,
      pageInputPath: this.page.inputPath
    });
  });

  // gallery (calls photo many times)
  eleventyConfig.addNunjucksAsyncShortcode(
    "gallery",
    async function(images, year = null, gallery = null, imageClassName = null) {
      const rendered = await Promise.all(
        images.map(src =>
          renderImage({
            src,
            year,
            gallery,
            pageInputPath: this.page?.inputPath,
            imageClassName,
            imageOnly: false,
          })
        )
      );
      return `<div class="post-gallery" data-pswp-gallery="main">
        <div class="gallery-grid">
          ${rendered.join("\n")}
        </div>
      </div>`;
    }
  );

	eleventyConfig.addFilter("keys", obj => Object.keys(obj));

	// Receives file contents, return parsed data
	eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));

	// Drafts, see also _data/eleventyDataSchema.js
	eleventyConfig.addPreprocessor("drafts", "*", (data, content) => {
		if(data.draft && process.env.ELEVENTY_RUN_MODE === "build") {
			return false;
		}
	});

	// Used for galleries
	eleventyConfig.addFilter("groupBy", function (array, key) {
		const groups = {};
		array.forEach(function (item) {
			const val = item[key];
			if (!groups[val]) groups[val] = [];
			groups[val].push(item);
		});
		return Object.keys(groups).map(grouper => ({
			grouper,
			items: groups[grouper]
		}));
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

	// Filters
	eleventyConfig.addPlugin(pluginFilters);

	eleventyConfig.addPlugin(IdAttributePlugin, {
		// by default we use Eleventy’s built-in `slugify` filter:
		// slugify: eleventyConfig.getFilter("slugify"),
		// selector: "h1,h2,h3,h4,h5,h6", // default
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
