import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Clock3, Link2, Loader2, Plus, RefreshCw, Rss, Settings2, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

const categoryLabels = { ai_seitaishi: "AI整体師向け", engineer: "エンジニア向け" };

function dateTime(date?: Date | string | null) {
  return date ? new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date)) : "未取得";
}

export default function FeedManager() {
  const utils = trpc.useUtils();
  const feeds = trpc.news.feeds.useQuery();
  const schedule = trpc.news.schedule.get.useQuery();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<"ai_seitaishi" | "engineer">("engineer");
  const [cronExpression, setCronExpression] = useState("0 0 */6 * * *");
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const isPreview = import.meta.env.DEV;
  const invalidate = async () => { await Promise.all([utils.news.feeds.invalidate(), utils.news.dashboard.invalidate(), utils.news.schedule.get.invalidate()]); };
  const addFeed = trpc.news.addFeed.useMutation({ onSuccess: async () => { setName(""); setUrl(""); await invalidate(); toast.success("RSSフィードを追加しました。"); }, onError: error => toast.error(error.message) });
  const deleteFeed = trpc.news.deleteFeed.useMutation({ onSuccess: invalidate, onError: error => toast.error(error.message) });
  const setFeedActive = trpc.news.setFeedActive.useMutation({ onSuccess: invalidate, onError: error => toast.error(error.message) });
  const refreshFeed = trpc.news.refreshFeed.useMutation({ onSuccess: async result => { await invalidate(); toast.success(`${result.added}件の新規記事を取得しました。`); }, onError: error => toast.error(error.message) });
  const configureSchedule = trpc.news.schedule.configure.useMutation({ onSuccess: async () => { await invalidate(); toast.success("定期取得の設定を保存しました。"); }, onError: error => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); addFeed.mutate({ name, url, category }); };

  return <DashboardLayout><section className="mx-auto max-w-6xl">
    <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#617a74]">Source control</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-[#152723] sm:text-4xl">フィード管理</h1><p className="mt-3 text-sm leading-6 text-[#66736f]">RSSまたはAtomのURLを登録し、表示カテゴリと取得状態を管理します。</p></div>
    <div className="mt-9 grid gap-5 xl:grid-cols-[1.05fr_1.5fr]">
      <div className="space-y-5">
        <form onSubmit={submit} className="rounded-[1.5rem] border border-[#143b35]/10 bg-white p-5 shadow-[0_12px_28px_rgba(26,55,47,0.05)]"><div className="flex items-center gap-2 text-[#24463d]"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#e8f0ed]"><Plus className="h-4 w-4" /></div><h2 className="font-semibold">フィードを追加</h2></div><div className="mt-5 space-y-4"><div className="space-y-2"><Label htmlFor="feed-name">ソース名</Label><Input id="feed-name" value={name} onChange={event => setName(event.target.value)} placeholder="例: 公式開発ブログ" required className="h-10 rounded-xl" /></div><div className="space-y-2"><Label htmlFor="feed-url">RSS / Atom URL</Label><Input id="feed-url" type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com/feed.xml" required className="h-10 rounded-xl" /></div><div className="space-y-2"><Label>カテゴリ</Label><Select value={category} onValueChange={value => setCategory(value as typeof category)}><SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ai_seitaishi">AI整体師向け</SelectItem><SelectItem value="engineer">エンジニア向け</SelectItem></SelectContent></Select></div><div className="rounded-xl border border-[#d9e6e0] bg-[#f3f8f5] p-3 text-xs leading-5 text-[#557169]"><p className="font-semibold text-[#315f55]">noteを登録する場合</p><p className="mt-1">読みたいクリエイターまたはマガジンのページからRSSリンクをコピーし、この欄に登録してください。記事一覧のRSSで問題なく収集できます。</p><a href="https://www.help-note.com/hc/ja/articles/900001001246-%E8%A8%98%E4%BA%8B%E3%81%AE%E5%85%A8%E6%96%87%E3%82%92RSS%E3%81%A7%E5%8F%97%E3%81%91%E5%8F%96%E3%82%8B%E8%A8%AD%E5%AE%9A" target="_blank" rel="noreferrer" className="mt-1.5 inline-flex font-semibold text-[#315f55] underline underline-offset-2">note公式のRSS案内を開く</a></div><Button type="submit" disabled={addFeed.isPending} className="h-10 w-full rounded-xl bg-[#143b35] text-white hover:bg-[#0f302b]">{addFeed.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}追加する</Button></div></form>
        <div className="rounded-[1.5rem] border border-[#cbdcc4] bg-[#edf3df] p-5"><div className="flex items-center gap-2 text-[#385331]"><Clock3 className="h-4 w-4" /><h2 className="font-semibold">定期取得</h2></div><p className="mt-2 text-xs leading-5 text-[#607456]">設定は公開後のサイトで有効になります。cron式はUTC・6項目です。</p><div className="mt-4 space-y-3"><Input value={cronExpression} onChange={event => setCronExpression(event.target.value)} disabled={isPreview} className="h-10 rounded-xl border-[#c2d2bc] bg-white/80 font-mono text-xs" /><div className="flex items-center justify-between"><Label htmlFor="schedule-enabled" className="text-xs text-[#52664b]">自動取得を有効にする</Label><Switch id="schedule-enabled" checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} disabled={isPreview} /></div><Button onClick={() => configureSchedule.mutate({ cronExpression, enabled: scheduleEnabled })} disabled={configureSchedule.isPending || isPreview} variant="outline" className="h-10 w-full rounded-xl border-[#aabea5] bg-white/70 text-[#35532e] hover:bg-white">{configureSchedule.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isPreview ? "公開後に設定できます" : "設定を保存"}</Button>{schedule.data?.scheduleCronTaskUid && <p className="flex items-center gap-1.5 text-[11px] text-[#55734e]"><CheckCircle2 className="h-3.5 w-3.5" />登録済み：{schedule.data.cronExpression}</p>}</div></div>
      </div>
      <div className="rounded-[1.5rem] border border-[#143b35]/10 bg-white p-5 shadow-[0_12px_28px_rgba(26,55,47,0.05)]"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-[#1d332c]">登録済みフィード</h2><p className="mt-1 text-xs text-[#71807b]">{feeds.data?.length ?? 0} 件の情報源</p></div><Rss className="h-5 w-5 text-[#59776e]" /></div>{feeds.isLoading ? <div className="grid min-h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#59776e]" /></div> : <div className="mt-5 divide-y divide-[#e7ece8]">{feeds.data?.map(feed => <div key={feed.id} className="py-4 first:pt-0 last:pb-0"><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#edf3ef] text-[#477267]"><Link2 className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-[#20362f]">{feed.name}</h3><Badge variant="outline" className="border-[#d3e3dc] bg-[#f0f7f3] text-[10px] text-[#427160]">{categoryLabels[feed.category]}</Badge>{!feed.isActive && <Badge variant="outline" className="text-[10px] text-[#7d8581]">停止中</Badge>}</div><p className="mt-1 truncate text-xs text-[#7b8883]">{feed.url}</p><p className="mt-2 text-[11px] text-[#8a9692]">最終取得: {dateTime(feed.lastFetchedAt)} {feed.lastFetchStatus === "error" ? "・取得エラー" : ""}</p></div><div className="flex shrink-0 items-center gap-1"><Button onClick={() => refreshFeed.mutate({ feedId: feed.id })} disabled={refreshFeed.isPending || !feed.isActive} variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-[#58766d]" aria-label="このフィードを更新"><RefreshCw className={`h-3.5 w-3.5 ${refreshFeed.isPending ? "animate-spin" : ""}`} /></Button><Button onClick={() => deleteFeed.mutate({ feedId: feed.id })} disabled={deleteFeed.isPending} variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-[#a56a65] hover:bg-[#fff0ed] hover:text-[#9e4b45]" aria-label="フィードを削除"><Trash2 className="h-3.5 w-3.5" /></Button></div></div><div className="mt-3 flex items-center justify-end gap-2"><span className="text-[11px] text-[#7d8985]">取得を有効化</span><Switch checked={feed.isActive} onCheckedChange={checked => setFeedActive.mutate({ feedId: feed.id, isActive: checked })} /></div></div>)}</div>}</div>
    </div>
  </section></DashboardLayout>;
}
