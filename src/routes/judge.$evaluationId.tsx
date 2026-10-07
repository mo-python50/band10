import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Logo } from "@/components/AppHeader";
import { getJudgeState, reopenJudge, saveComment, saveScore, submitJudge } from "@/lib/public.functions";
import { errMsg } from "@/lib/share";
import { fmt } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/judge/$evaluationId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "صفحة المحكم — بند" },
      { name: "description", content: "قيّم العناصر وفق المعايير المحددة." },
      { property: "og:title", content: "صفحة المحكم — بند" },
      { property: "og:description", content: "قيّم العناصر وفق المعايير المحددة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JudgePage,
});

function JudgePage() {
  const { evaluationId } = Route.useParams();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setToken(localStorage.getItem(`band:judge:${evaluationId}`));
  }, [evaluationId]);

  if (token === undefined) return <Centered><Loader2 className="size-6 animate-spin text-primary" /></Centered>;
  if (!token)
    return (
      <Centered>
        <p className="text-lg font-semibold">لا توجد جلسة محكم على هذا الجهاز</p>
        <Button asChild className="mt-4"><Link to="/join">الانضمام بالرمز</Link></Button>
      </Centered>
    );
  return <JudgeWorkspace token={token} evaluationId={evaluationId} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center px-4 text-center"><div>{children}</div></div>;
}

type ScoreMap = Record<string, number>; // `${item}:${criterion}`

