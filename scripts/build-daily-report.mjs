import { mkdir, readFile, writeFile } from "node:fs/promises";

// 日次レポート生成（AI APIなし）。pages/data/news.json の直近記事から、
// カテゴリ別の上位を選んで pages/daily/YYYY-MM-DD.{json,html} を出力する。
// 「示唆」は人またはAIが後から足す欄で、このスクリプトは作らない（事実だけを出す）。
// 構成の参考: mametech-news の daily-report（Facts / Implications）。コードは流用していない。

const root = new URL("../", import.meta.url);
const newsPath = new URL("pages/data/news.json", root);
const date = process.env.REPORT_DATE || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
const windowHours = Number(process.env.REPORT_WINDOW_HOURS || 36);
const perSection = Number(process.env.REPORT_ITEMS_PER_SECTION || 5);

const sections = [
  { id: "ai_seitaishi", label: "AI整体師向け" },
  { id: "engineer", label: "エンジニア向け" },
];

const escapeHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ymd = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });

const { articles = [] } = JSON.parse(await readFile(newsPath, "utf8"));
const since = Date.now() - windowHours * 3600 * 1000;
const recent = articles
  .filter((a) => a.publishedAt && new Date(a.publishedAt).getTime() >= since && /^https?:\/\//.test(a.url))
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

// 同じ収集元に偏らないよう、1つの収集元は各セクション2件まで。
const pick = (category) => {
  const perSource = new Map();
  const items = [];
  for (const a of recent.filter((x) => x.category === category)) {
    const n = perSource.get(a.sourceName) || 0;
    if (n >= 2) continue;
    perSource.set(a.sourceName, n + 1);
    items.push({
      headline: a.title.slice(0, 160),
      facts: [{ text: `${a.sourceName} が公開`, source_url: a.url, source_date: ymd(a.publishedAt) }],
      implications: [],
    });
    if (items.length >= perSection) break;
  }
  return items;
};

const report = {
  date,
  timezone: "Asia/Tokyo",
  title: `Signal Shelf 日次｜${date}`,
  sections: sections.map((s) => ({ id: s.id, label: s.label, items: pick(s.id) })),
  skipped: [],
};
for (const s of report.sections) if (s.items.length === 0) report.skipped.push(`${s.label}: 直近${windowHours}時間に該当記事なし`);

const body = report.sections.map((s) => {
  const items = s.items.map((it) => `<article class="article-card"><h2>${escapeHtml(it.headline)}</h2><h4>Facts（事実）</h4><ul>${it.facts.map((f) => `<li>${escapeHtml(f.text)}（${escapeHtml(f.source_date)}） <a class="open-link" href="${escapeHtml(f.source_url)}" target="_blank" rel="noreferrer">元記事を開く ↗</a></li>`).join("")}</ul><h4>Implications（示唆）</h4><p class="muted">未作成（事実のみの自動版です）</p></article>`).join("\n");
  return `<section class="articles-section"><div class="section-heading"><p>${escapeHtml(s.label)}</p></div><div class="article-grid">${items || "<p class=\"muted\">該当記事なし</p>"}</div></section>`;
}).join("\n");

const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(report.title)}</title>
    <link rel="stylesheet" href="../styles.css" />
  </head>
  <body>
    <header class="topbar"><a class="brand" href="../"><span>Signal Shelf</span></a><p class="status">DAILY / ${escapeHtml(date)}</p></header>
    <main>
${body}
    </main>
  </body>
</html>
`;

await mkdir(new URL("pages/daily/", root), { recursive: true });
await writeFile(new URL(`pages/daily/${date}.json`, root), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(new URL(`pages/daily/${date}.html`, root), html);
console.log(JSON.stringify({ date, sections: report.sections.map((s) => [s.id, s.items.length]) }));
