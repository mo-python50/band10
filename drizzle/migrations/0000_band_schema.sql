
create extension if not exists pgcrypto;

create type public.evaluation_status as enum ('draft','active','paused','completed','archived');

create table public.profiles (
  id uuid primary key,
  display_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null default 'تقييم بدون عنوان' check (char_length(name) between 1 and 200),
  description text check (char_length(description) <= 4000),
  category text check (char_length(category) <= 100),
  starts_at timestamptz,
  ends_at timestamptz,
  status public.evaluation_status not null default 'draft',
  judge_code text not null unique,
  public_token text not null unique default encode(gen_random_bytes(16),'hex'),
  audience_enabled boolean not null default false,
  audience_weight numeric(5,2) not null default 0 check (audience_weight >= 0 and audience_weight <= 100),
  public_results boolean not null default false,
  show_judge_names boolean not null default false,
  results_snapshot jsonb,
  activated_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index evaluations_owner_idx on public.evaluations(owner_id, created_at desc);
grant select, insert, update, delete on public.evaluations to authenticated;
grant all on public.evaluations to service_role;
alter table public.evaluations enable row level security;
create policy "owner select" on public.evaluations for select to authenticated using (owner_id = auth.uid());
create policy "owner insert" on public.evaluations for insert to authenticated with check (owner_id = auth.uid());
create policy "owner update" on public.evaluations for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner delete draft" on public.evaluations for delete to authenticated using (owner_id = auth.uid() and status = 'draft');

create or replace function public.gen_judge_code() returns text language plpgsql set search_path = public as $$
declare c text;
begin
  loop
    c := 'BND-' || lpad((floor(random()*10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.evaluations where judge_code = c);
  end loop;
  return c;
end $$;

create or replace function public.evaluations_before() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.judge_code := public.gen_judge_code();
    new.status := 'draft';
    new.results_snapshot := null;
    return new;
  end if;
  new.updated_at := now();
  new.owner_id := old.owner_id;
  new.judge_code := old.judge_code;
  new.public_token := old.public_token;
  if coalesce(current_setting('band.status_change', true),'') <> '1' then
    new.status := old.status;
    new.results_snapshot := old.results_snapshot;
    new.activated_at := old.activated_at;
    new.completed_at := old.completed_at;
    new.archived_at := old.archived_at;
    if old.status = 'archived' then
      raise exception 'التقييم المؤرشف للقراءة فقط';
    end if;
    if old.status <> 'draft' and (new.audience_enabled is distinct from old.audience_enabled or new.audience_weight is distinct from old.audience_weight) then
      raise exception 'لا يمكن تعديل إعدادات التصويت بعد التفعيل';
    end if;
  end if;
  return new;
end $$;
create trigger evaluations_before before insert or update on public.evaluations for each row execute function public.evaluations_before();

create or replace function public.is_eval_owner(_eval uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.evaluations where id = _eval and owner_id = auth.uid())
$$;

create table public.evaluation_items (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 200),
  description text check (char_length(description) <= 2000),
  image_url text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index items_eval_idx on public.evaluation_items(evaluation_id, position);
grant select, insert, update, delete on public.evaluation_items to authenticated;
grant all on public.evaluation_items to service_role;
alter table public.evaluation_items enable row level security;
create policy "owner all items" on public.evaluation_items for all to authenticated using (public.is_eval_owner(evaluation_id)) with check (public.is_eval_owner(evaluation_id));

create table public.criteria (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 200),
  description text check (char_length(description) <= 2000),
  weight numeric(6,2) not null default 0 check (weight >= 0 and weight <= 100),
  min_score numeric(8,2) not null default 1,
  max_score numeric(8,2) not null default 10,
  position int not null default 0,
  created_at timestamptz not null default now(),
  check (max_score > min_score and max_score > 0)
);
create index criteria_eval_idx on public.criteria(evaluation_id, position);
grant select, insert, update, delete on public.criteria to authenticated;
grant all on public.criteria to service_role;
alter table public.criteria enable row level security;
create policy "owner all criteria" on public.criteria for all to authenticated using (public.is_eval_owner(evaluation_id)) with check (public.is_eval_owner(evaluation_id));

create or replace function public.lock_structure() returns trigger
language plpgsql set search_path = public as $$
declare st public.evaluation_status; eid uuid;
begin
  if tg_op = 'DELETE' then eid := old.evaluation_id; else eid := new.evaluation_id; end if;
  select status into st from public.evaluations where id = eid;
  if st is not null and st <> 'draft' then
    raise exception 'لا يمكن تعديل العناصر أو المعايير بعد التفعيل';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger items_lock before insert or update or delete on public.evaluation_items for each row execute function public.lock_structure();
create trigger criteria_lock before insert or update or delete on public.criteria for each row execute function public.lock_structure();

create table public.judges (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  token_hash text not null unique,
  joined_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  submitted_at timestamptz
);
create index judges_eval_idx on public.judges(evaluation_id);
grant select on public.judges to authenticated;
grant all on public.judges to service_role;
alter table public.judges enable row level security;
create policy "owner read judges" on public.judges for select to authenticated using (public.is_eval_owner(evaluation_id));

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  judge_id uuid not null references public.judges(id) on delete cascade,
  item_id uuid not null references public.evaluation_items(id) on delete cascade,
  criterion_id uuid not null references public.criteria(id) on delete cascade,
  score numeric(8,2) not null,
  updated_at timestamptz not null default now(),
  unique (judge_id, item_id, criterion_id)
);
create index scores_eval_idx on public.scores(evaluation_id);
create index scores_item_idx on public.scores(item_id, criterion_id);
grant select on public.scores to authenticated;
grant all on public.scores to service_role;
alter table public.scores enable row level security;
create policy "owner read scores" on public.scores for select to authenticated using (public.is_eval_owner(evaluation_id));

create or replace function public.validate_score() returns trigger
language plpgsql set search_path = public as $$
declare c record; st public.evaluation_status; sub timestamptz;
begin
  select * into c from public.criteria where id = new.criterion_id and evaluation_id = new.evaluation_id;
  if not found then raise exception 'معيار غير صالح'; end if;
  if not exists (select 1 from public.evaluation_items where id = new.item_id and evaluation_id = new.evaluation_id) then raise exception 'عنصر غير صالح'; end if;
  select status into st from public.evaluations where id = new.evaluation_id;
  if st <> 'active' then raise exception 'التقييم غير نشط حالياً'; end if;
  select submitted_at into sub from public.judges where id = new.judge_id and evaluation_id = new.evaluation_id;
  if not found then raise exception 'محكم غير صالح'; end if;
  if sub is not null then raise exception 'تم إرسال التقييم مسبقاً'; end if;
  if new.score < c.min_score or new.score > c.max_score then raise exception 'الدرجة خارج النطاق المسموح'; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger scores_validate before insert or update on public.scores for each row execute function public.validate_score();

create table public.judge_comments (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  judge_id uuid not null references public.judges(id) on delete cascade,
  item_id uuid not null references public.evaluation_items(id) on delete cascade,
  comment text not null check (char_length(comment) <= 2000),
  updated_at timestamptz not null default now(),
  unique (judge_id, item_id)
);
grant select on public.judge_comments to authenticated;
grant all on public.judge_comments to service_role;
alter table public.judge_comments enable row level security;
create policy "owner read comments" on public.judge_comments for select to authenticated using (public.is_eval_owner(evaluation_id));

create table public.audience_votes (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  item_id uuid not null references public.evaluation_items(id) on delete cascade,
  voter_hash text not null,
  ip_hash text,
  created_at timestamptz not null default now(),
  unique (evaluation_id, voter_hash)
);
create index votes_eval_idx on public.audience_votes(evaluation_id, item_id);
create index votes_ip_idx on public.audience_votes(evaluation_id, ip_hash);
grant select on public.audience_votes to authenticated;
grant all on public.audience_votes to service_role;
alter table public.audience_votes enable row level security;
create policy "owner read votes" on public.audience_votes for select to authenticated using (public.is_eval_owner(evaluation_id));

create or replace function public.validate_vote() returns trigger
language plpgsql set search_path = public as $$
declare e record;
begin
  select status, audience_enabled into e from public.evaluations where id = new.evaluation_id;
  if e.status <> 'active' or not e.audience_enabled then raise exception 'التصويت غير متاح حالياً'; end if;
  if not exists (select 1 from public.evaluation_items where id = new.item_id and evaluation_id = new.evaluation_id) then raise exception 'عنصر غير صالح'; end if;
  return new;
end $$;
create trigger votes_validate before insert on public.audience_votes for each row execute function public.validate_vote();

create table public.evaluation_events (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index events_eval_idx on public.evaluation_events(evaluation_id, created_at desc);
grant select on public.evaluation_events to authenticated;
grant all on public.evaluation_events to service_role;
alter table public.evaluation_events enable row level security;
create policy "owner read events" on public.evaluation_events for select to authenticated using (public.is_eval_owner(evaluation_id));

create or replace function public.compute_results_live(_eval uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e record; total_votes int; max_votes int; completed int; jw numeric; aw numeric; res jsonb;
begin
  select * into e from public.evaluations where id = _eval;
  if not found then return null; end if;
  select count(*) into completed from public.judges where evaluation_id = _eval and submitted_at is not null;
  select count(*) into total_votes from public.audience_votes where evaluation_id = _eval;
  select coalesce(max(c),0) into max_votes from (select count(*) c from public.audience_votes where evaluation_id = _eval group by item_id) t;
  aw := case when e.audience_enabled then e.audience_weight else 0 end;
  jw := 100 - aw;

  with crit as (
    select * from public.criteria where evaluation_id = _eval
  ),
  done as (
    select id from public.judges where evaluation_id = _eval and submitted_at is not null
  ),
  crit_avg as (
    select i.id item_id, c.id criterion_id, c.name, c.weight, c.max_score, c.position,
      avg(s.score) avg_score,
      avg(s.score / c.max_score * c.weight) contribution
    from public.evaluation_items i cross join crit c
    left join public.scores s on s.item_id = i.id and s.criterion_id = c.id and s.judge_id in (select id from done)
    where i.evaluation_id = _eval
    group by i.id, c.id, c.name, c.weight, c.max_score, c.position
  ),
  judge_item as (
    select s.item_id, s.judge_id, sum(s.score / c.max_score * c.weight) total
    from public.scores s join crit c on c.id = s.criterion_id
    where s.judge_id in (select id from done)
    group by s.item_id, s.judge_id
  ),
  item_j as (
    select item_id, avg(total) judge_score from judge_item group by item_id
  ),
  item_v as (
    select item_id, count(*) votes from public.audience_votes where evaluation_id = _eval group by item_id
  ),
  base as (
    select i.id, i.name, i.description, i.image_url, i.position,
      round(coalesce(j.judge_score,0)::numeric, 2) judge_score,
      coalesce(v.votes,0) votes,
      case when total_votes > 0 then round(coalesce(v.votes,0)::numeric * 100 / total_votes, 2) else 0 end vote_pct,
      case when max_votes > 0 then round(coalesce(v.votes,0)::numeric * 100 / max_votes, 2) else 0 end audience_score
    from public.evaluation_items i
    left join item_j j on j.item_id = i.id
    left join item_v v on v.item_id = i.id
    where i.evaluation_id = _eval
  ),
  fin as (
    select b.*,
      case when e.audience_enabled then round(b.judge_score * jw / 100 + b.audience_score * aw / 100, 2) else b.judge_score end final_score
    from base b
  ),
  ranked as (
    select f.*, rank() over (order by f.final_score desc) rnk from fin f
  )
  select jsonb_build_object(
    'evaluation_id', _eval,
    'audience_enabled', e.audience_enabled,
    'judge_weight', jw,
    'audience_weight', aw,
    'completed_judges', completed,
    'total_votes', total_votes,
    'computed_at', now(),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'description', r.description, 'image_url', r.image_url,
        'rank', r.rnk, 'judge_score', r.judge_score, 'audience_score', r.audience_score,
        'final_score', r.final_score, 'votes', r.votes, 'vote_pct', r.vote_pct,
        'criteria', coalesce((select jsonb_agg(jsonb_build_object(
            'id', ca.criterion_id, 'name', ca.name, 'weight', ca.weight, 'max_score', ca.max_score,
            'avg_score', round(coalesce(ca.avg_score,0)::numeric,2),
            'contribution', round(coalesce(ca.contribution,0)::numeric,2)) order by ca.position)
          from crit_avg ca where ca.item_id = r.id), '[]'::jsonb)
      ) order by r.rnk, r.position) from ranked r), '[]'::jsonb)
  ) into res;
  return res;
