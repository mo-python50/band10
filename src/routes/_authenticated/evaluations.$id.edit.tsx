import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/evaluations/$id/edit")({
  head: () => ({ meta: [{ title: "تحرير التقييم — بند" }, { name: "description", content: "تحرير التقييم" }, { property: "og:title", content: "تحرير التقييم — بند" }, { property: "og:description", content: "تحرير التقييم" }] }),
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["eval", id],
    queryFn: async () => (await supabase.from("evaluations").select("*").eq("id", id).single()).data,
  });
  return (
    <PageShell>
      {q.data && (
        <div className="surface p-6">
          <div className="flex items-center gap-3"><h1 className="text-2xl font-bold">{q.data.name}</h1><StatusBadge status={q.data.status} /></div>
          <p className="mt-2 text-muted-foreground">رمز المحكمين: <span dir="ltr" className="font-mono">{q.data.judge_code}</span></p>
          <p className="mt-4 text-sm text-muted-foreground">معالج الإعداد قيد الإنشاء.</p>
        </div>
      )}
    </PageShell>
  );
}
