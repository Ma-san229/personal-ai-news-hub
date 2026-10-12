import { test } from "node:test";
import assert from "node:assert/strict";
import {
  japanDate,
  periodBounds,
  validateSelection,
  recordDaily,
  evolve,
  renderReport,
  rankArticles,
} from "./core.mjs";
import { publicUrl, publicAddress, parseFeed } from "./safe-feed.mjs";
import { run } from "./run.mjs";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  unlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

async function workspace() {
  const dir = await mkdtemp(`${tmpdir()}/news-research-`);
  const root = pathToFileURL(`${dir}/`);
  const files = {
    "research/config.json": {
      maxCandidates: 40,
      maxSelected: 5,
      maxPeriodSelected: 30,
      maxExcerptChars: 1800,
    },
    "research/state.json": {
      runs: [],
      keywords: [{ term: "AI", status: "active", pinned: true }],
      deliveries: {},
    },
    "pages/data/feeds.json": {
      feeds: [{ id: "f", name: "Public Feed", enabled: true, pinned: true }],
    },
    "pages/data/news.json": {
      articles: [
        {
          id: "a",
          feedId: "f",
          title: "AI Agent",
          url: "https://example.com/a",
          publishedAt: "2026-10-12T00:00:00Z",
          description: "Public content",
          sourceName: "Public Feed",
        },
      ],
    },
    "pages/reports/index.json": { reports: [] },
  };
  for (const [path, value] of Object.entries(files)) {
    const url = new URL(path, root);
    await mkdir(new URL("./", url), { recursive: true });
    await writeFile(url, JSON.stringify(value));
  }
  return { root, dir };
}

