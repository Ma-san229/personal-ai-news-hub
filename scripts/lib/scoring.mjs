// 記事の点数付け（AI APIなし）。
// 点数 = (収集元の基本点 + 採用実績による収集元の加点 + キーワード点) × 新しさの減衰
// 「採用実績で選び方を育てる」という考え方は research_info を参考にしたが、コードは流用していない。

export const DEFAULT_CONFIG = {
  defaultSourceWeight: 1,
  sourceWeights: {},
  keywords: {},
  keywordScoreCap: 6,
  halfLifeHours: 24,
  adoptionWindowDays: 90,
  adoptionStep: 0.1,
  sourceBoostCap: 1,
  keywordBoostCap: 1.5,
};

export function mergeConfig(raw) {
  return { ...DEFAULT_CONFIG, ...(raw && typeof raw === "object" ? raw : {}) };
}

export function keywordHits(text, keywords) {
  const lower = String(text ?? "").toLowerCase();
  return Object.keys(keywords).filter((keyword) => lower.includes(keyword.toLowerCase()));
}

// 採用された記事から、収集元とキーワードの加点を集計する。
// 直近 adoptionWindowDays 日の採用だけを数え、同じURLは1回として数える。
export function learnFromAdoption(adopted, config, now = Date.now()) {
  const windowMs = config.adoptionWindowDays * 86_400_000;
  const sources = {};
  const keywords = {};
  const seen = new Set();
  for (const entry of Array.isArray(adopted) ? adopted : []) {
    const at = Date.parse(entry?.adoptedAt);
    if (!entry?.url || seen.has(entry.url) || !Number.isFinite(at) || now - at > windowMs || at > now + 86_400_000) continue;
    seen.add(entry.url);
    if (entry.sourceName) sources[entry.sourceName] = (sources[entry.sourceName] || 0) + config.adoptionStep;
    for (const keyword of keywordHits(entry.title, config.keywords)) keywords[keyword] = (keywords[keyword] || 0) + config.adoptionStep;
  }
  return { sources, keywords };
}

export function scoreArticle(article, config, learned, now = Date.now()) {
  const base = config.sourceWeights[article.sourceName] ?? config.defaultSourceWeight;
  const sourceBoost = Math.min(learned.sources[article.sourceName] || 0, config.sourceBoostCap);
  let keywordScore = 0;
  for (const keyword of keywordHits(`${article.title} ${article.excerpt ?? ""}`, config.keywords)) {
    keywordScore += config.keywords[keyword] + Math.min(learned.keywords[keyword] || 0, config.keywordBoostCap);
  }
  keywordScore = Math.min(keywordScore, config.keywordScoreCap);
  const ageHours = Math.max(0, (now - Date.parse(article.publishedAt)) / 3_600_000);
  const recency = Math.pow(0.5, ageHours / config.halfLifeHours);
  return Number(((base + sourceBoost + keywordScore) * recency).toFixed(4));
}
