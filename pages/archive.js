const list = document.querySelector("#archiveList");
const grid = document.querySelector("#dayGrid");
const label = document.querySelector("#archiveLabel");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

async function showDay(date) {
  const response = await fetch(`./archives/${date}.json`, { cache: "no-store" });
  const body = await response.json();
  label.textContent = `${date} に収集した ${body.articles.length} 件`;
  list.hidden = true;
  grid.innerHTML = `<p><a href="./archive.html">← 日付一覧へ</a></p>` + body.articles.map((article) => `<article class="article-card"><h2>${escapeHtml(article.title)}</h2><dl><div><dt>ソース名</dt><dd>${escapeHtml(article.sourceName)}</dd></div></dl><a class="open-link" href="${escapeHtml(article.url)}" target="_blank" rel="noreferrer">元記事を開く <span>↗</span></a></article>`).join("");
}

async function load() {
  try {
    const index = await (await fetch("./archives/index.json", { cache: "no-store" })).json();
    label.textContent = `${index.days.length} 日分を保存中`;
    list.innerHTML = index.days.map((day) => `<li><a href="?date=${day.date}">${day.date}</a><span>${day.count} 件</span></li>`).join("") + `<li><a href="./daily/2026-10-08.html">2026-10-08 特集（AI整体師の投稿ピックアップ）</a><span>手作成</span></li>`;
    const date = new URLSearchParams(location.search).get("date");
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) await showDay(date);
  } catch (error) { label.textContent = "アーカイブを読み込めませんでした"; console.error(error); }
}
load();
