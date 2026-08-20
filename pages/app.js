const categoryLabels = { ai_seitaishi: "AI整体師向け", engineer: "エンジニア向け" };
const storedReads = new Set(JSON.parse(localStorage.getItem("signal-shelf-read") || "[]"));
let articles = [];
let selectedCategory = "all";
let searchTerm = "";

const articleGrid = document.querySelector("#articleGrid");
const formatDate = (value) => value ? new Intl.DateTimeFormat("ja-JP", { year:"numeric", month:"short", day:"numeric" }).format(new Date(value)) : "公開日不明";
const shortUrl = (url) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

function persistReads() { localStorage.setItem("signal-shelf-read", JSON.stringify([...storedReads])); }
function render() {
  const query = searchTerm.toLocaleLowerCase("ja-JP");
  const visible = articles.filter((article) => (selectedCategory === "all" || article.category === selectedCategory) && [article.title, article.sourceName, article.url].join(" ").toLocaleLowerCase("ja-JP").includes(query));
  articleGrid.innerHTML = "";
  document.querySelector("#resultLabel").textContent = `${visible.length} 件のシグナルを表示`;
  if (!visible.length) { articleGrid.innerHTML = '<div class="empty">条件に一致する記事はありません。情報源または検索条件を確認してください。</div>'; return; }
  const template = document.querySelector("#articleTemplate");
  visible.forEach((article) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".article-card");
    const read = storedReads.has(article.id);
    card.classList.toggle("is-read", read);
    fragment.querySelector(".category-badge").textContent = categoryLabels[article.category] || article.category;
    fragment.querySelector("h2").textContent = article.title;
    fragment.querySelector(".url").textContent = shortUrl(article.url);
    fragment.querySelector(".published").textContent = formatDate(article.publishedAt);
    fragment.querySelector(".source").textContent = article.sourceName;
    fragment.querySelector(".category").textContent = categoryLabels[article.category] || article.category;
    const link = fragment.querySelector(".open-link"); link.href = article.url;
    fragment.querySelector(".read-toggle").addEventListener("click", () => { if (storedReads.has(article.id)) storedReads.delete(article.id); else storedReads.add(article.id); persistReads(); render(); });
    articleGrid.append(fragment);
  });
}

function count(category) { return category === "all" ? articles.length : articles.filter((article) => article.category === category).length; }
function renderFeedSummary(feeds) {
  const target = document.querySelector("#feedSummary");
  target.innerHTML = feeds.map((feed) => `<span class="feed-tag ${feed.enabled ? "" : "offline"}">${feed.enabled ? "●" : "○"} ${feed.name} ${feed.enabled ? "" : " / URL確認待ち"}</span>`).join("");
}

async function load() {
  try {
    const [newsResponse, feedsResponse] = await Promise.all([fetch("./data/news.json", { cache:"no-store" }), fetch("./data/feeds.json", { cache:"no-store" })]);
    const news = await newsResponse.json(); const feeds = await feedsResponse.json();
    articles = Array.isArray(news.articles) ? news.articles : [];
    document.querySelector("#articleCount").textContent = articles.length;
    document.querySelector("#lastUpdated").textContent = news.updatedAt ? `DATA FEED / ${new Intl.DateTimeFormat("ja-JP", { month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" }).format(new Date(news.updatedAt))}` : "DATA FEED / WAITING";
    document.querySelector("#countAll").textContent = count("all"); document.querySelector("#countAi").textContent = count("ai_seitaishi"); document.querySelector("#countEngineer").textContent = count("engineer");
    renderFeedSummary(feeds.feeds || []); render();
  } catch (error) { articleGrid.innerHTML = '<div class="empty">ニュースデータを読み込めませんでした。次回の収集後に再試行してください。</div>'; console.error(error); }
}
document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => { selectedCategory = button.dataset.category; document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab === button)); render(); }));
document.querySelector("#searchInput").addEventListener("input", (event) => { searchTerm = event.target.value.trim(); render(); });
document.querySelector("#clearRead").addEventListener("click", () => { storedReads.clear(); persistReads(); render(); });
load();
