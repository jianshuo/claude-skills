#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { appendEntry, markReverted, renderDashboard } from "./feedback-lib.mjs";

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[++i];
    else out._.push(argv[i]);
  }
  return out;
}

function writeDashboard(ledger, repo, out) {
  const html = renderDashboard(ledger, { repo });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}

const a = parseArgs(process.argv.slice(2));
const cmd = a._[0];

if (cmd !== "record" && cmd !== "revert") {
  console.error(`unknown command: ${cmd}`);
  process.exit(1);
}

const now = a.now ?? new Date().toISOString();
const ledger = JSON.parse(readFileSync(a.ledger, "utf8"));

if (cmd === "record") {
  const summary = readFileSync(a["summary-file"], "utf8").trim();
  const next = appendEntry(ledger, {
    issue: Number(a.issue),
    author: a.author,
    suggestion: a.suggestion,
    summary,
    commit: a.commit,
    status: "deployed",
    createdAt: now,
    updatedAt: now,
  });
  writeFileSync(a.ledger, JSON.stringify(next, null, 2) + "\n");
  writeDashboard(next, a.repo, a.out);
} else {
  const next = markReverted(ledger, Number(a.issue), now);
  writeFileSync(a.ledger, JSON.stringify(next, null, 2) + "\n");
  writeDashboard(next, a.repo, a.out);
}
