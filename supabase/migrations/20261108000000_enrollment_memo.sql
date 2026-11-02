-- 수강 등록에서 과목명을 없앤다. 피아노 학원이면 수업도 그냥 "피아노"이므로
-- 화면은 학원 이름으로 수업을 부르고, 필요한 내용은 비고(memo)에 적는다.
-- 지난 데이터와 이력이 남아 있으므로 subject 컬럼은 지우지 않고 선택값으로 둔다.

alter table public.enrollments alter column subject drop not null;
alter table public.enrollments drop constraint enrollments_subject_check;
alter table public.enrollments add constraint enrollments_subject_check
  check (subject is null or char_length(btrim(subject)) between 1 and 30);

drop function public.create_enrollment(uuid, uuid, text, date, date, jsonb);

create function public.create_enrollment(
  p_child_id uuid,
  p_academy_id uuid,
  p_subject text,
  p_start_date date,
  p_end_date date,
  p_rules jsonb,
  p_memo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- 진행 중(종료일이 오늘 이후거나 없음)인 수강 과목 수 상한. 회차 생성량을 묶어 둔다.
  c_max_active_enrollments constant integer := 30;
  c_max_start_days_ahead constant integer := 400;
  v_today date := private.family_today();
  v_family_id uuid := private.current_family_id();
  v_subject text := nullif(btrim(coalesce(p_subject, '')), '');
  v_memo text := nullif(btrim(coalesce(p_memo, '')), '');
  v_enrollment_id uuid;
begin
  if v_family_id is null then
    raise exception 'not_in_family';
  end if;
  if v_subject is not null and char_length(v_subject) > 30 then
    raise exception 'invalid_subject';
  end if;
  if v_memo is not null and char_length(v_memo) > 500 then
    raise exception 'invalid_input';
  end if;
  if p_start_date is null
    or p_start_date < v_today - 366
    or p_start_date > v_today + c_max_start_days_ahead
    or (p_end_date is not null and p_end_date < p_start_date) then
    raise exception 'invalid_period';
  end if;
  if (
    select count(*) from public.enrollments e
    where e.family_id = v_family_id and (e.end_date is null or e.end_date >= v_today)
  ) >= c_max_active_enrollments then
    raise exception 'too_many_enrollments';
  end if;
  if not exists (select 1 from public.children c where c.id = p_child_id and c.family_id = v_family_id) then
    raise exception 'child_not_found';
  end if;
  if not exists (select 1 from public.academies a where a.id = p_academy_id and a.family_id = v_family_id) then
    raise exception 'academy_not_found';
  end if;

  insert into public.enrollments (family_id, child_id, academy_id, subject, memo, start_date, end_date)
  values (v_family_id, p_child_id, p_academy_id, v_subject, v_memo, p_start_date, p_end_date)
  returning id into v_enrollment_id;

  perform private.insert_class_rules(v_enrollment_id, v_family_id, p_rules, p_start_date, p_end_date);
  perform private.generate_sessions_between(v_enrollment_id, p_start_date, private.session_horizon());
  return v_enrollment_id;
end;
$$;

revoke all on function public.create_enrollment(uuid, uuid, text, date, date, jsonb, text) from public, anon;
grant execute on function public.create_enrollment(uuid, uuid, text, date, date, jsonb, text) to authenticated;
