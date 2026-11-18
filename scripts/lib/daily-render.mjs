export const escapeHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const safeUrl = (u) => (/^https?:\/\//.test(u) ? u : "#");

function renderItem(it) {
  const facts = (it.facts || [])
    .map((f) => `<li>${escapeHtml(f.text)}（${escapeHtml(f.source_date)}） <a class="open-link" href="${escapeHtml(safeUrl(f.source_url))}" target="_blank" rel="noreferrer">元記事を開く ↗</a></li>`)
    .join("");
  const summary = it.summary ? `<p class="why">${escapeHtml(it.summary)}</p>` : "";
  const impl = (it.implications || []).length
    ? `<ul>${it.implications.map((i) => `<li>${escapeHtml(i.text)} <span class="category-badge">${escapeHtml(i.confidence === "likely" ? "有力" : "仮説")}</span></li>`).join("")}</ul>`
    : `<p class="muted">未作成（要約は未実行、または失敗）</p>`;
  return `<article class="article-card"><h2>${escapeHtml(it.headline)}</h2>${summary}<h4>Facts（事実）</h4><ul>${facts}</ul><h4>Implications（示唆）</h4>${impl}</article>`;
}

export function renderHtml(report) {
  const body = report.sections
    .map((s) => {
      const items = s.items.map(renderItem).join("\n");
      return `<section class="articles-section"><div class="section-heading"><p>${escapeHtml(s.label)}</p></div><div class="article-grid">${items || '<p class="muted">該当記事なし</p>'}</div></section>`;
    })
    .join("\n");
  const note = report.summarizedBy
    ? `<p class="muted">要約・示唆はAI（${escapeHtml(report.summarizedBy)}）が自動生成しました。事実の欄は元記事の情報のみで、示唆は仮説を含みます。</p>`
    : `<p class="muted">この日は事実のみの自動版です。</p>`;
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(report.title)}</title>
    <link rel="stylesheet" href="../styles.css" />
  </head>
  <body>
    <header class="topbar"><a class="brand" href="../"><span>Signal Shelf</span></a><p class="status">DAILY / ${escapeHtml(report.date)}</p></header>
    <main>
${note}
${body}
    </main>
  </body>
</html>
`;
}
