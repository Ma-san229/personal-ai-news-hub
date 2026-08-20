import { XMLParser } from "fast-xml-parser";
import { lookup } from "node:dns/promises";
import { createHash } from "node:crypto";
import type { NewsCategory } from "../drizzle/schema";
import * as db from "./db";

type FeedItem = Record<string, unknown>;

export const INITIAL_NEWS_FEEDS: Array<{
  name: string;
  url: string;
  category: NewsCategory;
  isActive: boolean;
}> = [
  {
    name: "AI整体師（RSS URL確認待ち）",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCVAkt5l6kD4igMdVoEGTGIg",
    category: "ai_seitaishi",
    isActive: false,
  },
  {
    name: "Engineer's Digest（ponkotsu.dev）",
    url: "https://www.ponkotsu.dev/feed",
    category: "engineer",
    isActive: true,
  },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
});

export function hashValue(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}

function cleanText(value: unknown): string {
  if (typeof value === "string") {
    return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  if (value && typeof value === "object" && "#text" in value) {
    return cleanText((value as Record<string, unknown>)["#text"]);
  }
  return "";
}

function asArray(value: unknown): FeedItem[] {
  if (Array.isArray(value)) return value.filter(item => item && typeof item === "object") as FeedItem[];
  if (value && typeof value === "object") return [value as FeedItem];
  return [];
}

function extractLink(item: FeedItem): string {
  const link = item.link;
  if (typeof link === "string") return link.trim();
  for (const candidate of asArray(link)) {
    const href = candidate["@_href"];
    const rel = candidate["@_rel"];
    if (typeof href === "string" && (rel === undefined || rel === "alternate")) return href.trim();
  }
  const guid = cleanText(item.guid);
  return /^https?:\/\//i.test(guid) ? guid : "";
}

function pickDate(item: FeedItem): Date {
  const raw = cleanText(item.published || item.pubDate || item.updated || item.date);
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:" ) || normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  const octets = normalized.split(".").map(Number);
  if (octets.length !== 4 || octets.some(Number.isNaN)) return false;
  const [a, b] = octets;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export async function validateFeedUrl(rawUrl: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("有効なRSSまたはAtomフィードのURLを入力してください。");
  }
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("HTTPまたはHTTPSのフィードURLのみ登録できます。");
  }
  if (parsed.username || parsed.password || parsed.hostname === "localhost" || parsed.hostname.endsWith(".local")) {
    throw new Error("ローカルネットワーク上のURLは登録できません。");
  }
  const addresses = await lookup(parsed.hostname, { all: true });
  if (addresses.length === 0 || addresses.some(item => isPrivateAddress(item.address))) {
    throw new Error("公開ネットワーク上のフィードURLを指定してください。");
  }
  return parsed.toString();
}

export function parseFeedItems(xml: string): FeedItem[] {
  const data = parser.parse(xml) as Record<string, unknown>;
  const rss = data.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  if (channel?.item) return asArray(channel.item);
  const feed = data.feed as Record<string, unknown> | undefined;
  if (feed?.entry) return asArray(feed.entry);
  return [];
}

export async function ensureInitialFeeds(): Promise<void> {
  for (const feed of INITIAL_NEWS_FEEDS) {
    await db.ensureNewsFeed({ ...feed, urlHash: hashValue(feed.url) });
  }
}

export async function refreshFeed(feedId: number): Promise<{ added: number; skipped: number }> {
  const feed = await db.getNewsFeedById(feedId);
  if (!feed || !feed.isActive) return { added: 0, skipped: 0 };
  try {
    const safeUrl = await validateFeedUrl(feed.url);
    const response = await fetch(safeUrl, {
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9",
        "user-agent": "PersonalAI-News-Hub/1.0 (+RSS reader)",
      },
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`フィードの取得に失敗しました（HTTP ${response.status}）。`);
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 5_000_000) throw new Error("フィードのサイズが上限を超えています。");
    const xml = await response.text();
    if (xml.length > 5_000_000) throw new Error("フィードのサイズが上限を超えています。");

    const items = parseFeedItems(xml).slice(0, 100);
    let added = 0;
    let skipped = 0;
    for (const item of items) {
      const title = cleanText(item.title);
      const url = extractLink(item);
      if (!title || !url || !/^https?:\/\//i.test(url)) {
        skipped += 1;
        continue;
      }
      const created = await db.insertNewsArticleIfMissing({
        feedId: feed.id,
        title: title.slice(0, 1024),
        url,
        urlHash: hashValue(url),
        sourceName: feed.name,
        category: feed.category,
        publishedAt: pickDate(item),
        excerpt: cleanText(item.description || item.summary || item.content).slice(0, 10_000) || null,
      });
      if (created) added += 1;
      else skipped += 1;
    }
    await db.recordFeedFetch(feed.id, "success", `${added}件の新規記事を取得しました。`);
    return { added, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : "フィード取得中に不明なエラーが発生しました。";
    await db.recordFeedFetch(feed.id, "error", message);
    throw new Error(`${feed.name}: ${message}`);
  }
}

export async function refreshActiveFeeds(): Promise<{ added: number; failed: number; messages: string[] }> {
  await ensureInitialFeeds();
  const feeds = await db.listActiveNewsFeeds();
  const results = await Promise.allSettled(feeds.map(feed => refreshFeed(feed.id)));
  const messages: string[] = [];
  let added = 0;
  let failed = 0;
  for (const result of results) {
    if (result.status === "fulfilled") added += result.value.added;
    else {
      failed += 1;
      messages.push(result.reason instanceof Error ? result.reason.message : "RSS取得に失敗しました。");
    }
  }
  return { added, failed, messages };
}
