import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/AppHeader";
import { EvalList } from "@/components/EvalList";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "لوحة التحكم — بند" }, { name: "description", content: "لوحة التحكم" }, { property: "og:title", content: "لوحة التحكم — بند" }, { property: "og:description", content: "لوحة التحكم" }] }),
  component: () => (
    <PageShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <Button asChild><Link to="/evaluations/new">تقييم جديد</Link></Button>
      </div>
      <EvalList archivedOnly={false} />
    </PageShell>
  ),
});
