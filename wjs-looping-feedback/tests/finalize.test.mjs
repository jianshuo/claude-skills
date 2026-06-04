import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const CLI = new URL("../assets/feedback-finalize.mjs", import.meta.url).pathname;

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "fb-"));
  writeFileSync(join(dir, "ledger.json"), JSON.stringify({ entries: [] }));
  writeFileSync(join(dir, "summary.txt"), "Increased H1 to 2.5rem");
  return dir;
}

test("record appends a deployed entry and writes the dashboard", () => {
  const dir = setup();
  const ledger = join(dir, "ledger.json");
  const out = join(dir, "_feedback", "index.html");
  execFileSync("node", [CLI, "record",
    "--repo", "jianshuo/site", "--issue", "7", "--author", "jianshuo",
    "--suggestion", "把标题改大", "--summary-file", join(dir, "summary.txt"),
    "--commit", "deadbeefcafe", "--ledger", ledger, "--out", out,
    "--now", "2026-06-02T00:00:00Z",
  ]);
  const saved = JSON.parse(readFileSync(ledger, "utf8"));
  assert.equal(saved.entries.length, 1);
  assert.deepEqual(
    { issue: saved.entries[0].issue, status: saved.entries[0].status, commit: saved.entries[0].commit, summary: saved.entries[0].summary },
    { issue: 7, status: "deployed", commit: "deadbeefcafe", summary: "Increased H1 to 2.5rem" }
  );
  assert.ok(existsSync(out));
  assert.match(readFileSync(out, "utf8"), /把标题改大/);
});

test("revert flips a recorded entry to reverted and rewrites the dashboard", () => {
  const dir = setup();
  const ledger = join(dir, "ledger.json");
  const out = join(dir, "_feedback", "index.html");
  writeFileSync(ledger, JSON.stringify({
    entries: [{ issue: 7, author: "jianshuo", suggestion: "s", summary: "x", commit: "deadbeef", status: "deployed", createdAt: "2026-06-02T00:00:00Z", updatedAt: "2026-06-02T00:00:00Z" }],
  }));
  execFileSync("node", [CLI, "revert",
    "--repo", "jianshuo/site", "--issue", "7",
    "--ledger", ledger, "--out", out, "--now", "2026-06-02T01:00:00Z",
  ]);
  const saved = JSON.parse(readFileSync(ledger, "utf8"));
  assert.equal(saved.entries[0].status, "reverted");
  assert.match(readFileSync(out, "utf8"), /已回滚/);
});

test("record defaults createdAt/updatedAt when --now is omitted", () => {
  const dir = setup();
  const ledger = join(dir, "ledger.json");
  const out = join(dir, "_feedback", "index.html");
  execFileSync("node", [CLI, "record",
    "--repo", "a/b", "--issue", "1", "--author", "x",
    "--suggestion", "s", "--summary-file", join(dir, "summary.txt"),
    "--commit", "abc1234", "--ledger", ledger, "--out", out,
  ]);
  const saved = JSON.parse(readFileSync(ledger, "utf8"));
  assert.ok(saved.entries[0].createdAt, "createdAt should be set");
  assert.ok(saved.entries[0].updatedAt, "updatedAt should be set");
});

test("unknown command exits non-zero without needing a ledger", () => {
  assert.throws(() =>
    execFileSync("node", [CLI, "bogus"], { stdio: "pipe" })
  );
});
