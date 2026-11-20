import assert from "node:assert/strict";
import test from "node:test";
import { learnFromAdoption, mergeConfig, scoreArticle } from "./scoring.mjs";

const now = Date.parse("2026-11-19T00:00:00Z");
const config = mergeConfig({ sourceWeights: { A: 2 }, keywords: { LLM: 1 } });
const article = (over = {}) => ({ title: "LLMの話", sourceName: "B", publishedAt: "2026-11-19T00:00:00Z", excerpt: "", ...over });
const none = { sources: {}, keywords: {} };

test("収集元の基本点が高いほど点数が高い", () => {
  assert.ok(scoreArticle(article({ sourceName: "A" }), config, none, now) > scoreArticle(article(), config, none, now));
});

test("キーワードに一致すると加点される", () => {
  assert.ok(scoreArticle(article(), config, none, now) > scoreArticle(article({ title: "無関係" }), config, none, now));
});

test("24時間たつと点数が半分になる", () => {
  const fresh = scoreArticle(article(), config, none, now);
  const old = scoreArticle(article({ publishedAt: "2026-11-18T00:00:00Z" }), config, none, now);
  assert.equal(Number((old * 2).toFixed(3)), Number(fresh.toFixed(3)));
});

test("採用実績が収集元とキーワードの加点になり、上限を超えない", () => {
  const adopted = Array.from({ length: 50 }, (_, i) => ({ url: `https://e.com/${i}`, sourceName: "B", title: "LLM", adoptedAt: "2026-11-18T00:00:00Z" }));
  const learned = learnFromAdoption(adopted, config, now);
  const boosted = scoreArticle(article(), config, learned, now);
  const maxed = (config.defaultSourceWeight + config.sourceBoostCap) + 1 + config.keywordBoostCap;
  assert.ok(boosted > scoreArticle(article(), config, none, now));
  assert.ok(boosted <= maxed + 1e-9);
});

test("古い採用・重複・未来日付・不正な日付は数えない", () => {
  const learned = learnFromAdoption([
    { url: "u1", sourceName: "B", title: "LLM", adoptedAt: "2026-01-01T00:00:00Z" },
    { url: "u2", sourceName: "B", title: "LLM", adoptedAt: "2026-11-18T00:00:00Z" },
    { url: "u2", sourceName: "B", title: "LLM", adoptedAt: "2026-11-18T01:00:00Z" },
    { url: "u3", sourceName: "B", title: "LLM", adoptedAt: "2027-01-01T00:00:00Z" },
    { url: "u4", sourceName: "B", title: "LLM", adoptedAt: "not a date" },
  ], config, now);
  assert.equal(Number(learned.sources.B.toFixed(3)), 0.1);
});
