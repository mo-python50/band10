import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/lib/types";

export function EvalList({ archivedOnly = false }: { archivedOnly?: boolean }) {
  const q = useQuery({
    queryKey: ["evals", archivedOnly],
    queryFn: async () => {
      let r = supabase.from("evaluations").select("id,name,status,judge_code,created_at").order("created_at", { ascending: false });
      if (archivedOnly) r = r.in("status", ["completed", "archived"]);
      const { data, error } = await r;
      if (error) throw error;
      return data;
    },
  });
  if (q.isLoading) return <Loader2 className="mx-auto size-6 animate-spin text-primary" />;
  if (!q.data?.length) return <p className="py-10 text-center text-muted-foreground">لا توجد تقييمات بعد.</p>;
  return (
    <ul className="surface divide-y">
      {q.data.map((e) => (
        <li key={e.id}>
          <Link to="/evaluations/$id/edit" params={{ id: e.id }} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/40">
            <div>
              <p className="font-semibold">{e.name}</p>
              <p className="text-xs text-muted-foreground">{e.judge_code} · {fmtDate(e.created_at)}</p>
            </div>
            <StatusBadge status={e.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
