import { readdir, writeFile } from "node:fs/promises";

// pages/daily/ にある日次レポート（YYYY-MM-DD.json）の日付一覧を pages/data/daily-index.json に書く。
// トップページはこの一覧から最新の日次レポートへのリンクを作る。

const root = new URL("../", import.meta.url);
const files = await readdir(new URL("pages/daily/", root)).catch(() => []);
const dates = files
  .map((name) => /^(\d{4}-\d{2}-\d{2})\.json$/.exec(name)?.[1])
  .filter(Boolean)
  .sort()
  .reverse()
  .slice(0, 60);

await writeFile(
  new URL("pages/data/daily-index.json", root),
  `${JSON.stringify({ updatedAt: new Date().toISOString(), latest: dates[0] ?? null, dates }, null, 2)}\n`,
);
console.log(JSON.stringify({ latest: dates[0] ?? null, count: dates.length }));
