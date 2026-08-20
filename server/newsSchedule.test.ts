import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getRefreshScheduleByTaskUid: vi.fn(),
  updateRefreshScheduleRun: vi.fn(),
  refreshActiveFeeds: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./db", () => ({ getRefreshScheduleByTaskUid: mocks.getRefreshScheduleByTaskUid, updateRefreshScheduleRun: mocks.updateRefreshScheduleRun }));
vi.mock("./newsService", () => ({ refreshActiveFeeds: mocks.refreshActiveFeeds }));

import { handleScheduledNewsRefresh } from "./newsSchedule";

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe("scheduled news refresh", () => {
  beforeEach(() => vi.clearAllMocks());

  it("認証済みの定期実行で有効なフィードを更新する", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    mocks.getRefreshScheduleByTaskUid.mockResolvedValue({ isEnabled: true });
    mocks.refreshActiveFeeds.mockResolvedValue({ added: 3, failed: 0, messages: [] });
    const res = response();
    await handleScheduledNewsRefresh({} as any, res as any);
    expect(mocks.updateRefreshScheduleRun).toHaveBeenCalledWith("task-1", "success");
    expect(res.json).toHaveBeenCalledWith({ ok: true, added: 3, failed: 0, messages: [] });
  });

  it("定期実行者ではないリクエストを拒否する", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: false });
    const res = response();
    await handleScheduledNewsRefresh({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only" });
    expect(mocks.refreshActiveFeeds).not.toHaveBeenCalled();
  });
});
