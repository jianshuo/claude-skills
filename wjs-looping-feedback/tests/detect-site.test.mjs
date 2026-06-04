import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectSite } from "../scripts/detect-site.mjs";

function tmp() { return mkdtempSync(join(tmpdir(), "site-")); }

test("detects hugo by hugo.toml", () => {
  const d = tmp(); writeFileSync(join(d, "hugo.toml"), "");
  assert.equal(detectSite(d), "hugo");
});
test("detects hugo by config.toml + layouts/", () => {
  const d = tmp(); writeFileSync(join(d, "config.toml"), ""); mkdirSync(join(d, "layouts"));
  assert.equal(detectSite(d), "hugo");
});
test("detects nextjs", () => {
  const d = tmp(); writeFileSync(join(d, "next.config.mjs"), "");
  assert.equal(detectSite(d), "nextjs");
});
test("detects astro", () => {
  const d = tmp(); writeFileSync(join(d, "astro.config.mjs"), "");
  assert.equal(detectSite(d), "astro");
});
test("detects generic node by package.json", () => {
  const d = tmp(); writeFileSync(join(d, "package.json"), "{}");
  assert.equal(detectSite(d), "node");
});
test("detects plain static by index.html", () => {
  const d = tmp(); writeFileSync(join(d, "index.html"), "");
  assert.equal(detectSite(d), "static");
});
test("returns unknown otherwise", () => {
  assert.equal(detectSite(tmp()), "unknown");
});