function JudgeWorkspace({ token, evaluationId }: { token: string; evaluationId: string }) {
  const fetchState = useServerFn(getJudgeState);
  const save = useServerFn(saveScore);
  const saveNote = useServerFn(saveComment);
  const submit = useServerFn(submitJudge);
  const reopen = useServerFn(reopenJudge);
  const [reopening, setReopening] = useState(false);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["judge", evaluationId],
    queryFn: () => fetchState({ data: { token } }),
    retry: false,
  });

  const [scores, setScores] = useState<ScoreMap>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q.data) return;
    const m: ScoreMap = {};
    q.data.scores.forEach((s) => (m[`${s.item_id}:${s.criterion_id}`] = s.score));
    setScores(m);
    const n: Record<string, string> = {};
    q.data.comments.forEach((c) => (n[c.item_id] = c.comment));
    setNotes(n);
  }, [q.data]);

  const items = q.data?.items ?? [];
  const criteria = q.data?.criteria ?? [];
  const total = items.length * criteria.length;
  const filled = Object.keys(scores).length;
  const itemDone = (id: string) => criteria.every((c) => scores[`${id}:${c.id}`] !== undefined);

  const readOnly = !!q.data?.judge.submitted_at || q.data?.evaluation.status !== "active";

  if (q.isLoading) return <Centered><Loader2 className="size-6 animate-spin text-primary" /></Centered>;
  if (q.error)
    return (
      <Centered>
        <p className="text-lg font-semibold">{errMsg(q.error)}</p>
        <Button asChild className="mt-4"><Link to="/join">الانضمام مجدداً</Link></Button>
      </Centered>
    );
  const data = q.data!;

  if (data.judge.submitted_at)
    return (
      <Centered>
        <CheckCircle2 className="mx-auto size-14 text-success" />
        <h1 className="mt-4 text-2xl font-bold">شكراً {data.judge.name}</h1>
        <p className="mt-2 text-muted-foreground">تم إرسال تقييمك لـ «{data.evaluation.name}». النتائج يحسبها النظام تلقائياً.</p>
        {data.evaluation.status === "active" && (
          <Button
            variant="outline"
            className="mt-6"
            disabled={reopening}
            onClick={async () => {
              setReopening(true);
              try {
                await reopen({ data: { token } });
                setIdx(0);
                toast.success("يمكنك الآن تعديل درجاتك ثم إعادة الإرسال");
                await qc.invalidateQueries({ queryKey: ["judge", evaluationId] });
              } catch (e) {
                toast.error(errMsg(e));
              } finally {
                setReopening(false);
              }
            }}
          >
            {reopening && <Loader2 className="size-4 animate-spin" />} تعديل تقييمي
          </Button>
        )}
      </Centered>
    );

  const item = items[idx];
  const onReview = idx >= items.length;

  async function setScore(criterionId: string, value: number) {
    if (readOnly || !item) return;
    const key = `${item.id}:${criterionId}`;
    const prev = scores[key];
    setScores((s) => ({ ...s, [key]: value }));
    setSaving((n) => n + 1);
    try {
      await save({ data: { token, itemId: item.id, criterionId, score: value } });
    } catch (e) {
      setScores((s) => {
        const c = { ...s };
        if (prev === undefined) delete c[key];
        else c[key] = prev;
        return c;
      });
      toast.error(errMsg(e));
    } finally {
      setSaving((n) => n - 1);
    }
  }

  function setNote(v: string) {
    if (!item) return;
    const itemId = item.id;
    setNotes((n) => ({ ...n, [itemId]: v }));
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      setSaving((n) => n + 1);
      try {
        await saveNote({ data: { token, itemId, comment: v } });
      } catch (e) {
        toast.error(errMsg(e));
      } finally {
        setSaving((n) => n - 1);
      }
    }, 700);
  }

  async function doSubmit() {
    setSubmitting(true);
    try {
      await submit({ data: { token } });
      toast.success("تم إرسال تقييمك بنجاح");
      await qc.invalidateQueries({ queryKey: ["judge", evaluationId] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSubmitting(false);
      setConfirm(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div className="text-end">
            <p className="line-clamp-1 text-sm font-semibold">{data.evaluation.name}</p>
            <p className="text-xs text-muted-foreground">
              {data.judge.name} · {saving > 0 ? "جارٍ الحفظ…" : "محفوظ تلقائياً"}
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={filled} aria-valuemax={total}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${total ? (filled / total) * 100 : 0}%` }} />
            </div>
            <span className="tabular">{filled}/{total}</span>
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {items.map((it, i) => (
              <button
                key={it.id}
                onClick={() => setIdx(i)}
                aria-label={`العنصر ${i + 1}: ${it.name}`}
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-md border text-xs font-medium tabular",
                  i === idx ? "border-primary bg-primary text-primary-foreground" : itemDone(it.id) ? "border-success/40 bg-success/10 text-success" : "bg-card",
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setIdx(items.length)}
              className={cn("shrink-0 rounded-md border px-3 text-xs font-medium", onReview ? "border-primary bg-primary text-primary-foreground" : "bg-card")}
            >
              إرسال
            </button>
          </div>
        </div>
      </header>

      {data.evaluation.status !== "active" && (
        <div className="mx-auto mt-4 w-full max-w-2xl px-4">
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">التقييم متوقف حالياً من المالك. لا يمكن تسجيل الدرجات الآن.</p>
        </div>
      )}

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        {!onReview && item ? (
          <div key={item.id} className="animate-rise space-y-4">
            <div className="surface overflow-hidden">
              {item.image && <img src={item.image} alt={item.name} className="aspect-[16/9] w-full object-cover" />}
              <div className="p-4">
                <p className="text-xs text-muted-foreground">العنصر {idx + 1} من {items.length}</p>
                <h1 className="mt-1 text-2xl font-bold">{item.name}</h1>
                {item.description && <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>}
              </div>
            </div>

            {criteria.map((c) => {
              const val = scores[`${item.id}:${c.id}`];
              const range = c.max_score - c.min_score;
              const integerGrid = range <= 10 && Number.isInteger(c.min_score) && Number.isInteger(c.max_score);
              return (
                <fieldset key={c.id} className="surface p-4">
                  <legend className="sr-only">{c.name}</legend>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{c.name}</p>
                      {c.description && <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>}
                    </div>
                    <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground tabular">{fmt(c.weight)}٪</span>
                  </div>
                  {integerGrid ? (
                    <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10" dir="ltr">
                      {Array.from({ length: range + 1 }, (_, k) => c.min_score + k).map((v) => (
                        <button
                          key={v}
                          type="button"
                          disabled={readOnly}
                          onClick={() => setScore(c.id, v)}
                          aria-pressed={val === v}
                          aria-label={`${c.name}: ${v}`}
                          className={cn(
                            "h-12 rounded-lg border text-base font-semibold tabular transition active:scale-95 disabled:opacity-50",
                            val === v ? "border-primary bg-primary text-primary-foreground shadow-soft" : "bg-background hover:border-primary/50",
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-4" dir="ltr">
                      <Slider
                        min={c.min_score}
                        max={c.max_score}
                        step={range > 20 ? 1 : 0.5}
                        value={[val ?? c.min_score]}
                        disabled={readOnly}
                        onValueCommit={(v) => v[0] !== undefined && setScore(c.id, v[0])}
                        aria-label={c.name}
                      />
                      <span className="w-14 text-center text-lg font-bold tabular">{val ?? "—"}</span>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">النطاق {fmt(c.min_score)} – {fmt(c.max_score)}</p>
                </fieldset>
              );
            })}

            <div className="surface p-4">
              <label htmlFor="note" className="text-sm font-semibold">ملاحظة (اختياري)</label>
              <Textarea id="note" className="mt-2" rows={3} maxLength={2000} disabled={readOnly} value={notes[item.id] ?? ""} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="animate-rise space-y-4">
            <h1 className="text-2xl font-bold">مراجعة وإرسال</h1>
            <div className="surface divide-y">
              {items.map((it, i) => (
                <button key={it.id} onClick={() => setIdx(i)} className="flex w-full items-center justify-between p-4 text-start hover:bg-muted/50">
                  <span className="font-medium">{i + 1}. {it.name}</span>
                  {itemDone(it.id) ? <CheckCircle2 className="size-5 text-success" /> : <span className="text-xs text-destructive">غير مكتمل</span>}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">بعد الإرسال لا يمكن تعديل الدرجات. لن يرى أحد درجاتك الفردية سوى مالك التقييم.</p>
            <Button size="lg" className="h-14 w-full text-base" disabled={filled < total || readOnly} onClick={() => setConfirm(true)}>
              <Send className="size-5" />
              إرسال التقييم النهائي
            </Button>
            {filled < total && <p className="text-center text-sm text-destructive">بقي {total - filled} درجة لم تُسجّل بعد</p>}
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-3 px-4 py-3">
          <Button variant="outline" size="lg" className="h-12 flex-1" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
            <ChevronRight className="size-5" />
            السابق
          </Button>
          <Button size="lg" className="h-12 flex-1" disabled={onReview} onClick={() => setIdx((i) => Math.min(items.length, i + 1))}>
            {idx === items.length - 1 ? "المراجعة" : "التالي"}
            <ChevronLeft className="size-5" />
          </Button>
        </div>
      </footer>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الإرسال النهائي</AlertDialogTitle>
            <AlertDialogDescription>لن تتمكن من تعديل أي درجة بعد الإرسال. هل أنت متأكد؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doSubmit(); }} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              نعم، أرسل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// keep useMemo import referenced for tree-shaking clarity
void useMemo;
