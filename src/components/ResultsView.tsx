import { useState } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { fmt, type Results } from "@/lib/types";
import { cn } from "@/lib/utils";

const podium = ["bg-gold", "bg-silver", "bg-bronze"];

export function ResultsView({ results, images = {} }: { results: Results; images?: Record<string, string> }) {
  const [open, setOpen] = useState<string | null>(null);
  const top = results.items.slice(0, 3);
  const aud = results.audience_enabled;

  if (!results.items.length) return <p className="py-10 text-center text-muted-foreground">لا توجد عناصر.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-3 py-1">محكمون مكتملون: {results.completed_judges}</span>
        {aud && <span className="rounded-full bg-muted px-3 py-1">أصوات الجمهور: {results.total_votes}</span>}
        {aud && (
          <span className="rounded-full bg-muted px-3 py-1">
            الوزن: المحكمون {fmt(results.judge_weight)}٪ · الجمهور {fmt(results.audience_weight)}٪
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {top.map((it, i) => (
          <div key={it.id} className={cn("surface relative overflow-hidden p-5", i === 0 && "sm:order-2 sm:-mt-3 border-gold/60")}>
            <div className={cn("absolute inset-x-0 top-0 h-1.5", podium[i])} />
            <div className="flex items-center gap-3">
              {it.image_url && images[it.image_url] ? (
                <img src={images[it.image_url]} alt="" className="size-12 rounded-lg object-cover" />
              ) : (
                <span className={cn("grid size-12 place-items-center rounded-lg text-foreground", podium[i])}>
                  <Trophy className="size-5" />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">المركز {it.rank}</p>
                <p className="truncate font-semibold">{it.name}</p>
              </div>
            </div>
            <p className="mt-4 font-display text-3xl font-bold tabular">{fmt(it.final_score)}</p>
            <p className="text-xs text-muted-foreground">من 100</p>
          </div>
        ))}
      </div>

      <div className="surface overflow-hidden">
        <div className="hidden grid-cols-[3rem_1fr_6rem_6rem_6rem_2rem] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
          <span>#</span>
          <span>العنصر</span>
          <span>المحكمون</span>
          <span>{aud ? "الجمهور" : ""}</span>
          <span>النهائي</span>
          <span />
        </div>
        <ul className="divide-y">
          {results.items.map((it) => (
            <li key={it.id}>
              <button
                onClick={() => setOpen(open === it.id ? null : it.id)}
                aria-expanded={open === it.id}
                className="grid w-full grid-cols-[2.5rem_1fr_auto_1.5rem] items-center gap-2 px-4 py-3 text-start hover:bg-muted/40 sm:grid-cols-[3rem_1fr_6rem_6rem_6rem_2rem]"
              >
                <span className="font-display text-lg font-bold text-primary tabular">{it.rank}</span>
                <span className="truncate font-medium">{it.name}</span>
                <span className="hidden tabular sm:block">{fmt(it.judge_score)}</span>
                <span className="hidden tabular sm:block">{aud ? `${fmt(it.audience_score)} (${it.votes})` : ""}</span>
                <span className="font-semibold tabular">{fmt(it.final_score)}</span>
                <ChevronDown className={cn("size-4 transition", open === it.id && "rotate-180")} />
              </button>
              {open === it.id && (
                <div className="animate-rise bg-muted/30 px-4 pb-4 pt-1">
                  <div className="mb-3 flex flex-wrap gap-3 text-xs sm:hidden">
                    <span>المحكمون: {fmt(it.judge_score)}</span>
                    {aud && <span>الجمهور: {fmt(it.audience_score)} · {it.votes} صوت ({fmt(it.vote_pct)}٪)</span>}
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="py-1 text-start font-medium">المعيار</th>
                        <th className="py-1 text-start font-medium">الوزن</th>
                        <th className="py-1 text-start font-medium">متوسط الدرجة</th>
                        <th className="py-1 text-start font-medium">المساهمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {it.criteria.map((c) => (
                        <tr key={c.id} className="border-t border-border/60">
                          <td className="py-1.5">{c.name}</td>
                          <td className="tabular">{fmt(c.weight)}٪</td>
                          <td className="tabular">{fmt(c.avg_score)} / {fmt(c.max_score)}</td>
                          <td className="tabular">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                <div className="h-full bg-primary" style={{ width: `${c.weight ? (c.contribution / c.weight) * 100 : 0}%` }} />
                              </div>
                              {fmt(c.contribution)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
