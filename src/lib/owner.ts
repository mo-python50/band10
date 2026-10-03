import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Results } from "./types";
import * as XLSX from "xlsx";

export function useSignedImages(paths: (string | null | undefined)[]) {
  const list = Array.from(new Set(paths.filter((p): p is string => !!p))).sort();
  return useQuery({
    queryKey: ["signed", list],
    enabled: list.length > 0,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data } = await supabase.storage.from("item-images").createSignedUrls(list, 60 * 60);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r) => {
        if (r.path && r.signedUrl) map[r.path] = r.signedUrl;
      });
      return map;
    },
  });
}

export async function fetchResults(evaluationId: string) {
  const { data, error } = await supabase.rpc("get_results", { _eval: evaluationId });
  if (error) throw error;
  return data as unknown as Results;
}

function rows(results: Results) {
  return results.items.map((it) => {
    const r: Record<string, string | number> = {
      "الترتيب": it.rank,
      "العنصر": it.name,
      "درجة المحكمين": it.judge_score,
    };
    if (results.audience_enabled) {
      r["درجة الجمهور"] = it.audience_score;
      r["الأصوات"] = it.votes;
    }
    r["النتيجة النهائية"] = it.final_score;
    it.criteria.forEach((c) => {
      r[`${c.name} (متوسط)`] = c.avg_score;
      r[`${c.name} (مساهمة)`] = c.contribution;
    });
    return r;
  });
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportCSV(results: Results, name: string) {
  const data = rows(results);
  const headers = Object.keys(data[0] ?? {});
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...data.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  download(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
}

export function exportXLSX(results: Results, name: string) {
  const ws = XLSX.utils.json_to_sheet(rows(results));
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, "النتائج");
  XLSX.writeFile(wb, `${name}.xlsx`);
}
