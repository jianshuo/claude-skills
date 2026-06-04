import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIssueUrl } from "../assets/feedback-lib.mjs";

test("buildIssueUrl builds a prefilled issue url with label/title/body", () => {
  const url = buildIssueUrl({ repo: "jianshuo/site", label: "feedback", title: "建议", body: "把标题改大" });
  assert.match(url, /^https:\/\/github\.com\/jianshuo\/site\/issues\/new\?/);
  const q = new URL(url).searchParams;
  assert.equal(q.get("labels"), "feedback");
  assert.equal(q.get("title"), "建议");
  assert.equal(q.get("body"), "把标题改大");
});

test("buildIssueUrl throws without repo", () => {
  assert.throws(() => buildIssueUrl({ label: "feedback" }), /repo is required/);
});

import { appendEntry, markReverted } from "../assets/feedback-lib.mjs";

test("appendEntry adds an entry immutably", () => {
  const ledger = { entries: [] };
  const next = appendEntry(ledger, { issue: 1, status: "deployed" });
  assert.equal(next.entries.length, 1);
  assert.equal(next.entries[0].issue, 1);
  assert.equal(ledger.entries.length, 0);
});

test("appendEntry tolerates a ledger with no entries array", () => {
  const next = appendEntry({}, { issue: 2 });
  assert.deepEqual(next.entries.map((e) => e.issue), [2]);
});

test("markReverted flips the matching entry status and stamps updatedAt", () => {
  const ledger = { entries: [{ issue: 5, status: "deployed", updatedAt: "old" }] };
  const next = markReverted(ledger, 5, "2026-06-02T00:00:00Z");
  assert.equal(next.entries[0].status, "reverted");
  assert.equal(next.entries[0].updatedAt, "2026-06-02T00:00:00Z");
});

test("markReverted leaves non-matching entries alone", () => {
  const ledger = { entries: [{ issue: 5, status: "deployed" }] };
  const next = markReverted(ledger, 99, "2026-06-02T00:00:00Z");
  assert.equal(next.entries[0].status, "deployed");
});

import { renderDashboard } from "../assets/feedback-lib.mjs";

const SAMPLE = {
  entries: [
    {
      issue: 12, author: "jianshuo",
      suggestion: "把首页标题改大 <b>", summary: "Increased H1 to 2.5rem",
      commit: "abc1234def", status: "deployed",
      createdAt: "2026-06-02T10:00:00Z", updatedAt: "2026-06-02T10:01:00Z",
    },
  ],
};

test("renderDashboard shows the suggestion, commit link, status and a revert link", () => {
  const html = renderDashboard(SAMPLE, { repo: "jianshuo/site" });
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /noindex/);
  assert.match(html, /把首页标题改大 &lt;b&gt;/);
  assert.match(html, /commit\/abc1234def/);
  assert.match(html, /abc1234/);
  assert.match(html, /已上线/);
  assert.match(html, /issues\/new\?labels=revert/);
  assert.match(html, /revert%3A\+%2312/);
});

test("renderDashboard renders empty ledger without throwing", () => {
  const html = renderDashboard({ entries: [] }, { repo: "a/b" });
  assert.match(html, /反馈台账/);
});

test("markReverted tolerates a ledger with no entries array", () => {
  const next = markReverted({}, 1, "2026-01-01T00:00:00Z");
  assert.deepEqual(next.entries, []);
});

test("renderDashboard hides the revert link for non-deployed entries", () => {
  const ledger = { entries: [{ issue: 3, suggestion: "s", summary: "x", commit: "abc1234", status: "queued" }] };
  const html = renderDashboard(ledger, { repo: "a/b" });
  assert.doesNotMatch(html, /回滚<\/a>/);
});

test("renderDashboard escapes a malicious issue value", () => {
  const ledger = { entries: [{ issue: "<script>", suggestion: "s", summary: "x", commit: "abc1234", status: "deployed" }] };
  const html = renderDashboard(ledger, { repo: "a/b" });
  assert.doesNotMatch(html, /<script>/);
});

test("buildIssueUrl omits the query string when no params given", () => {
  assert.equal(buildIssueUrl({ repo: "a/b" }), "https://github.com/a/b/issues/new");
});
