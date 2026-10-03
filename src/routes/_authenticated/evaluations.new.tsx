import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/share";

export const Route = createFileRoute("/_authenticated/evaluations/new")({
  head: () => ({
    meta: [
      { title: "تقييم جديد — بند" },
      { name: "description", content: "إنشاء تقييم جديد." },
      { property: "og:title", content: "تقييم جديد — بند" },
      { property: "og:description", content: "إنشاء تقييم جديد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewEvaluation,
});

function NewEvaluation() {
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("evaluations")
      .insert({ owner_id: u.user!.id, name: "تقييم جديد", judge_code: "" })
      .select("id")
      .single();
    if (error) return setError(errMsg(error));
    await supabase.from("criteria").insert({ evaluation_id: data.id, name: "", weight: 100, position: 0 });
    navigate({ to: "/evaluations/$id/edit", params: { id: data.id }, replace: true });
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    create();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-screen place-items-center text-center">
      {error ? (
        <div>
          <p className="text-destructive">{error}</p>
          <Button className="mt-4" onClick={create}>إعادة المحاولة</Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> جارٍ إنشاء المسودة…
        </div>
      )}
    </div>
  );
}
