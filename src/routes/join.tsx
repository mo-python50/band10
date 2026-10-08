import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { loadSessions, saveSession, type JudgeSession } from "@/lib/judge-sessions";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/AppHeader";
import { joinEvaluation } from "@/lib/public.functions";
import { errMsg } from "@/lib/share";

export const Route = createFileRoute("/join")({
  validateSearch: (s) => z.object({ code: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "الانضمام كمحكم — بند" },
      { name: "description", content: "أدخل رمز التقييم واسمك لتبدأ التحكيم على بند." },
      { property: "og:title", content: "الانضمام كمحكم — بند" },
      { property: "og:description", content: "أدخل رمز التقييم واسمك لتبدأ التحكيم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code: initial } = Route.useSearch();
  const navigate = useNavigate();
  const join = useServerFn(joinEvaluation);
  const [code, setCode] = useState(initial ?? "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<JudgeSession[]>([]);
  useEffect(() => setSessions(loadSessions()), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const norm = code.toUpperCase().replace(/\s/g, "");
    const existing = sessions.find((x) => x.code === norm || x.code === `BND-${norm.replace(/^BND-?/, "")}`);
    if (existing) {
      toast.success(`أهلاً بعودتك ${existing.judgeName}`);
      navigate({ to: "/judge/$evaluationId", params: { evaluationId: existing.evaluationId } });
      return;
    }
    setBusy(true);
    try {
      const res = await join({ data: { code, name } });
      localStorage.setItem(`band:judge:${res.evaluationId}`, res.token);
      saveSession({ evaluationId: res.evaluationId, code: res.code, evaluationName: res.name, judgeName: name.trim() });
      toast.success(`مرحباً ${name}! انضممت إلى «${res.name}»`);
      navigate({ to: "/judge/$evaluationId", params: { evaluationId: res.evaluationId } });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-md">
        {sessions.length > 0 && (
          <div className="surface mb-4 p-4">
            <p className="mb-2 text-sm font-semibold">متابعة التحكيم</p>
            <ul className="divide-y">
              {sessions.map((x) => (
                <li key={x.evaluationId}>
                  <Link to="/judge/$evaluationId" params={{ evaluationId: x.evaluationId }} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{x.evaluationName}</span>
                      <span className="text-xs text-muted-foreground">باسم {x.judgeName} · <span dir="ltr">{x.code}</span></span>
                    </span>
                    <ChevronLeft className="size-5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="surface p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground">
            <KeyRound className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">الانضمام إلى تقييم</h1>
          <p className="mt-1 text-sm text-muted-foreground">لا تحتاج إلى حساب. أدخل الرمز الذي وصلك واسمك الظاهر.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code">رمز التقييم</Label>
              <Input
                id="code"
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="BND-4821"
                required
                className="h-14 text-center font-mono text-2xl tracking-widest"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jname">اسمك</Label>
              <Input id="jname" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className="h-12" />
            </div>
            <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              ابدأ التحكيم
            </Button>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