end $$;
revoke all on function public.compute_results_live(uuid) from public, anon, authenticated;
grant execute on function public.compute_results_live(uuid) to service_role;

create or replace function public.get_results(_eval uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e record;
begin
  select * into e from public.evaluations where id = _eval;
  if not found or e.owner_id is distinct from auth.uid() then raise exception 'غير مصرح'; end if;
  if e.results_snapshot is not null then return e.results_snapshot; end if;
  return public.compute_results_live(_eval);
end $$;
revoke all on function public.get_results(uuid) from public, anon;
grant execute on function public.get_results(uuid) to authenticated;

create or replace function public.get_public_results(_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e record; r jsonb;
begin
  select * into e from public.evaluations where public_token = _token;
  if not found or not e.public_results or e.status = 'draft' then return null; end if;
  r := coalesce(e.results_snapshot, public.compute_results_live(e.id));
  return jsonb_build_object('name', e.name, 'description', e.description, 'category', e.category, 'status', e.status, 'results', r);
end $$;
grant execute on function public.get_public_results(text) to anon, authenticated;

create or replace function public.set_evaluation_status(_eval uuid, _status public.evaluation_status) returns void
language plpgsql security definer set search_path = public as $$
declare e record; wsum numeric; n_items int; n_crit int; bad int;
begin
  select * into e from public.evaluations where id = _eval for update;
  if not found or e.owner_id is distinct from auth.uid() then raise exception 'غير مصرح'; end if;

  if _status = 'active' then
    if e.status not in ('draft','paused') then raise exception 'لا يمكن التفعيل من الحالة الحالية'; end if;
    if e.status = 'draft' then
      select count(*) into n_items from public.evaluation_items where evaluation_id = _eval;
      if n_items < 1 then raise exception 'أضف عنصراً واحداً على الأقل'; end if;
      select count(*) into bad from public.evaluation_items where evaluation_id = _eval and btrim(name) = '';
      if bad > 0 then raise exception 'يجب تسمية جميع العناصر'; end if;
      select count(*), coalesce(sum(weight),0) into n_crit, wsum from public.criteria where evaluation_id = _eval;
      if n_crit < 1 then raise exception 'أضف معياراً واحداً على الأقل'; end if;
      select count(*) into bad from public.criteria where evaluation_id = _eval and btrim(name) = '';
      if bad > 0 then raise exception 'يجب تسمية جميع المعايير'; end if;
      if wsum <> 100 then raise exception 'مجموع أوزان المعايير يجب أن يساوي 100'; end if;
      if e.audience_enabled and (e.audience_weight <= 0 or e.audience_weight >= 100) then raise exception 'وزن تصويت الجمهور يجب أن يكون بين 1 و 99'; end if;
    end if;
    perform set_config('band.status_change','1',true);
    update public.evaluations set status = 'active', activated_at = coalesce(activated_at, now()) where id = _eval;
  elsif _status = 'paused' then
    if e.status <> 'active' then raise exception 'يمكن إيقاف التقييم النشط فقط'; end if;
    perform set_config('band.status_change','1',true);
    update public.evaluations set status = 'paused' where id = _eval;
  elsif _status = 'completed' then
    if e.status not in ('active','paused') then raise exception 'لا يمكن إكمال التقييم من الحالة الحالية'; end if;
    perform set_config('band.status_change','1',true);
    update public.evaluations set status = 'completed', completed_at = now(),
      results_snapshot = public.compute_results_live(_eval) where id = _eval;
  elsif _status = 'archived' then
    if e.status <> 'completed' then raise exception 'يمكن أرشفة التقييمات المكتملة فقط'; end if;
    perform set_config('band.status_change','1',true);
    update public.evaluations set status = 'archived', archived_at = now() where id = _eval;
  else
    raise exception 'حالة غير صالحة';
  end if;
  perform set_config('band.status_change','',true);
  insert into public.evaluation_events(evaluation_id, event_type, payload, actor_id)
  values (_eval, 'status_changed', jsonb_build_object('from', e.status, 'to', _status), auth.uid());
end $$;
revoke all on function public.set_evaluation_status(uuid, public.evaluation_status) from public, anon;
grant execute on function public.set_evaluation_status(uuid, public.evaluation_status) to authenticated;

create policy "item images owner read" on storage.objects for select to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "item images owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "item images owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);
