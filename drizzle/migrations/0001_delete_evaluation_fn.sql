CREATE OR REPLACE FUNCTION public.lock_structure()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
declare st public.evaluation_status; eid uuid;
begin
  if coalesce(current_setting('band.deleting', true),'') = '1' then
    if tg_op = 'DELETE' then return old; end if; return new;
  end if;
  if tg_op = 'DELETE' then eid := old.evaluation_id; else eid := new.evaluation_id; end if;
  select status into st from public.evaluations where id = eid;
  if st is not null and st <> 'draft' then
    raise exception 'لا يمكن تعديل العناصر أو المعايير بعد التفعيل';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.delete_evaluation(_eval uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.evaluations where id = _eval and owner_id = auth.uid()) then
    raise exception 'غير مصرح';
  end if;
  perform set_config('band.deleting','1',true);
  delete from public.scores where evaluation_id = _eval;
  delete from public.judge_comments where evaluation_id = _eval;
  delete from public.audience_votes where evaluation_id = _eval;
  delete from public.judges where evaluation_id = _eval;
  delete from public.evaluation_events where evaluation_id = _eval;
  delete from public.criteria where evaluation_id = _eval;
  delete from public.evaluation_items where evaluation_id = _eval;
  delete from public.evaluations where id = _eval;
  perform set_config('band.deleting','',true);
end $function$;

REVOKE EXECUTE ON FUNCTION public.delete_evaluation(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_evaluation(uuid) TO authenticated;