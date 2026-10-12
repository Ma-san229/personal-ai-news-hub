import { readFile, writeFile, rename } from "node:fs/promises";
import { readPublic, parseFeed } from "./research/safe-feed.mjs";
const feedsPath = new URL("../pages/data/feeds.json", import.meta.url);
const newsPath = new URL("../pages/data/news.json", import.meta.url);
async function save(url, value) {
  const temporary = new URL(`${url.href}.tmp`);
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, url);
}
const feedsData = JSON.parse(await readFile(feedsPath, "utf8"));
const previous = JSON.parse(await readFile(newsPath, "utf8"));
const collected = [];
for (const feed of feedsData.feeds) {
  if (!feed.enabled || !feed.url || feed.status === "stopped") continue;
  try {
    collected.push(...parseFeed(await readPublic(feed.url), feed));
    feed.lastFetchedAt = new Date().toISOString();
    feed.lastStatus = "success";
  } catch (error) {
    feed.lastFetchedAt = new Date().toISOString();
    feed.lastStatus = `error: ${error instanceof Error ? error.message : "unknown"}`;
    console.warn(`Failed to collect ${feed.id}: ${feed.lastStatus}`);
  }
}
const combined = new Map();
for (const article of [...(previous.articles || []), ...collected])
  combined.set(article.id, article);
const articles = [...combined.values()]
  .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
  .slice(0, 500);
await save(newsPath, { updatedAt: new Date().toISOString(), articles });
await save(feedsPath, feedsData);
console.log(
  JSON.stringify({
    collected: collected.length,
    stored: articles.length,
    activeFeeds: feedsData.feeds.filter(feed => feed.enabled).length,
  })
);
