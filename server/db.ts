import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  type InsertNewsFeed,
  type InsertUser,
  newsArticleReadStates,
  newsArticles,
  newsFeeds,
  newsRefreshSchedules,
  type NewsCategory,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export async function ensureNewsFeed(feed: InsertNewsFeed): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("データベースに接続できません。");
  await db.insert(newsFeeds).values(feed).onDuplicateKeyUpdate({ set: { name: feed.name } });
}

export async function listNewsFeeds() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(newsFeeds).orderBy(desc(newsFeeds.createdAt));
}

export async function listActiveNewsFeeds() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(newsFeeds).where(eq(newsFeeds.isActive, true));
}

export async function getNewsFeedById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(newsFeeds).where(eq(newsFeeds.id, id)).limit(1))[0];
}

export async function createNewsFeed(feed: InsertNewsFeed) {
  const db = await getDb();
  if (!db) throw new Error("データベースに接続できません。");
  await db.insert(newsFeeds).values(feed);
}

export async function deleteNewsFeed(feedId: number) {
  const db = await getDb();
  if (!db) throw new Error("データベースに接続できません。");
  await db.delete(newsFeeds).where(eq(newsFeeds.id, feedId));
}

export async function toggleNewsFeed(feedId: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("データベースに接続できません。");
  await db.update(newsFeeds).set({ isActive }).where(eq(newsFeeds.id, feedId));
}

export async function recordFeedFetch(feedId: number, status: string, message: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(newsFeeds).set({ lastFetchedAt: new Date(), lastFetchStatus: status, lastFetchMessage: message }).where(eq(newsFeeds.id, feedId));
}

export async function insertNewsArticleIfMissing(article: {
  feedId: number;
  title: string;
  url: string;
  urlHash: string;
  sourceName: string;
  category: NewsCategory;
  publishedAt: Date;
  excerpt: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("データベースに接続できません。");
  const result = await db.insert(newsArticles).values(article).onDuplicateKeyUpdate({ set: { urlHash: sql`${newsArticles.urlHash}` } });
  return result[0].affectedRows === 1;
}

export async function listNewsArticles(input: {
  userId: number;
  category?: NewsCategory | "all";
  search?: string;
  status?: "all" | "read" | "unread";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [];
  if (input.category && input.category !== "all") conditions.push(eq(newsArticles.category, input.category));
  if (input.search?.trim()) {
    const term = `%${input.search.trim().slice(0, 100)}%`;
    conditions.push(or(like(newsArticles.title, term), like(newsArticles.sourceName, term)) as SQL);
  }
  if (input.status === "read") conditions.push(sql`${newsArticleReadStates.id} IS NOT NULL`);
  if (input.status === "unread") conditions.push(sql`${newsArticleReadStates.id} IS NULL`);
  return db
    .select({
      id: newsArticles.id,
      title: newsArticles.title,
      url: newsArticles.url,
      sourceName: newsArticles.sourceName,
      category: newsArticles.category,
      publishedAt: newsArticles.publishedAt,
      excerpt: newsArticles.excerpt,
      isRead: sql<boolean>`${newsArticleReadStates.id} IS NOT NULL`,
    })
    .from(newsArticles)
    .leftJoin(newsArticleReadStates, and(eq(newsArticleReadStates.articleId, newsArticles.id), eq(newsArticleReadStates.userId, input.userId)))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(newsArticles.publishedAt))
    .limit(Math.min(Math.max(input.limit ?? 100, 1), 200));
}

export async function getNewsStats(userId: number) {
  const all = await listNewsArticles({ userId, status: "all", limit: 200 });
  return {
    total: all.length,
    unread: all.filter(item => !item.isRead).length,
    aiSeitaishi: all.filter(item => item.category === "ai_seitaishi").length,
    engineer: all.filter(item => item.category === "engineer").length,
  };
}

export async function setArticleReadState(articleId: number, userId: number, isRead: boolean) {
  const db = await getDb();
  if (!db) throw new Error("データベースに接続できません。");
  if (isRead) {
    await db.insert(newsArticleReadStates).values({ articleId, userId, readAt: new Date() }).onDuplicateKeyUpdate({ set: { readAt: new Date() } });
  } else {
    await db.delete(newsArticleReadStates).where(and(eq(newsArticleReadStates.articleId, articleId), eq(newsArticleReadStates.userId, userId)));
  }
}

export async function getRefreshSchedule() {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(newsRefreshSchedules).where(eq(newsRefreshSchedules.name, "rss-news-refresh")).limit(1))[0];
}

export async function getRefreshScheduleByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(newsRefreshSchedules).where(eq(newsRefreshSchedules.scheduleCronTaskUid, taskUid)).limit(1))[0];
}

export async function saveRefreshSchedule(input: { cronExpression: string; taskUid: string; isEnabled?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("データベースに接続できません。");
  await db.insert(newsRefreshSchedules).values({
    name: "rss-news-refresh",
    cronExpression: input.cronExpression,
    scheduleCronTaskUid: input.taskUid,
    isEnabled: input.isEnabled ?? true,
  }).onDuplicateKeyUpdate({
    set: {
      cronExpression: input.cronExpression,
      scheduleCronTaskUid: input.taskUid,
      isEnabled: input.isEnabled ?? true,
    },
  });
}

export async function updateRefreshScheduleRun(taskUid: string, status: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(newsRefreshSchedules).set({ lastRunAt: new Date(), lastRunStatus: status }).where(eq(newsRefreshSchedules.scheduleCronTaskUid, taskUid));
}
