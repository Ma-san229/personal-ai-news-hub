import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Core user table backing the Manus OAuth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const newsCategoryValues = ["ai_seitaishi", "engineer"] as const;
export type NewsCategory = (typeof newsCategoryValues)[number];

/** RSS/Atom feed settings managed from the application. */
export const newsFeeds = mysqlTable(
  "newsFeeds",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 256 }).notNull(),
    url: varchar("url", { length: 2048 }).notNull(),
    urlHash: varchar("urlHash", { length: 64 }).notNull(),
    category: mysqlEnum("category", newsCategoryValues).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    lastFetchedAt: timestamp("lastFetchedAt"),
    lastFetchStatus: varchar("lastFetchStatus", { length: 32 }),
    lastFetchMessage: text("lastFetchMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("newsFeeds_urlHash_unique").on(table.urlHash),
    index("newsFeeds_category_active_idx").on(table.category, table.isActive),
  ]
);

/** A normalized article record imported from one of the configured feeds. */
export const newsArticles = mysqlTable(
  "newsArticles",
  {
    id: int("id").autoincrement().primaryKey(),
    feedId: int("feedId").notNull(),
    title: varchar("title", { length: 1024 }).notNull(),
    url: varchar("url", { length: 2048 }).notNull(),
    urlHash: varchar("urlHash", { length: 64 }).notNull(),
    sourceName: varchar("sourceName", { length: 256 }).notNull(),
    category: mysqlEnum("category", newsCategoryValues).notNull(),
    publishedAt: timestamp("publishedAt").notNull(),
    excerpt: text("excerpt"),
    fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("newsArticles_urlHash_unique").on(table.urlHash),
    index("newsArticles_category_published_idx").on(table.category, table.publishedAt),
    index("newsArticles_feed_published_idx").on(table.feedId, table.publishedAt),
  ]
);

/** Per-user read state keeps the dashboard ready for future shared use. */
export const newsArticleReadStates = mysqlTable(
  "newsArticleReadStates",
  {
    id: int("id").autoincrement().primaryKey(),
    articleId: int("articleId").notNull(),
    userId: int("userId").notNull(),
    readAt: timestamp("readAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("newsArticleReadStates_article_user_unique").on(table.articleId, table.userId),
    index("newsArticleReadStates_user_idx").on(table.userId),
  ]
);

/** A durable owner record for the platform-managed RSS refresh schedule. */
export const newsRefreshSchedules = mysqlTable(
  "newsRefreshSchedules",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    cronExpression: varchar("cronExpression", { length: 64 }).notNull(),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    isEnabled: boolean("isEnabled").default(true).notNull(),
    lastRunAt: timestamp("lastRunAt"),
    lastRunStatus: varchar("lastRunStatus", { length: 32 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("newsRefreshSchedules_name_unique").on(table.name),
    uniqueIndex("newsRefreshSchedules_taskUid_unique").on(table.scheduleCronTaskUid),
  ]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type NewsFeed = typeof newsFeeds.$inferSelect;
export type InsertNewsFeed = typeof newsFeeds.$inferInsert;
export type NewsArticle = typeof newsArticles.$inferSelect;
export type NewsRefreshSchedule = typeof newsRefreshSchedules.$inferSelect;
