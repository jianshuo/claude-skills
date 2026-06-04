export function buildIssueUrl({ repo, label, title, body = "" } = {}) {
  if (!repo) throw new Error("repo is required, e.g. 'owner/name'");
  const params = new URLSearchParams();
  if (label) params.set("labels", label);
  if (title) params.set("title", title);
  if (body) params.set("body", body);
  const qs = params.toString();
  return `https://github.com/${repo}/issues/new${qs ? "?" + qs : ""}`;
}

export function appendEntry(ledger, entry) {
  return { ...ledger, entries: [...(ledger.entries ?? []), entry] };
}

export function markReverted(ledger, issueNum, at) {
  return {
    ...ledger,
    entries: (ledger.entries ?? []).map((e) =>
      e.issue === issueNum ? { ...e, status: "reverted", updatedAt: at } : e
    ),
  };
}

const STATUS_LABEL = {
  queued: "排队中", working: "处理中", deployed: "已上线",
  failed: "失败", reverted: "已回滚",
};

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

export function renderDashboard(ledger, { repo }) {
  const rows = (ledger.entries ?? [])
    .slice()
    .reverse()
    .map((e) => {
      const repoPath = repo.split("/").map(encodeURIComponent).join("/");
      const commitCell = e.commit
        ? `<a href="https://github.com/${repoPath}/commit/${escapeHtml(e.commit)}">${escapeHtml(String(e.commit).slice(0, 7))}</a>`
        : "—";
      const revertUrl = buildIssueUrl({
        repo,
        label: "revert",
        title: `revert: #${e.issue}`,
        body: `回滚 #${e.issue} 引入的改动（commit ${e.commit ?? "?"}）。`,
      });
      const canRevert = e.commit && e.status === "deployed";
      const revertCell = canRevert ? `<a href="${revertUrl}">回滚</a>` : "—";
      return `<tr>
      <td>#${escapeHtml(e.issue)}</td>
      <td>${escapeHtml(e.suggestion)}</td>
      <td>${escapeHtml(e.summary)}</td>
      <td>${commitCell}</td>
      <td>${STATUS_LABEL[e.status] ?? escapeHtml(e.status)}</td>
      <td>${escapeHtml(e.updatedAt ?? e.createdAt ?? "")}</td>
      <td>${revertCell}</td>
    </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="zh"><head><meta charset="utf-8">
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>反馈台账</title>
<style>
body{font:16px/1.6 system-ui,-apple-system,sans-serif;max-width:1000px;margin:2rem auto;padding:0 1rem}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ddd;padding:.5rem;text-align:left;vertical-align:top}
th{background:#f6f6f6}
</style></head>
<body>
<h1>反馈台账</h1>
<p>每条访客建议从提交到上线的记录。新建议出现在最上面。</p>
<table><thead><tr>
<th>#</th><th>建议</th><th>Claude 做了什么</th><th>commit</th><th>状态</th><th>更新时间</th><th>操作</th>
</tr></thead><tbody>
${rows}
</tbody></table>
</body></html>`;
}
