import { describe, expect, it } from "vitest";
import { INITIAL_NEWS_FEEDS, hashValue, parseFeedItems } from "./newsService";

describe("RSSニュース収集の基礎処理", () => {
  it("RSS 2.0形式の記事を抽出できる", () => {
    const items = parseFeedItems(`<?xml version="1.0"?><rss><channel><item><title>記事A</title><link>https://example.com/a</link></item></channel></rss>`);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "記事A", link: "https://example.com/a" });
  });

  it("Atom形式の記事を抽出できる", () => {
    const items = parseFeedItems(`<?xml version="1.0"?><feed><entry><title>記事B</title><link href="https://example.com/b" /></entry></feed>`);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "記事B" });
  });

  it("URLハッシュは同じURLに対して常に同じ値を返す", () => {
    expect(hashValue("https://example.com/article")).toBe(hashValue("https://example.com/article"));
    expect(hashValue("https://example.com/article")).toHaveLength(64);
  });

  it("AI整体師向けとponkotsu.devを初期ソースとして保持する", () => {
    expect(INITIAL_NEWS_FEEDS.some(feed => feed.category === "ai_seitaishi" && feed.url.includes("youtube.com/feeds/videos.xml"))).toBe(true);
    expect(INITIAL_NEWS_FEEDS.some(feed => feed.url === "https://www.ponkotsu.dev/feed" && feed.category === "engineer" && feed.isActive)).toBe(true);
  });
});
