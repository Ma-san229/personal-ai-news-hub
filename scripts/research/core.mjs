import { publicUrl } from "./safe-feed.mjs";
export const escapeHtml = value =>
  String(value ?? "").replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]
  );
export function japanDate(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export const dayNumber = date =>
  Math.floor(Date.parse(`${date}T00:00:00+09:00`) / 86400000);
export function periodBounds(type, date) {
  const end = new Date(`${date}T00:00:00+09:00`);
  const start = new Date(end);
  if (type === "daily") start.setUTCDate(start.getUTCDate() - 1);
  if (type === "weekly") start.setUTCDate(start.getUTCDate() - 7);
  if (type === "monthly") {
    // A monthly report covers the preceding calendar month.
    const [year, month] = date.split("-").map(Number);
    end.setTime(
      Date.parse(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+09:00`)
    );
    start.setTime(Date.UTC(year, month - 2, 1, -9));
  }
  return { start: start.toISOString(), end: end.toISOString() };
}
export function rankArticles(
  articles,
  feeds,
  keywords,
  bounds,
  now = new Date()
) {
  const feedMap = new Map(feeds.map(f => [f.id, f]));
  const seen = new Set();
  return articles
    .flatMap(article => {
      try {
        publicUrl(article.url);
      } catch {
        return [];
      }
      const time = Date.parse(article.publishedAt);
      const feed = feedMap.get(article.feedId);
      if (
        !feed ||
        feed.enabled === false ||
        feed.status === "stopped" ||
        !Number.isFinite(time) ||
        time < Date.parse(bounds.start) ||
        time >= Date.parse(bounds.end) ||
        seen.has(article.url)
      )
        return [];
      seen.add(article.url);
      const text =
        `${article.title} ${article.description ?? ""}`.toLowerCase();
      const matches = keywords.filter(
        k => k.status !== "stopped" && text.includes(k.term.toLowerCase())
      );
      const score =
        matches.reduce(
          (total, k) => total + (k.status === "active" ? 3 : 1),
          0
        ) +
        (feed.official ? 4 : 0) +
        (feed.status === "low_priority" ? 0 : 1) +
        Math.max(0, 2 - (now.getTime() - time) / 86400000);
      return [{ ...article, score, matchedKeywords: matches.map(k => k.term) }];
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
export function validateSelection(data, candidates, limit) {
  if (!Array.isArray(data?.selected) || data.selected.length > limit)
    throw new Error("Invalid selection count");
  const map = new Map(candidates.map(a => [a.id, a]));
  const seen = new Set();
  return data.selected.map(item => {
    if (!map.has(item.id) || seen.has(item.id))
      throw new Error("Unknown or duplicate article ID");
    seen.add(item.id);
    for (const key of ["titleJa", "summaryJa", "reason"]) {
      if (
        typeof item[key] !== "string" ||
        !item[key].trim() ||
        item[key].length > 2500
      )
        throw new Error(`Invalid ${key}`);
    }
    if (
      !Array.isArray(item.keywords) ||
      item.keywords.length > 8 ||
      item.keywords.some(
        k => typeof k !== "string" || k.length > 80 || !k.trim()
      )
    )
      throw new Error("Invalid keywords");
    return {
      ...map.get(item.id),
      titleJa: item.titleJa,
      summaryJa: item.summaryJa,
      reason: item.reason,
      keywords: [...new Set(item.keywords)],
    };
  });
}
export function recordDaily(state, report) {
  // Replace this date, rather than double-counting retries.
  state.runs = (state.runs ?? []).filter(r => r.date !== report.date);
  state.runs.push({
    date: report.date,
    sampledFeedIds: report.sampledFeedIds ?? [],
    candidates: report.candidates.map(a => ({
      id: a.id,
      feedId: a.feedId,
      keywords: a.matchedKeywords,
    })),
    selected: report.selected,
  });
  state.runs = state.runs.filter(
    r => dayNumber(report.date) - dayNumber(r.date) <= 100
  );
  state.keywords ??= [];
  for (const item of report.selected)
    for (const term of item.keywords) {
      if (
        !state.keywords.some(
          k => k.term.toLowerCase() === term.toLowerCase()
        ) &&
        state.keywords.length < 100
      )
        state.keywords.push({
          term,
          status: "candidate",
          discoveredAt: report.date,
          pinned: false,
        });
    }
  return state;
}
export function evolve(state, feeds, date) {
  const recent = (state.runs ?? []).filter(
    r => dayNumber(date) - dayNumber(r.date) < 14
  );
  const decide = (item, hits, adoptions, sampleDays) => {
    if (item.pinned) return;
    if (item.status === "candidate" && hits >= 3 && adoptions >= 2)
      item.status = "active";
    else if (
      sampleDays >= 10 &&
      !adoptions &&
      dayNumber(date) - dayNumber(item.discoveredAt ?? date) >= 14
    ) {
      if (item.status === "active") {
        item.status = "low_priority";
        item.statusChangedAt = date;
      } else if (
        ["candidate", "low_priority"].includes(item.status) &&
        dayNumber(date) -
          dayNumber(item.statusChangedAt ?? item.discoveredAt ?? date) >=
          28
      )
        item.status = "stopped";
    } else if (item.status === "low_priority" && adoptions >= 2)
      item.status = "active";
    item.hits14d = hits;
    item.adoptions14d = adoptions;
  };
  for (const feed of feeds)
    decide(
      feed,
      recent.filter(r => r.candidates.some(a => a.feedId === feed.id)).length,
      recent.filter(r => r.selected.some(a => a.feedId === feed.id)).length,
      recent.filter(r => r.sampledFeedIds?.includes(feed.id)).length
    );
  for (const k of state.keywords ?? []) {
    const matches = a =>
      (a.keywords ?? []).some(
        term => term.toLowerCase() === k.term.toLowerCase()
      );
    decide(
      k,
      recent.filter(r => r.candidates.some(matches)).length,
      recent.filter(r => r.selected.some(matches)).length,
      recent.filter(r => r.sampledFeedIds?.length).length
    );
  }
  return { state, feeds };
}
export function renderReport(report) {
  const e = escapeHtml;
  const title = `${report.date} AIニュース・${report.type}`;
  const articles = report.selected
    .map(
      a =>
        `<article><h2><a href="${e(a.url)}" rel="noopener noreferrer">${e(a.titleJa)}</a></h2><p>${e(a.title)}</p><p>${e(a.summaryJa)}</p><p class="meta">採用理由：${e(a.reason)}</p><p class="meta">${e(a.sourceName)} / 公開：${e(a.publishedAt)} / 検証：${e(a.verification?.status ?? "未確認")}</p>${a.verification?.text ? `<details><summary>検索による確認メモ</summary><p>${e(a.verification.text)}</p>${(a.verification.sources ?? []).map(s => `<p><a href="${e(s.url)}">${e(s.title)}</a></p>`).join("")}</details>` : ""}</article>`
    )
    .join("");
  const coverage = report.coverage
    ? `<p>集計できた日次レポート：${report.coverage.dailyReports}/${report.coverage.expectedDays}日${report.coverage.previousDailyReports == null ? "" : ` / 前月 ${report.coverage.previousDailyReports}日`}。欠測がある期間の件数差は参考値です。</p>`
    : "";
  const trends =
    coverage +
    (report.trends?.length
      ? `<article><h2>採用記事の話題</h2><p>以下はレポート採用件数で、世間全体の流行を示すものではありません。</p>${report.trends.map(t => `<p>${e(t.term)}：${t.count}件${t.previous == null ? "" : ` / 前月 ${t.previous}件 / 差 ${t.count - t.previous}件`}</p>`).join("")}</article>`
      : "");
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)}</title><style>body{font:16px/1.8 system-ui;margin:24px auto;padding:0 18px;max-width:780px;background:#f4f6fa;color:#182235}article{background:white;padding:20px;margin:18px 0;border-radius:12px}a{color:#225ec2;overflow-wrap:anywhere}h2{font-size:20px}.meta{font-size:13px;color:#566276}details p{white-space:pre-wrap}</style><h1>${e(title)}</h1><p>対象期間：${e(report.start)} ～ ${e(report.end)}（終了時刻を含まない）</p><p>採用 ${report.selected.length}件 / 候補 ${report.candidateCount ?? report.candidates.length}件。AIによる要約です。原文で確認してください。</p>${trends}${articles || "<p>採用記事はありません。</p>"}<p>週次・月次は日次の採用記事を集約しています。</p></html>`;
}
export function markdownReport(report) {
  const safe = s =>
    String(s ?? "")
      .replace(/[\r\n]/g, " ")
      .replace(/[\\`*_{}\[\]<>]/g, "");
  const coverage = report.coverage
    ? `集計できた日次レポート: ${report.coverage.dailyReports}/${report.coverage.expectedDays}日。欠測のある期間の比較は参考値です。\n\n`
    : "";
  const trends = (report.trends ?? [])
    .map(
      t =>
        `${safe(t.term)}: ${t.count}件${t.previous == null ? "" : ` / 前月 ${t.previous}件`}\n`
    )
    .join("");
  return (
    `# ${report.date} AIニュース ${report.type}\n\n期間: ${report.start} ～ ${report.end}\n\n${coverage}${trends}\n` +
    report.selected
      .map(
        a =>
          `## ${safe(a.titleJa)}\n\n原題: ${safe(a.title)}\n\n${safe(a.summaryJa)}\n\n採用理由: ${safe(a.reason)}\n\n出典: ${a.url}\n\n検証: ${safe(a.verification?.status ?? "未確認")}\n`
      )
      .join("\n")
  );
}
