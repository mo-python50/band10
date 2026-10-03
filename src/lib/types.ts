export type EvaluationStatus = "draft" | "active" | "paused" | "completed" | "archived";

export type CriterionResult = {
  id: string;
  name: string;
  weight: number;
  max_score: number;
  avg_score: number;
  contribution: number;
};

export type ItemResult = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  rank: number;
  judge_score: number;
  audience_score: number;
  final_score: number;
  votes: number;
  vote_pct: number;
  criteria: CriterionResult[];
};

export type Results = {
  evaluation_id: string;
  audience_enabled: boolean;
  judge_weight: number;
  audience_weight: number;
  completed_judges: number;
  total_votes: number;
  computed_at: string;
  items: ItemResult[];
};

export const STATUS_LABEL: Record<EvaluationStatus, string> = {
  draft: "مسودة",
  active: "نشط",
  paused: "متوقف مؤقتاً",
  completed: "مكتمل",
  archived: "مؤرشف",
};

export function fmt(n: number | null | undefined, digits = 2) {
  const v = Number(n ?? 0);
  return v.toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("ar-EG-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });
}
