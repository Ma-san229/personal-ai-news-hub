import type { Request, Response } from "express";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { refreshActiveFeeds } from "./newsService";

export async function handleScheduledNewsRefresh(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const schedule = await db.getRefreshScheduleByTaskUid(user.taskUid);
    if (!schedule || !schedule.isEnabled) return res.json({ ok: true, skipped: "orphan-or-disabled" });
    const result = await refreshActiveFeeds();
    await db.updateRefreshScheduleRun(user.taskUid, result.failed ? "partial" : "success");
    return res.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RSSの定期取得に失敗しました。";
    console.error("[ScheduledNewsRefresh]", error);
    return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
  }
}
