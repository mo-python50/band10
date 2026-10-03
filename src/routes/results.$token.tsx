import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { PageShell } from "@/components/AppHeader";
import { ResultsView } from "@/components/ResultsView";
import { StatusBadge } from "@/components/StatusBadge";
import { getPublicResults } from "@/lib/public.functions";
import { errMsg } from "@/lib/share";
import type { EvaluationStatus } from "@/lib/types";

export const Route = createFileRoute("/results/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "النتائج — بند" },
      { name: "description", content: "النتائج والترتيب النهائي لهذا التقييم." },
      { property: "og:title", content: "النتائج — بند" },
      { property: "og:description", content: "النتائج والترتيب النهائي لهذا التقييم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicResults,
});

function PublicResults() {
  const { token } = Route.useParams();
  const fetchResults = useServerFn(getPublicResults);
  const q = useQuery({ queryKey: ["public-results", token], queryFn: () => fetchResults({ data: { token } }) });

  return (
    <PageShell>
      {q.isLoading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-primary" /></div>
      ) : q.error ? (
        <p className="py-20 text-center text-destructive">{errMsg(q.error)}</p>
      ) : !q.data ? (
        <p className="py-20 text-center text-muted-foreground">النتائج غير منشورة لهذا التقييم.</p>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">{q.data.name}</h1>
              <StatusBadge status={q.data.status as EvaluationStatus} />
            </div>
            {q.data.description && <p className="mt-2 text-muted-foreground">{q.data.description}</p>}
            {q.data.status !== "completed" && q.data.status !== "archived" && (
              <p className="mt-2 text-sm text-warning">نتائج مبدئية — التقييم لم يكتمل بعد.</p>
            )}
          </div>
          <ResultsView results={q.data.results} images={q.data.images} />
          {q.data.judgeNames.length > 0 && (
            <p className="text-sm text-muted-foreground">لجنة التحكيم: {q.data.judgeNames.join("، ")}</p>
          )}
        </div>
      )}
    </PageShell>
  );
}
