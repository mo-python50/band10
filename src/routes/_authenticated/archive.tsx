import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/AppHeader";
import { EvalList } from "@/components/EvalList";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/archive")({
  head: () => ({ meta: [{ title: "أرشيف التقييمات — بند" }, { name: "description", content: "أرشيف التقييمات" }, { property: "og:title", content: "أرشيف التقييمات — بند" }, { property: "og:description", content: "أرشيف التقييمات" }] }),
  component: () => (
    <PageShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">أرشيف التقييمات</h1>
        <Button asChild><Link to="/evaluations/new">تقييم جديد</Link></Button>
      </div>
      <EvalList archivedOnly={true} />
    </PageShell>
  ),
});
