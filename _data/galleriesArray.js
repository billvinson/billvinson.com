import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load and transform the YAML
const yamlPath = path.join(__dirname, "galleries.yaml");
const fileContents = fs.readFileSync(yamlPath, "utf8");
const galleries = yaml.load(fileContents);

export default function () {
  const output = [];

  for (const year in galleries) {
    for (const name in galleries[year]) {
      const images = galleries[year][name];
      const pageSize = 9;
      const totalPages = Math.ceil(images.length / pageSize);

      for (let i = 0; i < totalPages; i++) {
        output.push({
          year,
          name,
          page: i + 1,
          totalPages,
          images: images.slice(i * pageSize, (i + 1) * pageSize)
        });
      }
    }
  }

  return output;
}