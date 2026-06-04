import { existsSync } from "node:fs";
import { join } from "node:path";

export function detectSite(root) {
  const has = (f) => existsSync(join(root, f));
  const hugoConfig = has("hugo.toml") || has("hugo.yaml") || has("hugo.yml");
  const legacyHugo = (has("config.toml") || has("config.yaml")) &&
    (has("layouts") || has("themes") || has("archetypes"));
  if (hugoConfig || legacyHugo) return "hugo";
  if (has("next.config.js") || has("next.config.mjs") || has("next.config.ts")) return "nextjs";
  if (has("astro.config.mjs") || has("astro.config.ts")) return "astro";
  if (has("package.json")) return "node";
  if (has("index.html")) return "static";
  return "unknown";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(detectSite(process.argv[2] ?? process.cwd()));
}
