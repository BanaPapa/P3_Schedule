-- 4차: AI 도우미 사용량 기록과 상한
-- AI 호출은 비용이 들므로 가족당 하루(서울 기준) 30회로 묶는다. 앱은 호출 전에 record_ai_request 를 부른다.

create type public.ai_request_kind as enum ('extract', 'analyze');

create table public.ai_requests (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  kind public.ai_request_kind not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ai_requests_family_id_created_at_idx on public.ai_requests (family_id, created_at desc);

alter table public.ai_requests enable row level security;
revoke all on public.ai_requests from anon, authenticated;
grant select on public.ai_requests to authenticated;
create policy "members read ai requests" on public.ai_requests
  for select to authenticated using (private.is_family_member(family_id));

-- 요청 하나를 기록하고 오늘 남은 횟수를 돌려준다. 상한이면 ai_limit_reached.
create function public.record_ai_request(p_kind public.ai_request_kind)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_daily_limit constant integer := 30;
  v_family_id uuid := private.current_family_id();
  v_day_start timestamptz := (private.family_today()::timestamp at time zone 'Asia/Seoul');
  v_used integer;
begin
  if v_family_id is null then
    raise exception 'not_in_family';
  end if;
  -- 같은 가족의 동시 요청을 직렬화해 상한을 넘지 않게 한다
  perform 1 from public.families f where f.id = v_family_id for update;

  select count(*) into v_used
  from public.ai_requests r
  where r.family_id = v_family_id and r.created_at >= v_day_start;
  if v_used >= c_daily_limit then
    raise exception 'ai_limit_reached';
  end if;

  insert into public.ai_requests (family_id, kind) values (v_family_id, p_kind);
  return c_daily_limit - v_used - 1;
end;
$$;

revoke all on function public.record_ai_request(public.ai_request_kind) from public, anon;
grant execute on function public.record_ai_request(public.ai_request_kind) to authenticated;

-- AI 제안 중 부모가 고른 학교 일정을 한 트랜잭션으로 등록한다(중간에 실패하면 아무것도 남지 않는다).
-- security invoker: 호출한 부모의 권한·RLS·복합 외래키로 다른 가족 자녀를 막는다.
-- p_items: [{"child_id", "kind", "event_date", "end_date", "title", "subject", "memo", "supplies": [...]}]
create function public.create_school_events(p_items jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  c_max_events constant integer := 30;
  c_max_supplies constant integer := 20;
  v_family_id uuid := private.current_family_id();
  v_item jsonb;
  v_event_id uuid;
  v_count integer := 0;
begin
  if v_family_id is null then
    raise exception 'not_in_family';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and c_max_events then
    raise exception 'invalid_input';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(coalesce(v_item -> 'supplies', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(v_item -> 'supplies', '[]'::jsonb)) > c_max_supplies then
      raise exception 'invalid_input';
    end if;

    insert into public.school_events (family_id, child_id, kind, event_date, end_date, title, subject, memo)
    values (
      v_family_id,
      (v_item ->> 'child_id')::uuid,
      (v_item ->> 'kind')::public.school_event_kind,
      (v_item ->> 'event_date')::date,
      nullif(v_item ->> 'end_date', '')::date,
      v_item ->> 'title',
      nullif(btrim(v_item ->> 'subject'), ''),
      nullif(btrim(v_item ->> 'memo'), '')
    )
    returning id into v_event_id;

    insert into public.school_event_items (family_id, event_id, label)
    select v_family_id, v_event_id, btrim(supply)
    from jsonb_array_elements_text(coalesce(v_item -> 'supplies', '[]'::jsonb)) supply;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.create_school_events(jsonb) from public, anon;
grant execute on function public.create_school_events(jsonb) to authenticated;
