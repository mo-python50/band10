import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/AppHeader";
import { castVote, getVotePage } from "@/lib/public.functions";
import { errMsg } from "@/lib/share";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vote/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تصويت الجمهور — بند" },
      { name: "description", content: "صوّت لعنصرك المفضل في هذا التقييم." },
      { property: "og:title", content: "تصويت الجمهور — بند" },
      { property: "og:description", content: "صوّت لعنصرك المفضل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VotePage,
});

function VotePage() {
  const { token } = Route.useParams();
  const [voterId, setVoterId] = useState<string | null>(null);
  useEffect(() => {
    let id = localStorage.getItem("band:voter");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("band:voter", id);
    }
    setVoterId(id);
  }, []);
  const fetchPage = useServerFn(getVotePage);
  const vote = useServerFn(castVote);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["vote", token, voterId],
    enabled: !!voterId,
    queryFn: () => fetchPage({ data: { token, voterId: voterId! } }),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!selected || !voterId) return;
    setBusy(true);
    try {
      await vote({ data: { token, voterId, itemId: selected } });
      toast.success("تم تسجيل صوتك، شكراً لك!");
      qc.invalidateQueries({ queryKey: ["vote", token] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      {q.isLoading || !voterId ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-primary" /></div>
      ) : q.error ? (
        <p className="py-20 text-center text-destructive">{errMsg(q.error)}</p>
      ) : !q.data ? (
        <p className="py-20 text-center text-muted-foreground">التصويت غير متاح لهذا الرابط.</p>
      ) : (
        <div className="mx-auto max-w-3xl">
          {q.data.evaluation.category && <p className="text-sm text-primary">{q.data.evaluation.category}</p>}
          <h1 className="text-3xl font-bold">{q.data.evaluation.name}</h1>
          {q.data.evaluation.description && <p className="mt-2 text-muted-foreground">{q.data.evaluation.description}</p>}

          {q.data.votedItemId ? (
            <div className="surface mt-8 p-8 text-center">
              <CheckCircle2 className="mx-auto size-12 text-success" />
              <p className="mt-3 text-lg font-semibold">لقد صوّتّ لـ «{q.data.items.find((i) => i.id === q.data!.votedItemId)?.name}»</p>
              <p className="mt-1 text-sm text-muted-foreground">صوت واحد لكل زائر.</p>
              {q.data.evaluation.public_results && (
                <Button asChild variant="outline" className="mt-4"><Link to="/results/$token" params={{ token }}>عرض النتائج</Link></Button>
              )}
            </div>
          ) : q.data.evaluation.status !== "active" ? (
            <p className="surface mt-8 p-6 text-center text-muted-foreground">التصويت مغلق حالياً.</p>
          ) : (
            <>
              <p className="mt-6 text-sm font-medium">اختر عنصراً واحداً:</p>
              <div role="radiogroup" className="mt-3 grid gap-3 sm:grid-cols-2">
                {q.data.items.map((it) => (
                  <button
                    key={it.id}
                    role="radio"
                    aria-checked={selected === it.id}
                    onClick={() => setSelected(it.id)}
                    className={cn("surface flex items-center gap-3 p-3 text-start transition", selected === it.id && "border-primary ring-2 ring-primary/30")}
                  >
                    {it.image ? <img src={it.image} alt="" className="size-16 rounded-lg object-cover" /> : <span className="size-16 rounded-lg bg-accent" />}
                    <div className="min-w-0">
                      <p className="font-semibold">{it.name}</p>
                      {it.description && <p className="line-clamp-2 text-xs text-muted-foreground">{it.description}</p>}
                    </div>
                  </button>
                ))}
              </div>
              <Button size="lg" className="mt-6 h-12 w-full" disabled={!selected || busy} onClick={submit}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                تأكيد التصويت
              </Button>
            </>
          )}
        </div>
      )}
    </PageShell>
  );
}
