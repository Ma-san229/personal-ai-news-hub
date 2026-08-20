import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  listNewsArticles: vi.fn(),
  getNewsStats: vi.fn(),
  listNewsFeeds: vi.fn(),
  createNewsFeed: vi.fn(),
  setArticleReadState: vi.fn(),
  hashValue: vi.fn((url: string) => `hash:${url}`),
  validateFeedUrl: vi.fn(async (url: string) => `https://normalized.example/${url.split("/").pop()}`),
}));

vi.mock("./db", () => ({
  listNewsArticles: mocks.listNewsArticles,
  getNewsStats: mocks.getNewsStats,
  listNewsFeeds: mocks.listNewsFeeds,
  createNewsFeed: mocks.createNewsFeed,
  setArticleReadState: mocks.setArticleReadState,
}));

vi.mock("./newsService", () => ({
  hashValue: mocks.hashValue,
  validateFeedUrl: mocks.validateFeedUrl,
  refreshActiveFeeds: vi.fn(),
  refreshFeed: vi.fn(),
}));

import { appRouter } from "./routers";

function context(): TrpcContext {
  const now = new Date();
  return {
    user: { id: 42, openId: "news-owner", name: "Owner", email: null, loginMethod: "manus", role: "admin", createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

describe("news router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listNewsArticles.mockResolvedValue([{ id: 1, title: "記事", isRead: false }]);
    mocks.getNewsStats.mockResolvedValue({ total: 1, unread: 1, aiSeitaishi: 1, engineer: 0 });
    mocks.listNewsFeeds.mockResolvedValue([{ id: 10, name: "テストフィード" }]);
  });

  it("ログインユーザーごとのダッシュボードデータを返す", async () => {
    const result = await appRouter.createCaller(context()).news.dashboard({ category: "ai_seitaishi", status: "unread", search: "AI" });
    expect(mocks.listNewsArticles).toHaveBeenCalledWith({ userId: 42, category: "ai_seitaishi", status: "unread", search: "AI" });
    expect(result.stats.unread).toBe(1);
    expect(result.feeds).toHaveLength(1);
  });

  it("有効なフィードURLを正規化して追加する", async () => {
    const caller = appRouter.createCaller(context());
    await caller.news.addFeed({ name: "開発ブログ", url: "https://input.example/feed.xml", category: "engineer" });
    expect(mocks.validateFeedUrl).toHaveBeenCalledWith("https://input.example/feed.xml");
    expect(mocks.createNewsFeed).toHaveBeenCalledWith({
      name: "開発ブログ",
      url: "https://normalized.example/feed.xml",
      urlHash: "hash:https://normalized.example/feed.xml",
      category: "engineer",
      isActive: true,
    });
  });

  it("既読状態をログインユーザーに紐づけて保存する", async () => {
    await appRouter.createCaller(context()).news.setReadState({ articleId: 9, isRead: true });
    expect(mocks.setArticleReadState).toHaveBeenCalledWith(9, 42, true);
  });
});