test("Japan date and leap-year/calendar boundaries", () => {
  assert.equal(japanDate(new Date("2026-10-12T16:00:00Z")), "2026-10-13");
  assert.deepEqual(periodBounds("monthly", "2024-03-01"), {
    start: "2024-01-31T15:00:00.000Z",
    end: "2024-02-29T15:00:00.000Z",
  });
  assert.deepEqual(periodBounds("monthly", "2026-01-10"), {
    start: "2025-11-30T15:00:00.000Z",
    end: "2025-12-31T15:00:00.000Z",
  });
});
test("Unsafe feed destinations are rejected, including mapped IPv4", () => {
  for (const url of [
    "http://example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::ffff:127.0.0.1]",
    "https://10.0.0.1",
    "https://example.com:8443",
    "https://user:pass@example.com",
  ])
    assert.throws(() => publicUrl(url));
  assert.equal(publicAddress("169.254.169.254"), false);
  assert.equal(publicAddress("fc00::1"), false);
  assert.equal(publicAddress("8.8.8.8"), true);
});
test("RSS and Atom parse, unsafe links and DTD are rejected", () => {
  const feed = { id: "f", name: "Feed", category: "engineer" };
  const rss = parseFeed(
    "<rss><channel><item><title>AI</title><link>https://example.com/a</link><pubDate>Tue, 13 Oct 2026 00:00:00 GMT</pubDate><description>&lt;b&gt;Hello&lt;/b&gt;</description></item><item><title>bad</title><link>https://127.0.0.1/</link></item></channel></rss>",
    feed
  );
  assert.equal(rss.length, 1);
  assert.equal(rss[0].feedId, "f");
  const atom = parseFeed(
    '<feed><entry><title>Agent</title><link rel="self" href="https://example.com/self"/><link rel="alternate" href="https://example.com/a"/><updated>2026-10-12</updated><summary>Summary</summary></entry></feed>',
    feed
  );
  assert.equal(atom[0].url, rss[0].url);
  assert.equal(atom[0].id, rss[0].id);
  assert.throws(() => parseFeed("<!DOCTYPE rss><rss/>", feed));
  assert.throws(() => parseFeed("<html>not a feed</html>", feed));
});
test("Selection rejects fabricated IDs, duplicates and invalid fields", () => {
  const candidates = [{ id: "one", url: "https://example.com" }];
  const item = {
    id: "one",
    titleJa: "題",
    summaryJa: "要約",
    reason: "理由",
    keywords: ["AI"],
  };
  assert.equal(
    validateSelection({ selected: [item] }, candidates, 5)[0].url,
    candidates[0].url
  );
  assert.throws(() =>
    validateSelection(
      { selected: [{ ...item, id: "invented" }] },
      candidates,
      5
    )
  );
  assert.throws(() =>
    validateSelection({ selected: [item, item] }, candidates, 5)
  );
  assert.throws(() =>
    validateSelection({ selected: [{ ...item, summaryJa: "" }] }, candidates, 5)
  );
});
test("Retry replaces daily ledger and promotes only with adoption evidence", () => {
  const state = { runs: [], keywords: [] };
  const report = {
    date: "2026-10-13",
    candidates: [{ id: "a", feedId: "f", matchedKeywords: ["AI"] }],
    selected: [{ id: "a", feedId: "f", keywords: ["AI"] }],
  };
  recordDaily(state, report);
  recordDaily(state, report);
  assert.equal(state.runs.length, 1);
  recordDaily(state, { ...report, date: "2026-10-12" });
  recordDaily(state, { ...report, date: "2026-10-11" });
  const feeds = [
    { id: "f", status: "candidate", discoveredAt: "2026-10-01" },
    { id: "pinned", status: "active", pinned: true },
  ];
  evolve(state, feeds, "2026-10-13");
  assert.equal(feeds[0].status, "active");
  assert.equal(feeds[1].status, "active");
});
test("No penalty for outage; low-value sources demote gradually", () => {
  const feed = { id: "f", status: "active", discoveredAt: "2026-09-01" };
  evolve({ runs: [], keywords: [] }, [feed], "2026-10-13");
  assert.equal(feed.status, "active");
  const runs = Array.from({ length: 12 }, (_, i) => ({
    date: `2026-10-${String(i + 2).padStart(2, "0")}`,
    sampledFeedIds: ["f"],
    candidates: [],
    selected: [],
  }));
  evolve({ runs, keywords: [] }, [feed], "2026-10-13");
  assert.equal(feed.status, "low_priority");
  const failedFeed = {
    id: "failed",
    status: "active",
    discoveredAt: "2026-09-01",
  };
  evolve({ runs, keywords: [] }, [failedFeed], "2026-10-13");
  assert.equal(failedFeed.status, "active");
  evolve({ runs, keywords: [] }, [feed], "2026-10-13");
  assert.equal(feed.status, "low_priority");
});
test("Candidate window excludes stale, stopped and duplicate articles", () => {
  const article = {
    id: "a",
    title: "AI Agent",
    url: "https://example.com/a",
    feedId: "f",
    publishedAt: "2026-10-12T00:00:00Z",
  };
  const result = rankArticles(
    [
      article,
      article,
      {
        ...article,
        id: "b",
        url: "https://example.com/b",
        publishedAt: "2025-01-01",
      },
    ],
    [{ id: "f", enabled: true }],
    [{ term: "AI", status: "active" }],
    periodBounds("daily", "2026-10-13")
  );
  assert.equal(result.length, 1);
  assert.equal(
    rankArticles(
      [article],
      [{ id: "f", enabled: true, status: "stopped" }],
      [],
      periodBounds("daily", "2026-10-13")
    ).length,
    0
  );
});
test("HTML escapes untrusted titles and summaries", () => {
  const html = renderReport({
    type: "daily",
    date: "2026-10-13",
    start: "",
    end: "",
    candidates: [],
    selected: [
      {
        titleJa: "<script>alert(1)</script>",
        summaryJa: '<img onerror="x">',
        url: "https://example.com",
        reason: "safe",
      },
    ],
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<img"));
});

test("End-to-end: retry uses saved report, restores HTML, and avoids duplicate ledger entries", async () => {
  const { root, dir } = await workspace();
  let calls = 0;
  const providers = {
    gemini: async () => {
      calls++;
      return {
        text: JSON.stringify({
          selected: [
            {
              id: "a",
              titleJa: "AI記事",
              summaryJa: "要約",
              reason: "公式資料",
              keywords: ["AI"],
            },
          ],
        }),
        usage: { totalTokenCount: 30 },
      };
    },
  };
  try {
    const options = { date: "2026-10-13", workspaceRoot: root, providers };
    await run(options);
    await unlink(new URL("pages/reports/daily/2026-10-13.html", root));
    await run(options);
    const ledger = JSON.parse(
      await readFile(new URL("research/state.json", root))
    );
    assert.equal(calls, 1);
    assert.equal(ledger.runs.length, 1);
    assert.ok(
      (
        await readFile(
          new URL("pages/reports/daily/2026-10-13.html", root),
          "utf8"
        )
      ).includes("AI記事")
    );
    const weekly = await run({ ...options, type: "weekly" });
    assert.equal(weekly.selected.length, 1);
    assert.equal(weekly.coverage.dailyReports, 1);
    assert.equal(calls, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("Dry-run leaves report ledger and public output untouched", async () => {
  const { root, dir } = await workspace();
  try {
    const before = await readFile(new URL("research/state.json", root), "utf8");
    await run({
      date: "2026-10-13",
      workspaceRoot: root,
      dryRun: true,
      providers: {
        gemini: () => {
          throw new Error("Must not call API");
        },
      },
    });
    assert.equal(
      await readFile(new URL("research/state.json", root), "utf8"),
      before
    );
    await assert.rejects(
      readFile(new URL("pages/reports/daily/2026-10-13.json", root)),
      { code: "ENOENT" }
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("Fabricated AI selection fails before changing public state", async () => {
  const { root, dir } = await workspace();
  try {
    await assert.rejects(
      run({
        date: "2026-10-13",
        workspaceRoot: root,
        providers: {
          gemini: async () => ({
            text: JSON.stringify({
              selected: [
                {
                  id: "invented",
                  titleJa: "a",
                  summaryJa: "b",
                  reason: "c",
                  keywords: [],
                },
              ],
            }),
          }),
        },
      }),
      /Unknown/
    );
    const state = JSON.parse(
      await readFile(new URL("research/state.json", root))
    );
    assert.equal(state.runs.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("Verification failure keeps report; ambiguous Discord send is not retried", async () => {
  const { root, dir } = await workspace();
  let sends = 0;
  const env = [
    "ENABLE_WEB_VERIFICATION",
    "ENABLE_DRIVE_SYNC",
    "ENABLE_DISCORD_NOTIFY",
  ];
  const original = env.map(name => process.env[name]);
  env.forEach(name => {
    process.env[name] = "true";
  });
  const providers = {
    gemini: async (_prompt, options) => {
      if (options.grounded) throw new Error("Verification unavailable");
      return {
        text: JSON.stringify({
          selected: [
            {
              id: "a",
              titleJa: "題",
              summaryJa: "要約",
              reason: "理由",
              keywords: ["AI"],
            },
          ],
        }),
      };
    },
    syncDrive: async () => ({
      id: "private-file",
      url: "https://drive.google.com/private-file",
    }),
    notifyDiscord: async () => {
      sends++;
      throw new Error("Timeout");
    },
  };
  try {
    const options = { date: "2026-10-13", workspaceRoot: root, providers };
    const report = await run(options);
    await run(options);
    assert.match(report.selected[0].verification.status, /未確認/);
    assert.equal(sends, 1);
    const text = await readFile(new URL("research/state.json", root), "utf8");
    assert.ok(!text.includes("private-file"));
    assert.equal(
      JSON.parse(text).deliveries["daily/2026-10-13"].discord,
      "unknown"
    );
  } finally {
    env.forEach((name, i) => {
      if (original[i] == null) delete process.env[name];
      else process.env[name] = original[i];
    });
    await rm(dir, { recursive: true, force: true });
  }
});
