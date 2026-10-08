import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { getAdmin, pgError, randomToken, sha256, signPaths } from "./hash.server";

const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/, "جلسة غير صالحة");

async function judgeFromToken(token: string) {
  const admin = await getAdmin();
  const hash = await sha256(token);
  const { data: judge, error } = await admin
    .from("judges")
    .select("id, evaluation_id, display_name, submitted_at, joined_at")
    .eq("token_hash", hash)
    .maybeSingle();
  pgError(error);
  if (!judge) throw new Error("انتهت جلستك أو أنها غير صالحة. انضم مجدداً بالرمز.");
  return { admin, judge };
}

/* ---------------- Judges ---------------- */

export const joinEvaluation = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        code: z.string().trim().min(3).max(20),
        name: z.string().trim().min(1, "أدخل اسمك").max(80),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const code = data.code.toUpperCase().replace(/\s/g, "");
    const normalized = code.startsWith("BND-") ? code : `BND-${code.replace(/^BND/, "")}`;
    const { data: ev, error } = await admin
      .from("evaluations")
      .select("id, status, name")
      .eq("judge_code", normalized)
      .maybeSingle();
    pgError(error);
    if (!ev) throw new Error("رمز التقييم غير صحيح");
    if (ev.status !== "active") throw new Error("هذا التقييم غير مفتوح للتحكيم حالياً");

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from("judges")
      .select("id", { count: "exact", head: true })
      .eq("evaluation_id", ev.id)
      .gte("joined_at", since);
    if ((count ?? 0) > 40) throw new Error("محاولات كثيرة، حاول بعد دقيقة");

    const token = randomToken();
    const { error: insErr } = await admin.from("judges").insert({
      evaluation_id: ev.id,
      display_name: data.name,
      token_hash: await sha256(token),
    });
    pgError(insErr);
    await admin.from("evaluation_events").insert({
      evaluation_id: ev.id,
      event_type: "judge_joined",
      payload: { name: data.name },
    });
    return { token, evaluationId: ev.id, name: ev.name, code: normalized };
  });

export const getJudgeState = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const { admin, judge } = await judgeFromToken(data.token);
    const eid = judge.evaluation_id;
    const [ev, items, criteria, scores, comments] = await Promise.all([
      admin.from("evaluations").select("id, name, description, category, status").eq("id", eid).single(),
      admin.from("evaluation_items").select("id, name, description, image_url, position").eq("evaluation_id", eid).order("position"),
      admin.from("criteria").select("id, name, description, weight, min_score, max_score, position").eq("evaluation_id", eid).order("position"),
      admin.from("scores").select("item_id, criterion_id, score").eq("judge_id", judge.id),
      admin.from("judge_comments").select("item_id, comment").eq("judge_id", judge.id),
    ]);
    pgError(ev.error);
    await admin.from("judges").update({ last_active_at: new Date().toISOString() }).eq("id", judge.id);
    const images = await signPaths(admin, (items.data ?? []).map((i) => i.image_url));
    return {
      judge: { id: judge.id, name: judge.display_name, submitted_at: judge.submitted_at },
      evaluation: ev.data!,
      items: (items.data ?? []).map((i) => ({ ...i, image: i.image_url ? images[i.image_url] ?? null : null })),
      criteria: (criteria.data ?? []).map((c) => ({
        ...c,
        weight: Number(c.weight),
        min_score: Number(c.min_score),
        max_score: Number(c.max_score),
      })),
      scores: (scores.data ?? []).map((s) => ({ ...s, score: Number(s.score) })),
      comments: comments.data ?? [],
    };
  });

export const saveScore = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: tokenSchema,
        itemId: z.string().uuid(),
        criterionId: z.string().uuid(),
        score: z.number().finite(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { admin, judge } = await judgeFromToken(data.token);
    const { error } = await admin.from("scores").upsert(
      {
        evaluation_id: judge.evaluation_id,
        judge_id: judge.id,
        item_id: data.itemId,
        criterion_id: data.criterionId,
        score: data.score,
      },
      { onConflict: "judge_id,item_id,criterion_id" },
    );
    pgError(error);
    return { ok: true };
  });

export const saveComment = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({ token: tokenSchema, itemId: z.string().uuid(), comment: z.string().max(2000) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { admin, judge } = await judgeFromToken(data.token);
    if (judge.submitted_at) throw new Error("تم إرسال التقييم مسبقاً");
    const comment = data.comment.trim();
    if (!comment) {
      await admin.from("judge_comments").delete().eq("judge_id", judge.id).eq("item_id", data.itemId);
      return { ok: true };
    }
    const { data: item } = await admin
      .from("evaluation_items")
      .select("id")
      .eq("id", data.itemId)
      .eq("evaluation_id", judge.evaluation_id)
      .maybeSingle();
    if (!item) throw new Error("عنصر غير صالح");
    const { error } = await admin.from("judge_comments").upsert(
      { evaluation_id: judge.evaluation_id, judge_id: judge.id, item_id: data.itemId, comment, updated_at: new Date().toISOString() },
      { onConflict: "judge_id,item_id" },
    );
    pgError(error);
    return { ok: true };
  });

