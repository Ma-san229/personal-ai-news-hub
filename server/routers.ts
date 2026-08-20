import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { hashValue, refreshActiveFeeds, refreshFeed, validateFeedUrl } from "./newsService";

const categoryInput = z.enum(["ai_seitaishi", "engineer"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  news: router({
    dashboard: protectedProcedure
      .input(z.object({ category: categoryInput.or(z.literal("all")).optional(), search: z.string().max(100).optional(), status: z.enum(["all", "read", "unread"]).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const [articles, stats, feeds] = await Promise.all([
          db.listNewsArticles({ userId: ctx.user.id, category: input?.category, search: input?.search, status: input?.status }),
          db.getNewsStats(ctx.user.id),
          db.listNewsFeeds(),
        ]);
        return { articles, stats, feeds };
      }),
    feeds: protectedProcedure.query(() => db.listNewsFeeds()),
    addFeed: protectedProcedure
      .input(z.object({ name: z.string().trim().min(1).max(256), url: z.string().trim().max(2048), category: categoryInput }))
      .mutation(async ({ input }) => {
        const url = await validateFeedUrl(input.url);
        await db.createNewsFeed({ ...input, url, urlHash: hashValue(url), isActive: true });
        return { success: true };
      }),
    deleteFeed: protectedProcedure.input(z.object({ feedId: z.number().int().positive() })).mutation(async ({ input }) => {
      await db.deleteNewsFeed(input.feedId);
      return { success: true };
    }),
    setFeedActive: protectedProcedure.input(z.object({ feedId: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ input }) => {
      await db.toggleNewsFeed(input.feedId, input.isActive);
      return { success: true };
    }),
    refreshAll: protectedProcedure.mutation(async () => refreshActiveFeeds()),
    refreshFeed: protectedProcedure.input(z.object({ feedId: z.number().int().positive() })).mutation(async ({ input }) => refreshFeed(input.feedId)),
    setReadState: protectedProcedure
      .input(z.object({ articleId: z.number().int().positive(), isRead: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await db.setArticleReadState(input.articleId, ctx.user.id, input.isRead);
        return { success: true };
      }),
    schedule: router({
      get: protectedProcedure.query(() => db.getRefreshSchedule()),
      configure: protectedProcedure.input(z.object({ cronExpression: z.string().regex(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+$/, "6項目のcron式を入力してください。"), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        const existing = await db.getRefreshSchedule();
        if (existing?.scheduleCronTaskUid) {
          await updateHeartbeatJob(existing.scheduleCronTaskUid, { cron: input.cronExpression, enable: input.enabled, description: "Personal AI News Hub のRSS自動取得" }, sessionToken);
          await db.saveRefreshSchedule({ cronExpression: input.cronExpression, taskUid: existing.scheduleCronTaskUid, isEnabled: input.enabled });
          return { success: true, taskUid: existing.scheduleCronTaskUid };
        }
        const job = await createHeartbeatJob({
          name: "rss-news-refresh",
          cron: input.cronExpression,
          path: "/api/scheduled/news-refresh",
          description: "Personal AI News Hub のRSS自動取得",
        }, sessionToken);
        await db.saveRefreshSchedule({ cronExpression: input.cronExpression, taskUid: job.taskUid, isEnabled: input.enabled });
        return { success: true, taskUid: job.taskUid };
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
