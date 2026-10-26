import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";

const feedsPath = new URL("../pages/data/feeds.json", import.meta.url);
const newsPath = new URL("../pages/data/news.json", import.meta.url);
const defaultMaxItems = 30;
const siteUrl = "https://ma-san229.github.io/personal-ai-news-hub/";
const archivesDir = new URL("../pages/archives/", import.meta.url);
const rssPath = new URL("../pages/rss.xml", import.meta.url);
const startedAt = new Date().toISOString();
const jstDate = (iso) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const normalizeUrl = (value) => { try { const url = new URL(value); [...url.searchParams.keys()].filter((key) => key.startsWith("utm_")).forEach((key) => url.searchParams.delete(key)); url.hash = ""; return url.toString(); } catch { return value; } };
const escapeXml = (value) => String(value ?? "").replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]);
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true });
const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
const text = (value) => typeof value === "string" || typeof value === "number" ? String(value) : value && typeof value === "object" ? String(value["#text"] ?? value.__cdata ?? "") : "";
const articleId = (value) => createHash("sha256").update(value).digest("hex").slice(0, 24);
const atomLink = (entry) => asArray(entry.link).find((link) => !link["@_rel"] || link["@_rel"] === "alternate")?.["@_href"] ?? "";
const toDate = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); };

function parseFeed(xml, feed) {
  const document = parser.parse(xml);
  const atomEntries = asArray(document.feed?.entry);
  const rssEntries = asArray(document.rss?.channel?.item ?? document["rdf:RDF"]?.item);
  const entries = atomEntries.length ? atomEntries.map((entry) => ({
    title: text(entry.title), url: atomLink(entry), publishedAt: toDate(text(entry.published) || text(entry.updated)), description: text(entry.summary) || text(entry.content),
  })) : rssEntries.map((entry) => ({
    title: text(entry.title), url: text(entry.link) || text(entry.guid), publishedAt: toDate(text(entry.pubDate) || text(entry["dc:date"]) || text(entry.date)), description: text(entry.description),
  }));
  return entries.filter((entry) => entry.title && /^https?:\/\//.test(entry.url)).map((entry) => ({ ...entry, url: normalizeUrl(entry.url) })).map((entry) => ({ id: articleId(entry.url), ...entry, collectedAt: startedAt, sourceName: feed.name, category: feed.category, feedId: feed.id }));
}

const feedsData = JSON.parse(await readFile(feedsPath, "utf8"));
const previous = JSON.parse(await readFile(newsPath, "utf8"));
const collected = [];
for (const feed of feedsData.feeds) {
  if (!feed.enabled || !feed.url) continue;
  try {
    const response = await fetch(feed.url, { headers: { "User-Agent": "Signal-Shelf-RSS-Collector/1.0 (+https://github.com/)" }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parseFeed(await response.text(), feed).sort((x, y) => new Date(y.publishedAt || 0) - new Date(x.publishedAt || 0));
    collected.push(...parsed.slice(0, feed.maxItems ?? defaultMaxItems));
    feed.lastFetchedAt = new Date().toISOString(); feed.lastStatus = "success";
  } catch (error) {
    feed.lastFetchedAt = new Date().toISOString(); feed.lastStatus = `error: ${error instanceof Error ? error.message : "unknown"}`;
    console.warn(`Failed to collect ${feed.name}:`, error);
  }
}
const combined = new Map();
for (const article of [...collected, ...(previous.articles || [])]) combined.set(article.id, article);
const articles = [...combined.values()].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)).slice(0, 1200);
await writeFile(newsPath, `${JSON.stringify({ updatedAt: new Date().toISOString(), articles }, null, 2)}\n`);
await writeFile(feedsPath, `${JSON.stringify(feedsData, null, 2)}\n`);
console.log(JSON.stringify({ collected: collected.length, stored: articles.length, activeFeeds: feedsData.feeds.filter((feed) => feed.enabled).length }));

await mkdir(archivesDir, { recursive: true });
const byDay = new Map();
for (const article of combined.values()) if (article.collectedAt) byDay.set(jstDate(article.collectedAt), [...(byDay.get(jstDate(article.collectedAt)) ?? []), article]);
for (const [date, dayArticles] of byDay) {
  const file = new URL(`${date}.json`, archivesDir);
  const existing = await readFile(file, "utf8").then((body) => JSON.parse(body).articles ?? [], () => []);
  const merged = new Map();
  for (const article of [...dayArticles, ...existing]) merged.set(article.id, article);
  const list = [...merged.values()].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  await writeFile(file, `${JSON.stringify({ date, updatedAt: startedAt, articles: list }, null, 2)}\n`);
}
const days = [];
for (const name of (await readdir(archivesDir)).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).sort().reverse()) {
  const body = JSON.parse(await readFile(new URL(name, archivesDir), "utf8"));
  days.push({ date: body.date, count: body.articles.length });
}
await writeFile(new URL("index.json", archivesDir), `${JSON.stringify({ updatedAt: startedAt, days }, null, 2)}\n`);
const rssItems = articles.filter((article) => ["ai_seitaishi", "engineer"].includes(article.category) && new Date(article.publishedAt || 0) <= new Date()).slice(0, 50).map((article) => `    <item>\n      <title>${escapeXml(article.title)}</title>\n      <link>${escapeXml(article.url)}</link>\n      <guid isPermaLink="true">${escapeXml(article.url)}</guid>\n${article.publishedAt ? `      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>\n` : ""}      <source url="${escapeXml(siteUrl)}">${escapeXml(article.sourceName)}</source>\n    </item>`).join("\n");
await writeFile(rssPath, `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>Signal Shelf — Personal AI News</title>\n    <link>${siteUrl}</link>\n    <description>AI・エンジニア向けニュースの最新50件</description>\n    <language>ja</language>\n    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n${rssItems}\n  </channel>\n</rss>\n`);