export const submitJudge = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const { admin, judge } = await judgeFromToken(data.token);
    if (judge.submitted_at) return { ok: true };
    const eid = judge.evaluation_id;
    const { data: ev } = await admin.from("evaluations").select("status").eq("id", eid).single();
    if (ev?.status !== "active") throw new Error("التقييم غير نشط حالياً");
    const [{ count: ni }, { count: nc }, { count: ns }] = await Promise.all([
      admin.from("evaluation_items").select("id", { count: "exact", head: true }).eq("evaluation_id", eid),
      admin.from("criteria").select("id", { count: "exact", head: true }).eq("evaluation_id", eid),
      admin.from("scores").select("id", { count: "exact", head: true }).eq("judge_id", judge.id),
    ]);
    if ((ns ?? 0) < (ni ?? 0) * (nc ?? 0)) throw new Error("أكمل تقييم جميع العناصر والمعايير قبل الإرسال");
    const { error } = await admin.from("judges").update({ submitted_at: new Date().toISOString() }).eq("id", judge.id);
    pgError(error);
    await admin.from("evaluation_events").insert({ evaluation_id: eid, event_type: "judge_submitted", payload: { judge_id: judge.id } });
    return { ok: true };
  });

/* ---------------- Audience ---------------- */

const publicToken = z.string().regex(/^[a-f0-9]{32}$/, "رابط غير صالح");

export const getVotePage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: publicToken, voterId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { data: ev, error } = await admin
      .from("evaluations")
      .select("id, name, description, category, status, audience_enabled, public_results")
      .eq("public_token", data.token)
      .maybeSingle();
    pgError(error);
    if (!ev || !ev.audience_enabled || ev.status === "draft") return null;
    const { data: items } = await admin
      .from("evaluation_items")
      .select("id, name, description, image_url, position")
      .eq("evaluation_id", ev.id)
      .order("position");
    const images = await signPaths(admin, (items ?? []).map((i) => i.image_url));
    let votedItemId: string | null = null;
    if (data.voterId) {
      const { data: v } = await admin
        .from("audience_votes")
        .select("item_id")
        .eq("evaluation_id", ev.id)
        .eq("voter_hash", await sha256(`${ev.id}:${data.voterId}`))
        .maybeSingle();
      votedItemId = v?.item_id ?? null;
    }
    return {
      evaluation: { name: ev.name, description: ev.description, category: ev.category, status: ev.status, public_results: ev.public_results },
      items: (items ?? []).map((i) => ({ id: i.id, name: i.name, description: i.description, image: i.image_url ? images[i.image_url] ?? null : null })),
      votedItemId,
    };
  });

export const castVote = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: publicToken, voterId: z.string().uuid(), itemId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { data: ev } = await admin
      .from("evaluations")
      .select("id")
      .eq("public_token", data.token)
      .maybeSingle();
    if (!ev) throw new Error("رابط غير صالح");
    const ip =
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const ipHash = await sha256(`${ev.id}:ip:${ip}`);
    const { count } = await admin
      .from("audience_votes")
      .select("id", { count: "exact", head: true })
      .eq("evaluation_id", ev.id)
      .eq("ip_hash", ipHash);
    if ((count ?? 0) >= 25) throw new Error("تم تجاوز الحد المسموح من الأصوات من هذه الشبكة");
    const { error } = await admin.from("audience_votes").insert({
      evaluation_id: ev.id,
      item_id: data.itemId,
      voter_hash: await sha256(`${ev.id}:${data.voterId}`),
      ip_hash: ipHash,
    });
    if (error?.code === "23505") throw new Error("لقد صوّتَ مسبقاً في هذا التقييم");
    pgError(error);
    return { ok: true };
  });

/* ---------------- Public results ---------------- */

export const getPublicResults = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: publicToken }).parse(d))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { data: res, error } = await admin.rpc("get_public_results", { _token: data.token });
    pgError(error);
    if (!res) return null;
    const payload = res as unknown as {
      name: string;
      description: string | null;
      category: string | null;
      status: string;
      results: import("./types").Results;
    };
    const images = await signPaths(admin, payload.results.items.map((i) => i.image_url));
    let judgeNames: string[] = [];
    const { data: ev } = await admin
      .from("evaluations")
      .select("id, show_judge_names")
      .eq("public_token", data.token)
      .single();
    if (ev?.show_judge_names) {
      const { data: js } = await admin
        .from("judges")
        .select("display_name")
        .eq("evaluation_id", ev.id)
        .not("submitted_at", "is", null);
      judgeNames = (js ?? []).map((j) => j.display_name);
    }
    return { ...payload, images, judgeNames };
  });

export const reopenJudge = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const { admin, judge } = await judgeFromToken(data.token);
    const { data: ev } = await admin.from("evaluations").select("status").eq("id", judge.evaluation_id).single();
    if (ev?.status !== "active") throw new Error("لا يمكن تعديل التقييم لأن التحكيم مغلق");
    const { error } = await admin.from("judges").update({ submitted_at: null }).eq("id", judge.id);
    pgError(error);
    await admin.from("evaluation_events").insert({ evaluation_id: judge.evaluation_id, event_type: "judge_reopened", payload: { judge_id: judge.id } });
    return { ok: true };
  });
