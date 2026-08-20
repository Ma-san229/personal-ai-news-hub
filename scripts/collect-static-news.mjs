import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";

const feedsPath = new URL("../pages/data/feeds.json", import.meta.url);
const newsPath = new URL("../pages/data/news.json", import.meta.url);
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
    title: text(entry.title), url: text(entry.link) || text(entry.guid), publishedAt: toDate(text(entry.pubDate) || text(entry.date)), description: text(entry.description),
  }));
  return entries.filter((entry) => entry.title && /^https?:\/\//.test(entry.url)).map((entry) => ({ id: articleId(entry.url), ...entry, sourceName: feed.name, category: feed.category, feedId: feed.id }));
}

const feedsData = JSON.parse(await readFile(feedsPath, "utf8"));
const previous = JSON.parse(await readFile(newsPath, "utf8"));
const collected = [];
for (const feed of feedsData.feeds) {
  if (!feed.enabled || !feed.url) continue;
  try {
    const response = await fetch(feed.url, { headers: { "User-Agent": "Signal-Shelf-RSS-Collector/1.0 (+https://github.com/)" }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    collected.push(...parseFeed(await response.text(), feed));
    feed.lastFetchedAt = new Date().toISOString(); feed.lastStatus = "success";
  } catch (error) {
    feed.lastFetchedAt = new Date().toISOString(); feed.lastStatus = `error: ${error instanceof Error ? error.message : "unknown"}`;
    console.warn(`Failed to collect ${feed.name}:`, error);
  }
}
const combined = new Map();
for (const article of [...collected, ...(previous.articles || [])]) combined.set(article.id, article);
const articles = [...combined.values()].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)).slice(0, 500);
await writeFile(newsPath, `${JSON.stringify({ updatedAt: new Date().toISOString(), articles }, null, 2)}\n`);
await writeFile(feedsPath, `${JSON.stringify(feedsData, null, 2)}\n`);
console.log(JSON.stringify({ collected: collected.length, stored: articles.length, activeFeeds: feedsData.feeds.filter((feed) => feed.enabled).length }));
