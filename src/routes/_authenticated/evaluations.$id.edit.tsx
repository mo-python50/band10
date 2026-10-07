import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowRight, Copy, Download, ImagePlus, Loader2, Pause, Play, Plus, Printer, Share2, Archive, CheckCheck, Trash2, X,
} from "lucide-react";
import { PageShell } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ResultsView } from "@/components/ResultsView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { copyText, errMsg, shareOrCopy } from "@/lib/share";
import { exportCSV, exportXLSX, fetchResults, useSignedImages } from "@/lib/owner";
import { fmt, fmtDate, type EvaluationStatus } from "@/lib/types";

type Ev = Database["public"]["Tables"]["evaluations"]["Row"];
type Item = Database["public"]["Tables"]["evaluation_items"]["Row"];
type Crit = Database["public"]["Tables"]["criteria"]["Row"];

const tabs = ["setup", "share", "judges", "results"] as const;

export const Route = createFileRoute("/_authenticated/evaluations/$id/edit")({
  validateSearch: z.object({ tab: z.enum(tabs).optional() }),
  head: () => ({
    meta: [
      { title: "إدارة التقييم — بند" },
      { name: "description", content: "إعداد التقييم ومتابعة المحكمين والنتائج." },
      { property: "og:title", content: "إدارة التقييم — بند" },
      { property: "og:description", content: "إعداد التقييم ومتابعة المحكمين والنتائج." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const q = useQuery({
    queryKey: ["eval", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("evaluations").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const ev = q.data;
  const current = tab ?? (ev && ev.status !== "draft" ? "results" : "setup");

  return (
    <PageShell>
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> لوحة التحكم
      </Link>
      {q.isLoading && <Loader2 className="mx-auto size-6 animate-spin text-primary" />}
      {q.error && <p className="text-destructive">{errMsg(q.error)}</p>}
      {ev && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="truncate text-2xl font-bold">{ev.name}</h1>
              <StatusBadge status={ev.status} />
            </div>
            <StatusActions ev={ev} />
          </div>
          <Tabs value={current} onValueChange={(v) => navigate({ search: { tab: v as (typeof tabs)[number] }, replace: true })}>
            <TabsList className="mb-4 w-full justify-start overflow-x-auto">
              <TabsTrigger value="setup">الإعداد</TabsTrigger>
              <TabsTrigger value="share">المشاركة</TabsTrigger>
              <TabsTrigger value="judges">المحكمون</TabsTrigger>
              <TabsTrigger value="results">النتائج</TabsTrigger>
            </TabsList>
            <TabsContent value="setup"><Setup ev={ev} /></TabsContent>
            <TabsContent value="share"><Share ev={ev} /></TabsContent>
            <TabsContent value="judges"><Judges ev={ev} /></TabsContent>
            <TabsContent value="results"><ResultsTab ev={ev} /></TabsContent>
          </Tabs>
        </>
      )}
    </PageShell>
  );
}

/* ---------------- Status ---------------- */

function StatusActions({ ev }: { ev: Ev }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function go(status: EvaluationStatus, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_evaluation_status", { _eval: ev.id, _status: status });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("تم تحديث الحالة");
    qc.invalidateQueries({ queryKey: ["eval", ev.id] });
    qc.invalidateQueries({ queryKey: ["evals"] });
    qc.invalidateQueries({ queryKey: ["results", ev.id] });
  }
  const s = ev.status;
  return (
    <div className="flex flex-wrap gap-2">
      {(s === "draft" || s === "paused") && (
        <Button disabled={busy} onClick={() => go("active", s === "draft" ? "بعد التفعيل لن تستطيع تعديل العناصر والمعايير. متابعة؟" : undefined)}>
          <Play className="size-4" /> {s === "draft" ? "تفعيل التقييم" : "استئناف"}
        </Button>
      )}
      {s === "active" && <Button variant="outline" disabled={busy} onClick={() => go("paused")}><Pause className="size-4" /> إيقاف مؤقت</Button>}
      {(s === "active" || s === "paused") && (
        <Button variant="secondary" disabled={busy} onClick={() => go("completed", "سيتم إغلاق التحكيم وتثبيت النتائج النهائية. متابعة؟")}>
          <CheckCheck className="size-4" /> إنهاء واعتماد النتائج
        </Button>
      )}
      {s === "completed" && <Button variant="outline" disabled={busy} onClick={() => go("archived")}><Archive className="size-4" /> أرشفة</Button>}
    </div>
  );
}

/* ---------------- Setup ---------------- */

function Setup({ ev }: { ev: Ev }) {
  const qc = useQueryClient();
  const locked = ev.status !== "draft";
  const readOnly = ev.status === "archived";
  const [info, setInfo] = useState({ name: ev.name, description: ev.description ?? "", category: ev.category ?? "" });
  useEffect(() => setInfo({ name: ev.name, description: ev.description ?? "", category: ev.category ?? "" }), [ev.name, ev.description, ev.category]);

  async function updateEv(patch: Partial<Ev>) {
    const { error } = await supabase.from("evaluations").update(patch).eq("id", ev.id);
    if (error) return toast.error(errMsg(error));
    qc.invalidateQueries({ queryKey: ["eval", ev.id] });
    qc.invalidateQueries({ queryKey: ["evals"] });
  }

  return (
    <div className="space-y-6">
      <section className="surface space-y-4 p-5">
        <h2 className="text-lg font-bold">معلومات التقييم</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>الاسم</Label>
            <Input disabled={readOnly} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })}
              onBlur={() => info.name.trim() && info.name !== ev.name && updateEv({ name: info.name.trim() })} />
          </div>
          <div className="space-y-1.5">
            <Label>التصنيف</Label>
            <Input disabled={readOnly} placeholder="مثال: مسابقة طبخ" value={info.category} onChange={(e) => setInfo({ ...info, category: e.target.value })}
              onBlur={() => info.category !== (ev.category ?? "") && updateEv({ category: info.category || null })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>الوصف</Label>
          <Textarea disabled={readOnly} rows={3} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })}
            onBlur={() => info.description !== (ev.description ?? "") && updateEv({ description: info.description || null })} />
        </div>
      </section>

      {locked && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          العناصر والمعايير وإعدادات التصويت مقفلة بعد التفعيل حفاظاً على عدالة التقييم.
        </p>
      )}

      <ItemsEditor ev={ev} locked={locked} />
      <CriteriaEditor ev={ev} locked={locked} />

      <section className="surface space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">تصويت الجمهور</h2>
            <p className="text-sm text-muted-foreground">صوت واحد لكل زائر، ويُدمج مع درجات المحكمين بحسب الوزن.</p>
          </div>
          <Switch disabled={locked} checked={ev.audience_enabled}
            onCheckedChange={(v) => updateEv({ audience_enabled: v, audience_weight: v ? (Number(ev.audience_weight) || 20) : 0 })} />
        </div>
        {ev.audience_enabled && (
          <div className="flex items-center gap-3">
            <Label className="shrink-0">وزن الجمهور ٪</Label>
            <NumField disabled={locked} value={Number(ev.audience_weight)} min={1} max={99} onCommit={(v) => updateEv({ audience_weight: v })} />
            <span className="text-sm text-muted-foreground">المحكمون {fmt(100 - Number(ev.audience_weight))}٪</span>
          </div>
        )}
      </section>
    </div>
  );
}

function NumField({ value, onCommit, disabled, min, max }: { value: number; onCommit: (v: number) => void; disabled?: boolean; min?: number; max?: number }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <Input type="number" inputMode="decimal" dir="ltr" className="w-24 tabular" disabled={disabled} value={v} min={min} max={max}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { const n = Number(v); if (Number.isFinite(n) && n !== value) onCommit(n); else setV(String(value)); }} />
  );
}

