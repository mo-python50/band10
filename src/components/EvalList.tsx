import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MoreVertical, Pencil, Trash2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fmtDate } from "@/lib/types";
import { errMsg } from "@/lib/share";

export function EvalList({ archivedOnly = false }: { archivedOnly?: boolean }) {
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
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
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_evaluation", { _eval: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف التقييم");
      qc.invalidateQueries({ queryKey: ["evals"] });
      setToDelete(null);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (q.isLoading) return <Loader2 className="mx-auto size-6 animate-spin text-primary" />;
  if (!q.data?.length) return <p className="py-10 text-center text-muted-foreground">لا توجد تقييمات بعد.</p>;
  return (
    <>
      <ul className="surface divide-y">
        {q.data.map((e) => (
          <li key={e.id} className="flex items-center gap-2 pe-2">
            <Link to="/evaluations/$id/edit" params={{ id: e.id }} className="flex min-w-0 flex-1 items-center justify-between gap-3 p-4 hover:bg-muted/40">
              <div className="min-w-0">
                <p className="truncate font-semibold">{e.name}</p>
                <p className="text-xs text-muted-foreground" dir="auto">{e.judge_code} · {fmtDate(e.created_at)}</p>
              </div>
              <StatusBadge status={e.status} />
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="خيارات"><MoreVertical className="size-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/evaluations/$id/edit" params={{ id: e.id }}><Pencil className="size-4" /> تعديل</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/evaluations/$id/edit" params={{ id: e.id }} search={{ tab: "results" }}><BarChart3 className="size-4" /> النتائج</Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setToDelete({ id: e.id, name: e.name })}>
                  <Trash2 className="size-4" /> حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف «{toDelete?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف التقييم وكل الدرجات والأصوات المرتبطة به نهائياً. لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(ev) => { ev.preventDefault(); if (toDelete) del.mutate(toDelete.id); }}
              disabled={del.isPending}
            >
              {del.isPending && <Loader2 className="size-4 animate-spin" />} حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
