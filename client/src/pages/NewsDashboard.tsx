import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, BookOpenCheck, Check, Clock3, ExternalLink, Filter, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type CategoryFilter = "all" | "ai_seitaishi" | "engineer";
type StatusFilter = "all" | "read" | "unread";

const categoryMeta = {
  ai_seitaishi: { label: "AI整体師向け", tone: "bg-[#eef3de] text-[#486035] border-[#dbe6bf]" },
  engineer: { label: "エンジニア向け", tone: "bg-[#e8f0ed] text-[#28584d] border-[#cfe1db]" },
};

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(date));
}

export default function NewsDashboard() {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const input = useMemo(() => ({ category, status, search: search.trim() || undefined }), [category, status, search]);
  const utils = trpc.useUtils();
  const dashboard = trpc.news.dashboard.useQuery(input);
  const refresh = trpc.news.refreshAll.useMutation({
    onSuccess: async result => {
      await utils.news.dashboard.invalidate();
      await utils.news.feeds.invalidate();
      result.failed ? toast.warning(`${result.added}件を追加しました。一部のフィードで取得できませんでした。`) : toast.success(`${result.added}件の新規記事を追加しました。`);
    },
    onError: error => toast.error(error.message),
  });
  const setReadState = trpc.news.setReadState.useMutation({ onSuccess: () => utils.news.dashboard.invalidate(), onError: error => toast.error(error.message) });
  const stats = dashboard.data?.stats;
  const articles = dashboard.data?.articles ?? [];

  return <DashboardLayout>
    <section className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#617a74]"><Sparkles className="h-3.5 w-3.5" /> Curated daily</div>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] text-[#152723] sm:text-4xl">今日のインテリジェンス</h1>
          <p className="mt-3 text-sm leading-6 text-[#66736f]">AI整体師向けとエンジニア向けの情報を、一つの落ち着いたライブラリで確認できます。</p>
        </div>
        <Button onClick={() => refresh.mutate()} disabled={refresh.isPending} className="h-11 rounded-xl bg-[#143b35] px-5 text-white hover:bg-[#0f302b]">
          {refresh.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} 最新記事を取得
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="登録記事" value={stats?.total} icon={<BookOpenCheck />} />
        <StatCard label="未読" value={stats?.unread} icon={<Clock3 />} emphasis />
        <StatCard label="AI整体師向け" value={stats?.aiSeitaishi} icon={<Sparkles />} />
        <StatCard label="エンジニア向け" value={stats?.engineer} icon={<Filter />} />
      </div>

      <div className="mt-9 rounded-[1.6rem] border border-[#143b35]/10 bg-white/80 p-3 shadow-[0_18px_45px_rgba(30,58,50,0.06)] backdrop-blur sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c9894]" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="タイトル・ソース名で検索" className="h-11 rounded-xl border-[#dce3df] bg-[#fcfcfa] pl-10 shadow-none placeholder:text-[#9aa5a1] focus-visible:ring-[#78998f]" /></div>
          <div className="flex flex-wrap gap-2">
            {(["all", "ai_seitaishi", "engineer"] as CategoryFilter[]).map(item => <FilterPill key={item} active={category === item} onClick={() => setCategory(item)}>{item === "all" ? "すべて" : categoryMeta[item].label}</FilterPill>)}
          </div>
          <div className="h-6 w-px bg-[#dce3df] max-xl:hidden" />
          <div className="flex gap-2">{(["all", "unread", "read"] as StatusFilter[]).map(item => <FilterPill key={item} active={status === item} onClick={() => setStatus(item)}>{item === "all" ? "全件" : item === "unread" ? "未読" : "既読"}</FilterPill>)}</div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between"><p className="text-sm text-[#71807b]"><span className="font-semibold text-[#22352f]">{articles.length}</span> 件の記事</p><Link href="/feeds" className="group flex items-center gap-1.5 text-sm font-medium text-[#315f55] hover:text-[#143b35]">フィードを管理 <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link></div>

      {dashboard.isLoading ? <div className="grid min-h-[360px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#58756d]" /></div> : articles.length === 0 ? <EmptyState isFiltered={Boolean(search || category !== "all" || status !== "all")} onRefresh={() => refresh.mutate()} loading={refresh.isPending} /> :
        <div className="mt-5 grid gap-3 lg:grid-cols-2">{articles.map((article, index) => <motion.article key={article.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: Math.min(index * 0.025, 0.2) }} className={`group relative overflow-hidden rounded-[1.35rem] border p-5 transition-all ${article.isRead ? "border-[#dfe5e1] bg-[#f9faf8] opacity-75" : "border-[#d5e1db] bg-white shadow-[0_12px_26px_rgba(26,55,47,0.055)] hover:-translate-y-0.5 hover:shadow-[0_17px_32px_rgba(26,55,47,0.09)]"}`}>
          <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 flex-wrap items-center gap-2"><Badge variant="outline" className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${categoryMeta[article.category].tone}`}>{categoryMeta[article.category].label}</Badge><span className="truncate text-xs font-medium text-[#7a8782]">{article.sourceName}</span></div><button onClick={() => setReadState.mutate({ articleId: article.id, isRead: !article.isRead })} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78998f] ${article.isRead ? "border-[#bfcec7] bg-[#e7efeb] text-[#477062]" : "border-[#dce5e0] text-[#a3b0aa] hover:border-[#8fac9f] hover:text-[#315f55]"}`} aria-label={article.isRead ? "未読に戻す" : "既読にする"}>{article.isRead ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</button></div>
          <h2 className="mt-4 line-clamp-2 text-[17px] font-semibold leading-6 tracking-[-0.02em] text-[#1b302a]">{article.title}</h2>
          <dl className="mt-5 grid grid-cols-[82px_1fr] gap-y-2 text-xs leading-5"><dt className="text-[#8b9692]">URL</dt><dd className="break-all font-medium text-[#5b736b]"><a href={article.url} target="_blank" rel="noreferrer" className="underline decoration-[#bfd2cb] underline-offset-2 hover:text-[#143b35]">{article.url}</a></dd><dt className="text-[#8b9692]">公開日</dt><dd className="font-medium text-[#52635e]">{formatDate(article.publishedAt)}</dd><dt className="text-[#8b9692]">ソース名</dt><dd className="truncate font-medium text-[#52635e]">{article.sourceName}</dd><dt className="text-[#8b9692]">カテゴリ</dt><dd className="font-medium text-[#52635e]">{categoryMeta[article.category].label}</dd></dl>
          <a href={article.url} target="_blank" rel="noreferrer" onClick={() => { if (!article.isRead) setReadState.mutate({ articleId: article.id, isRead: true }); }} className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-[#315f55] hover:text-[#143b35]">元記事を開く <ExternalLink className="h-3.5 w-3.5" /></a>
        </motion.article>)}</div>}
    </section>
  </DashboardLayout>;
}

function StatCard({ label, value, icon, emphasis = false }: { label: string; value?: number; icon: React.ReactNode; emphasis?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${emphasis ? "border-[#d4e2bc] bg-[#eaf1d9]" : "border-[#143b35]/8 bg-white"}`}><div className="flex items-center justify-between"><p className="text-xs font-medium text-[#66736f]">{label}</p><span className="text-[#58756d] [&>svg]:h-4 [&>svg]:w-4">{icon}</span></div><p className="mt-3 text-2xl font-semibold tracking-[-0.045em] text-[#1b302a]">{value ?? "—"}<span className="ml-1 text-xs font-medium tracking-normal text-[#71807b]">件</span></p></div>;
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`h-9 rounded-lg px-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78998f] ${active ? "bg-[#143b35] text-white" : "bg-[#f2f4f1] text-[#60706a] hover:bg-[#e7ece8]"}`}>{children}</button>;
}

function EmptyState({ isFiltered, onRefresh, loading }: { isFiltered: boolean; onRefresh: () => void; loading: boolean }) {
  return <div className="mt-5 grid min-h-[330px] place-items-center rounded-[1.6rem] border border-dashed border-[#cddbd5] bg-white/55 p-8 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e7efeb] text-[#315f55]"><BookOpenCheck className="h-5 w-5" /></div><h2 className="mt-5 text-lg font-semibold text-[#22352f]">{isFiltered ? "条件に一致する記事はありません" : "まだ記事がありません"}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#71807b]">{isFiltered ? "検索語またはフィルターを変更してください。" : "初期フィードを登録済みです。最新記事を取得してライブラリを始めましょう。"}</p>{!isFiltered && <Button onClick={onRefresh} disabled={loading} className="mt-5 rounded-xl bg-[#143b35] text-white hover:bg-[#0f302b]">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 記事を取得する</Button>}</div></div>;
}
