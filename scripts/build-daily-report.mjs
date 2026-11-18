import { mkdir, readFile, writeFile } from "node:fs/promises";
import { renderHtml } from "./lib/daily-render.mjs";

// 日次レポート生成（AI APIなし）。pages/data/news.json の直近記事から、
// カテゴリ別の上位を選んで pages/daily/YYYY-MM-DD.{json,html} を出力する。
// すでに要約・示唆が付いた記事は、再生成しても引き継ぐ（summarize-daily.mjs が付ける）。
// 構成の参考: mametech-news の daily-report（Facts / Implications）。コードは流用していない。

const root = new URL("../", import.meta.url);
const newsPath = new URL("pages/data/news.json", root);
const date = process.env.REPORT_DATE || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
const jsonPath = new URL(`pages/daily/${date}.json`, root);
const windowHours = Number(process.env.REPORT_WINDOW_HOURS || 36);
const perSection = Number(process.env.REPORT_ITEMS_PER_SECTION || 5);

const sections = [
  { id: "ai_seitaishi", label: "AI整体師向け" },
  { id: "engineer", label: "エンジニア向け" },
];
const ymd = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });

const previous = await readFile(jsonPath, "utf8").then(JSON.parse).catch(() => null);
const carried = new Map();
for (const s of previous?.sections || []) {
  for (const it of s.items || []) {
    const url = it.facts?.[0]?.source_url;
    if (url && it.summary) carried.set(url, { summary: it.summary, implications: it.implications || [] });
  }
}

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
      headline: String(a.title).slice(0, 160),
      facts: [{ text: `${a.sourceName} が公開`, source_url: a.url, source_date: ymd(a.publishedAt) }],
      ...(carried.get(a.url) || { implications: [] }),
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
  ...(previous?.summarizedBy ? { summarizedBy: previous.summarizedBy } : {}),
};
for (const s of report.sections) if (s.items.length === 0) report.skipped.push(`${s.label}: 直近${windowHours}時間に該当記事なし`);

await mkdir(new URL("pages/daily/", root), { recursive: true });
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(new URL(`pages/daily/${date}.html`, root), renderHtml(report));
console.log(JSON.stringify({ date, sections: report.sections.map((s) => [s.id, s.items.length]) }));