function ItemsEditor({ ev, locked }: { ev: Ev; locked: boolean }) {
  const qc = useQueryClient();
  const key = ["items", ev.id];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await supabase.from("evaluation_items").select("*").eq("evaluation_id", ev.id).order("position")).data ?? [],
  });
  const imgs = useSignedImages((q.data ?? []).map((i) => i.image_url));
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function add() {
    const { error } = await supabase.from("evaluation_items").insert({ evaluation_id: ev.id, name: "", position: (q.data?.length ?? 0) });
    if (error) toast.error(errMsg(error)); else refresh();
  }
  async function update(id: string, patch: Partial<Item>) {
    const { error } = await supabase.from("evaluation_items").update(patch).eq("id", id);
    if (error) toast.error(errMsg(error)); else refresh();
  }
  async function remove(it: Item) {
    const { error } = await supabase.from("evaluation_items").delete().eq("id", it.id);
    if (error) return toast.error(errMsg(error));
    if (it.image_url) await supabase.storage.from("item-images").remove([it.image_url]);
    refresh();
  }
  async function upload(it: Item, file: File) {
    if (file.size > 5 * 1024 * 1024) return toast.error("الحد الأقصى لحجم الصورة 5 ميجابايت");
    const { data: u } = await supabase.auth.getUser();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${u.user!.id}/${ev.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("item-images").upload(path, file, { contentType: file.type });
    if (error) return toast.error(errMsg(error));
    if (it.image_url) await supabase.storage.from("item-images").remove([it.image_url]);
    update(it.id, { image_url: path });
  }

  return (
    <section className="surface space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">العناصر المتنافسة <span className="text-sm font-normal text-muted-foreground">({q.data?.length ?? 0})</span></h2>
        {!locked && <Button size="sm" variant="outline" onClick={add}><Plus className="size-4" /> إضافة عنصر</Button>}
      </div>
      {!q.data?.length && <p className="text-sm text-muted-foreground">أضف المتسابقين أو الأطباق أو المشاريع التي سيتم تقييمها.</p>}
      <ul className="space-y-3">
        {q.data?.map((it, i) => (
          <li key={it.id} className="flex gap-3 rounded-lg border p-3">
            <label className={"relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted " + (locked ? "" : "cursor-pointer")}>
              {it.image_url && imgs.data?.[it.image_url] ? <img src={imgs.data[it.image_url]} alt="" className="size-full object-cover" /> : <ImagePlus className="size-5 text-muted-foreground" />}
              {!locked && <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(it, e.target.files[0])} />}
            </label>
            <div className="min-w-0 flex-1 space-y-2">
              <Input disabled={locked} placeholder={`اسم العنصر ${i + 1}`} defaultValue={it.name}
                onBlur={(e) => e.target.value !== it.name && update(it.id, { name: e.target.value })} />
              <Input disabled={locked} placeholder="وصف قصير (اختياري)" defaultValue={it.description ?? ""}
                onBlur={(e) => e.target.value !== (it.description ?? "") && update(it.id, { description: e.target.value || null })} />
            </div>
            {!locked && (
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" aria-label="حذف" onClick={() => remove(it)}><Trash2 className="size-4 text-destructive" /></Button>
                {it.image_url && <Button size="icon" variant="ghost" aria-label="إزالة الصورة" onClick={() => update(it.id, { image_url: null })}><X className="size-4" /></Button>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CriteriaEditor({ ev, locked }: { ev: Ev; locked: boolean }) {
  const qc = useQueryClient();
  const key = ["criteria", ev.id];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await supabase.from("criteria").select("*").eq("evaluation_id", ev.id).order("position")).data ?? [],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const sum = (q.data ?? []).reduce((a, c) => a + Number(c.weight), 0);

  async function add() {
    const { error } = await supabase.from("criteria").insert({ evaluation_id: ev.id, name: "", weight: Math.max(0, 100 - sum), position: q.data?.length ?? 0 });
    if (error) toast.error(errMsg(error)); else refresh();
  }
  async function update(id: string, patch: Partial<Crit>) {
    const { error } = await supabase.from("criteria").update(patch).eq("id", id);
    if (error) toast.error(errMsg(error)); else refresh();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("criteria").delete().eq("id", id);
    if (error) toast.error(errMsg(error)); else refresh();
  }
  async function balance() {
    const list = q.data ?? [];
    if (!list.length) return;
    const base = Math.floor(100 / list.length);
    await Promise.all(list.map((c, i) => supabase.from("criteria").update({ weight: i === 0 ? 100 - base * (list.length - 1) : base }).eq("id", c.id)));
    refresh();
  }

  return (
    <section className="surface space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">معايير التقييم</h2>
        {!locked && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={balance}>توزيع متساوٍ</Button>
            <Button size="sm" variant="outline" onClick={add}><Plus className="size-4" /> إضافة معيار</Button>
          </div>
        )}
      </div>
      <p className={"text-sm " + (sum === 100 ? "text-success" : "text-destructive")}>مجموع الأوزان: <span className="tabular">{fmt(sum)}</span>٪ {sum !== 100 && "— يجب أن يساوي 100"}</p>
      <ul className="space-y-3">
        {q.data?.map((c, i) => (
          <li key={c.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex gap-2">
              <Input disabled={locked} placeholder={`اسم المعيار ${i + 1} (مثال: الطعم)`} defaultValue={c.name}
                onBlur={(e) => e.target.value !== c.name && update(c.id, { name: e.target.value })} />
              {!locked && <Button size="icon" variant="ghost" aria-label="حذف" onClick={() => remove(c.id)}><Trash2 className="size-4 text-destructive" /></Button>}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5">الوزن ٪ <NumField disabled={locked} value={Number(c.weight)} min={0} max={100} onCommit={(v) => update(c.id, { weight: v })} /></span>
              <span className="flex items-center gap-1.5">من <NumField disabled={locked} value={Number(c.min_score)} onCommit={(v) => update(c.id, { min_score: v })} /></span>
              <span className="flex items-center gap-1.5">إلى <NumField disabled={locked} value={Number(c.max_score)} onCommit={(v) => update(c.id, { max_score: v })} /></span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- Share ---------------- */

function Share({ ev }: { ev: Ev }) {
  const qc = useQueryClient();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const joinUrl = `${origin}/join?code=${ev.judge_code}`;
  const voteUrl = `${origin}/vote/${ev.public_token}`;
  const resultsUrl = `${origin}/results/${ev.public_token}`;
  async function toggle(patch: Partial<Ev>) {
    const { error } = await supabase.from("evaluations").update(patch).eq("id", ev.id);
    if (error) toast.error(errMsg(error)); else qc.invalidateQueries({ queryKey: ["eval", ev.id] });
  }
  return (
    <div className="space-y-4">
      {ev.status === "draft" && <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">فعّل التقييم أولاً حتى يتمكن المحكمون والجمهور من الدخول.</p>}
      <div className="surface p-5 text-center">
        <p className="text-sm text-muted-foreground">رمز المحكمين</p>
        <p dir="ltr" className="my-2 font-mono text-4xl font-bold tracking-widest text-primary">{ev.judge_code}</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => copyText(ev.judge_code, "تم نسخ الرمز")}><Copy className="size-4" /> نسخ الرمز</Button>
          <Button variant="outline" size="sm" onClick={() => shareOrCopy({ title: ev.name, text: `انضم كمحكم في «${ev.name}» بالرمز ${ev.judge_code}`, url: joinUrl })}><Share2 className="size-4" /> مشاركة رابط المحكمين</Button>
        </div>
      </div>
      {ev.audience_enabled && <LinkRow label="رابط تصويت الجمهور" url={voteUrl} title={ev.name} />}
      <div className="surface space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <div><p className="font-semibold">نشر النتائج للعامة</p><p className="text-sm text-muted-foreground">يمكن لأي شخص يملك الرابط رؤية الترتيب.</p></div>
          <Switch checked={ev.public_results} disabled={ev.status === "archived"} onCheckedChange={(v) => toggle({ public_results: v })} />
        </div>
        {ev.public_results && <LinkRow label="رابط النتائج" url={resultsUrl} title={ev.name} bare />}
      </div>
    </div>
  );
}

function LinkRow({ label, url, title, bare }: { label: string; url: string; title: string; bare?: boolean }) {
  return (
    <div className={bare ? "space-y-2" : "surface space-y-2 p-5"}>
      <p className="font-semibold">{label}</p>
      <div className="flex gap-2">
        <Input readOnly dir="ltr" value={url} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button variant="outline" size="icon" aria-label="نسخ" onClick={() => copyText(url, "تم نسخ الرابط")}><Copy className="size-4" /></Button>
        <Button variant="outline" size="icon" aria-label="مشاركة" onClick={() => shareOrCopy({ title, url })}><Share2 className="size-4" /></Button>
      </div>
    </div>
  );
}

/* ---------------- Judges ---------------- */

function Judges({ ev }: { ev: Ev }) {
  const q = useQuery({
    queryKey: ["judges", ev.id],
    refetchInterval: ev.status === "active" ? 10000 : false,
    queryFn: async () => {
      const [j, s, ni, nc] = await Promise.all([
        supabase.from("judges").select("id, display_name, joined_at, last_active_at, submitted_at").eq("evaluation_id", ev.id).order("joined_at"),
        supabase.from("scores").select("judge_id").eq("evaluation_id", ev.id),
        supabase.from("evaluation_items").select("id", { count: "exact", head: true }).eq("evaluation_id", ev.id),
        supabase.from("criteria").select("id", { count: "exact", head: true }).eq("evaluation_id", ev.id),
      ]);
      const counts: Record<string, number> = {};
      (s.data ?? []).forEach((r) => (counts[r.judge_id] = (counts[r.judge_id] ?? 0) + 1));
      return { judges: j.data ?? [], counts, total: (ni.count ?? 0) * (nc.count ?? 0) };
    },
  });
  if (q.isLoading) return <Loader2 className="mx-auto size-6 animate-spin text-primary" />;
  const d = q.data!;
  if (!d.judges.length) return <p className="py-10 text-center text-muted-foreground">لم ينضم أي محكم بعد. شارك الرمز {ev.judge_code}.</p>;
  return (
    <ul className="surface divide-y">
      {d.judges.map((j) => {
        const n = d.counts[j.id] ?? 0;
        return (
          <li key={j.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-semibold">{j.display_name}</p>
              <p className="text-xs text-muted-foreground">انضم {fmtDate(j.joined_at)} · آخر نشاط {fmtDate(j.last_active_at)}</p>
            </div>
            {j.submitted_at
              ? <span className="rounded-full bg-success/12 px-3 py-1 text-xs font-medium text-success">أرسل التقييم</span>
              : <span className="tabular text-sm text-muted-foreground">{n}/{d.total}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- Results ---------------- */

function ResultsTab({ ev }: { ev: Ev }) {
  const q = useQuery({
    queryKey: ["results", ev.id],
    enabled: ev.status !== "draft",
    refetchInterval: ev.status === "active" ? 15000 : false,
    queryFn: () => fetchResults(ev.id),
  });
  const imgs = useSignedImages((q.data?.items ?? []).map((i) => i.image_url));
  if (ev.status === "draft") return <p className="py-10 text-center text-muted-foreground">ستظهر النتائج هنا بعد تفعيل التقييم.</p>;
  if (q.isLoading) return <Loader2 className="mx-auto size-6 animate-spin text-primary" />;
  if (q.error) return <p className="text-destructive">{errMsg(q.error)}</p>;
  const r = q.data!;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-muted-foreground">{ev.results_snapshot ? "نتائج نهائية معتمدة" : "نتائج مباشرة — تتحدث تلقائياً"}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCSV(r, ev.name)}><Download className="size-4" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={() => exportXLSX(r, ev.name)}><Download className="size-4" /> Excel</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="size-4" /> طباعة / PDF</Button>
        </div>
      </div>
      <div className="hidden print:block"><h1 className="text-2xl font-bold">{ev.name}</h1><p className="text-sm">{fmtDate(r.computed_at)}</p></div>
      <ResultsView results={r} images={imgs.data ?? {}} />
    </div>
  );
}
