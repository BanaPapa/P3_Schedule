-- M4: 학원비 정책, 월별 예상액, 청구 확정, 추가·할인 항목, 납부
--
-- 원칙
-- * 청구 단위는 수강 과목(enrollment) × 월. 화면에서 학원별로 묶어 합계만 보여 준다.
-- * 예상 학원비는 저장하지 않고 정책과 회차로 그때그때 계산한다(tuition_estimates).
-- * 확정 청구액은 확정 순간의 값을 저장한다. 일정이 바뀌어도 자동으로 바뀌지 않고,
--   사용자가 차이를 확인하고 adjust_invoice 를 불러야만 바뀐다.
-- * 회차별 청구 규칙: 원 수업 1건당 한 번만 청구한다.
--     예정·완료 → 청구 / 결석 → absent_billable / 휴강 → academy_cancelled_billable / 취소 → 미청구
--     보강 → 원 수업이 청구되지 않았을 때만 청구 (결석 청구면 결석 보강은 무료)
--     다른 날로 옮긴 수업 → 원 회차는 취소(미청구), 옮긴 회차를 청구
-- * 금액은 원 단위 정수.

create type public.tuition_method as enum ('monthly', 'per_session', 'manual');
create type public.tuition_item_kind as enum ('extra', 'discount');

-- ---------------------------------------------------------------------------
-- 테이블
-- ---------------------------------------------------------------------------

-- 정책은 적용 시작 월(effective_month)별로 둔다. 어떤 달에는 그 달 이전에 시작한 가장 최근 정책이 적용된다.
create table public.tuition_policies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  enrollment_id uuid not null,
  effective_month date not null check (extract(day from effective_month) = 1),
  method public.tuition_method not null,
  monthly_amount integer check (monthly_amount between 0 and 100000000),
  per_session_amount integer check (per_session_amount between 0 and 10000000),
  absent_billable boolean not null default true,
  academy_cancelled_billable boolean not null default false,
  payment_day smallint check (payment_day between 1 and 31),
  memo text check (memo is null or char_length(memo) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (method <> 'monthly' or monthly_amount is not null),
  check (method <> 'per_session' or per_session_amount is not null),
  unique (enrollment_id, effective_month),
  foreign key (enrollment_id, family_id) references public.enrollments (id, family_id) on delete cascade
);
create index tuition_policies_family_id_idx on public.tuition_policies (family_id);

-- 수강 과목 FK 는 no action: 청구서가 있는 과목은 지울 수 없다
create table public.tuition_invoices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  enrollment_id uuid not null,
  billing_month date not null check (extract(day from billing_month) = 1),
  -- 확정(또는 마지막 조정) 순간의 계산 근거
  method public.tuition_method not null,
  unit_amount integer,
  session_count integer not null default 0 check (session_count >= 0),
  billable_count integer not null default 0 check (billable_count >= 0),
  estimated_amount bigint,
  -- 확정 기본 청구액. 예상액과 다르게 잡을 수 있다(수동 방식, 학원 안내 금액 등).
  base_amount integer not null check (base_amount between 0 and 100000000),
  adjustment_reason text check (adjustment_reason is null or char_length(adjustment_reason) <= 200),
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz not null default now(),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, billing_month),
  unique (id, family_id),
  foreign key (enrollment_id, family_id) references public.enrollments (id, family_id)
);
create index tuition_invoices_family_id_billing_month_idx on public.tuition_invoices (family_id, billing_month);

create table public.tuition_invoice_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  invoice_id uuid not null,
  kind public.tuition_item_kind not null,
  label text not null check (char_length(btrim(label)) between 1 and 50),
  amount integer not null check (amount between 1 and 100000000),
  created_at timestamptz not null default now(),
  foreign key (invoice_id, family_id) references public.tuition_invoices (id, family_id) on delete cascade
);
create index tuition_invoice_items_invoice_id_idx on public.tuition_invoice_items (invoice_id);

-- 청구서 FK 는 no action: 납부 기록이 있는 청구서는 취소할 수 없다
create table public.tuition_payments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  invoice_id uuid not null,
  paid_on date not null check (paid_on >= date '2000-01-01'),
  amount integer not null check (amount between 1 and 100000000),
  method text check (method is null or char_length(method) <= 30),
  memo text check (memo is null or char_length(memo) <= 200),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (invoice_id, family_id) references public.tuition_invoices (id, family_id)
);
create index tuition_payments_invoice_id_idx on public.tuition_payments (invoice_id);

-- ---------------------------------------------------------------------------
-- 계산
-- ---------------------------------------------------------------------------

-- 회차 하나가 청구 대상인지. 보강은 원 수업이 청구되지 않았을 때만 청구한다.
create function private.session_billable(
  p_kind public.class_session_kind,
  p_status public.class_session_status,
  p_origin_status public.class_session_status,
  p_absent_billable boolean,
  p_academy_cancelled_billable boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_status = 'cancelled' then false
    when p_kind = 'makeup' then not coalesce(
      case p_origin_status
        when 'absent' then p_absent_billable
        when 'academy_cancelled' then p_academy_cancelled_billable
        else false
      end, false)
    when p_status = 'absent' then p_absent_billable
    when p_status = 'academy_cancelled' then p_academy_cancelled_billable
    else true
  end;
$$;

grant execute on function private.session_billable(
  public.class_session_kind, public.class_session_status, public.class_session_status, boolean, boolean
) to authenticated;

-- 회차들의 청구 여부. 결석·휴강 여부를 판단하는 정책은 "청구 기준 월"의 정책이다:
-- 보통 회차는 그 회차의 달, 보강은 원 수업의 달. 정책이 달마다 달라져도 원 수업 1건이 두 번 청구되거나
-- 빠지지 않게 한다. 정규 회차는 수강 기간 안의 것만 센다(종료일 뒤에 남은 이력은 청구하지 않는다).
create function private.billed_sessions(p_first_day date, p_last_day date, p_enrollment_id uuid)
returns table (
  session_id uuid,
  enrollment_id uuid,
  session_date date,
  start_time time,
  kind public.class_session_kind,
  status public.class_session_status,
  origin_status public.class_session_status,
  billable boolean
)
language sql
stable
set search_path = ''
as $$
  select s.id, s.enrollment_id, s.session_date, s.start_time, s.kind, s.status, o.status,
         private.session_billable(
           s.kind, s.status, o.status,
           coalesce(pol.absent_billable, true), coalesce(pol.academy_cancelled_billable, false)
         )
  from public.class_sessions s
  join public.enrollments e on e.id = s.enrollment_id
  left join public.class_sessions o on o.id = s.origin_session_id
  left join lateral (
    select p.absent_billable, p.academy_cancelled_billable
    from public.tuition_policies p
    where p.enrollment_id = s.enrollment_id
      and p.effective_month <= date_trunc('month', coalesce(o.session_date, s.session_date))::date
    order by p.effective_month desc
    limit 1
  ) pol on true
  where s.session_date between p_first_day and p_last_day
    and (p_enrollment_id is null or s.enrollment_id = p_enrollment_id)
    and (s.kind <> 'regular' or e.end_date is null or s.session_date <= e.end_date);
$$;

revoke all on function private.billed_sessions(date, date, uuid) from public;
grant execute on function private.billed_sessions(date, date, uuid) to authenticated;

-- 그 달에 수강 중인 과목별 예상 학원비. security invoker 라 RLS 로 내 가족 것만 나온다.
-- p_enrollment_id 를 주면 그 과목만 계산한다(확정·조정 RPC 용). 정책이 없으면 method 이하가 null 이다.
create function public.tuition_estimates(p_month date, p_enrollment_id uuid default null)
returns table (
  enrollment_id uuid,
  policy_id uuid,
  method public.tuition_method,
  unit_amount integer,
  payment_day smallint,
  session_count integer,
  billable_count integer,
  estimated_amount bigint
)
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select date_trunc('month', p_month)::date as first_day,
           (date_trunc('month', p_month) + interval '1 month - 1 day')::date as last_day
  ),
  active as (
    select e.id
    from public.enrollments e, bounds b
    where e.start_date <= b.last_day and (e.end_date is null or e.end_date >= b.first_day)
      and (p_enrollment_id is null or e.id = p_enrollment_id)
  ),
  policy as (
    select distinct on (p.enrollment_id) p.*
    from public.tuition_policies p, bounds b
    where p.effective_month <= b.first_day
      and (p_enrollment_id is null or p.enrollment_id = p_enrollment_id)
    order by p.enrollment_id, p.effective_month desc
  ),
  counted as (
    select bs.enrollment_id,
           count(*) filter (where bs.kind <> 'makeup' and bs.status <> 'cancelled')::integer as session_count,
           count(*) filter (where bs.billable)::integer as billable_count
    from bounds b
    cross join lateral private.billed_sessions(b.first_day, b.last_day, p_enrollment_id) bs
    group by bs.enrollment_id
  )
  select a.id,
         p.id,
         p.method,
         case p.method when 'monthly' then p.monthly_amount when 'per_session' then p.per_session_amount end,
         p.payment_day,
         coalesce(c.session_count, 0),
         coalesce(c.billable_count, 0),
         case p.method
           when 'monthly' then p.monthly_amount::bigint
           when 'per_session' then coalesce(c.billable_count, 0)::bigint * p.per_session_amount
         end
  from active a
  left join policy p on p.enrollment_id = a.id
  left join counted c on c.enrollment_id = a.id;
$$;

revoke all on function public.tuition_estimates(date, uuid) from public, anon;
grant execute on function public.tuition_estimates(date, uuid) to authenticated;

-- 한 과목의 그 달 회차별 청구 여부 (상세 화면용). 계산 규칙은 tuition_estimates 와 같다.
create function public.tuition_session_breakdown(p_enrollment_id uuid, p_month date)
returns table (
  session_id uuid,
  session_date date,
  start_time time,
  kind public.class_session_kind,
  status public.class_session_status,
  origin_status public.class_session_status,
  billable boolean
)
language sql
stable
set search_path = ''
as $$
  select bs.session_id, bs.session_date, bs.start_time, bs.kind, bs.status, bs.origin_status, bs.billable
  from private.billed_sessions(
    date_trunc('month', p_month)::date,
    (date_trunc('month', p_month) + interval '1 month - 1 day')::date,
    p_enrollment_id
  ) bs
  where p_enrollment_id is not null
  order by bs.session_date, bs.start_time;
$$;

revoke all on function public.tuition_session_breakdown(uuid, date) from public, anon;
grant execute on function public.tuition_session_breakdown(uuid, date) to authenticated;

-- 청구서별 합계·납부·잔액. 합계는 bigint 로 더해 행이 많아도 넘치지 않게 한다.
create view public.tuition_invoice_summaries with (security_invoker = true) as
select i.*,
       coalesce(x.extra_amount, 0) as extra_amount,
       coalesce(x.discount_amount, 0) as discount_amount,
       i.base_amount + coalesce(x.extra_amount, 0) - coalesce(x.discount_amount, 0) as total_amount,
       coalesce(pay.paid_amount, 0) as paid_amount,
       i.base_amount + coalesce(x.extra_amount, 0) - coalesce(x.discount_amount, 0) - coalesce(pay.paid_amount, 0)
         as balance
from public.tuition_invoices i
left join lateral (
  select sum(it.amount::bigint) filter (where it.kind = 'extra') as extra_amount,
         sum(it.amount::bigint) filter (where it.kind = 'discount') as discount_amount
  from public.tuition_invoice_items it where it.invoice_id = i.id
) x on true
left join lateral (
  select sum(p.amount::bigint) as paid_amount from public.tuition_payments p where p.invoice_id = i.id
) pay on true;

-- ---------------------------------------------------------------------------
-- 트리거
-- ---------------------------------------------------------------------------

create trigger tuition_policies_bump_version before update on public.tuition_policies
  for each row execute function private.bump_version();
create trigger tuition_invoices_bump_version before update on public.tuition_invoices
  for each row execute function private.bump_version();

-- 항목·납부가 바뀌면 청구서 version 을 올려 동시 수정을 감지한다
create function private.touch_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tuition_invoices i
  set updated_at = now()
  where i.id = coalesce(new.invoice_id, old.invoice_id);
  return null;
end;
$$;
revoke all on function private.touch_invoice() from public;

-- 직접 넣는 항목·납부에도 상한을 둔다. 할인으로 청구 합계가 음수가 되지 않게 한다.
create function private.check_invoice_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_items constant integer := 20;
  v_total bigint;
begin
  -- 같은 청구서에 동시에 넣는 경우를 직렬화한다
  perform 1 from public.tuition_invoices i where i.id = new.invoice_id for update;
  if (select count(*) from public.tuition_invoice_items it where it.invoice_id = new.invoice_id) >= c_max_items then
    raise exception 'too_many_items';
  end if;
  if new.kind = 'discount' then
    select s.total_amount into v_total from public.tuition_invoice_summaries s where s.id = new.invoice_id;
    if coalesce(v_total, 0) - new.amount < 0 then
      raise exception 'invalid_item';
    end if;
  end if;
  return new;
end;
$$;

create function private.check_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_payments constant integer := 50;
begin
  perform 1 from public.tuition_invoices i where i.id = new.invoice_id for update;
  if (select count(*) from public.tuition_payments p where p.invoice_id = new.invoice_id) >= c_max_payments then
    raise exception 'too_many_payments';
  end if;
  return new;
end;
$$;

revoke all on function private.check_invoice_item() from public;
revoke all on function private.check_payment() from public;

create trigger tuition_invoice_items_check before insert on public.tuition_invoice_items
  for each row execute function private.check_invoice_item();
create trigger tuition_payments_check before insert on public.tuition_payments
  for each row execute function private.check_payment();

create trigger tuition_invoice_items_touch after insert or delete on public.tuition_invoice_items
  for each row execute function private.touch_invoice();
create trigger tuition_payments_touch after insert or delete on public.tuition_payments
  for each row execute function private.touch_invoice();

create trigger tuition_policies_audit after insert or update or delete on public.tuition_policies
  for each row execute function private.write_audit_log();
create trigger tuition_invoices_audit after insert or update or delete on public.tuition_invoices
  for each row execute function private.write_audit_log();
create trigger tuition_invoice_items_audit after insert or update or delete on public.tuition_invoice_items
  for each row execute function private.write_audit_log();
create trigger tuition_payments_audit after insert or update or delete on public.tuition_payments
  for each row execute function private.write_audit_log();

-- ---------------------------------------------------------------------------
-- 권한과 RLS
-- ---------------------------------------------------------------------------

alter table public.tuition_policies enable row level security;
alter table public.tuition_invoices enable row level security;
alter table public.tuition_invoice_items enable row level security;
alter table public.tuition_payments enable row level security;

revoke all on public.tuition_policies, public.tuition_invoices, public.tuition_invoice_items,
  public.tuition_payments, public.tuition_invoice_summaries from anon, authenticated;

-- 정책·청구서는 RPC 로만 쓴다(검증, 확정 스냅샷). 항목·납부는 직접 넣고 지운다.
grant select on public.tuition_policies to authenticated;
grant select on public.tuition_invoices to authenticated;
grant select on public.tuition_invoice_summaries to authenticated;
grant select, delete on public.tuition_invoice_items to authenticated;
grant insert (family_id, invoice_id, kind, label, amount) on public.tuition_invoice_items to authenticated;
grant select, delete on public.tuition_payments to authenticated;
grant insert (family_id, invoice_id, paid_on, amount, method, memo) on public.tuition_payments to authenticated;

create policy "members read tuition policies" on public.tuition_policies
  for select to authenticated using (private.is_family_member(family_id));
create policy "members read invoices" on public.tuition_invoices
  for select to authenticated using (private.is_family_member(family_id));
create policy "members read invoice items" on public.tuition_invoice_items
  for select to authenticated using (private.is_family_member(family_id));
create policy "members add invoice items" on public.tuition_invoice_items
  for insert to authenticated with check (private.is_family_member(family_id));
create policy "members delete invoice items" on public.tuition_invoice_items
  for delete to authenticated using (private.is_family_member(family_id));
create policy "members read payments" on public.tuition_payments
  for select to authenticated using (private.is_family_member(family_id));
create policy "members add payments" on public.tuition_payments
  for insert to authenticated with check (private.is_family_member(family_id));
create policy "members delete payments" on public.tuition_payments
  for delete to authenticated using (private.is_family_member(family_id));

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

-- 같은 과목·같은 적용 월 정책이 있으면 덮어쓴다
create function public.save_tuition_policy(
  p_enrollment_id uuid,
  p_effective_month date,
  p_method public.tuition_method,
  p_monthly_amount integer,
  p_per_session_amount integer,
  p_absent_billable boolean,
  p_academy_cancelled_billable boolean,
  p_payment_day smallint,
  p_memo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid := private.current_family_id();
  v_month date := date_trunc('month', p_effective_month)::date;
  v_memo text := nullif(btrim(coalesce(p_memo, '')), '');
  v_policy_id uuid;
begin
  if not exists (
    select 1 from public.enrollments e where e.id = p_enrollment_id and e.family_id = v_family_id
  ) then
    raise exception 'enrollment_not_found';
  end if;
  if p_method is null or v_month is null
    or v_month > private.family_today() + 400
    or (p_method = 'monthly' and coalesce(p_monthly_amount, -1) not between 0 and 100000000)
    or (p_method = 'per_session' and coalesce(p_per_session_amount, -1) not between 0 and 10000000)
    or (p_payment_day is not null and p_payment_day not between 1 and 31)
    or char_length(coalesce(v_memo, '')) > 500 then
    raise exception 'invalid_policy';
  end if;

  insert into public.tuition_policies as p (
    family_id, enrollment_id, effective_month, method, monthly_amount, per_session_amount,
    absent_billable, academy_cancelled_billable, payment_day, memo
  )
  values (
    v_family_id, p_enrollment_id, v_month, p_method,
    case when p_method = 'monthly' then p_monthly_amount end,
    case when p_method = 'per_session' then p_per_session_amount end,
    coalesce(p_absent_billable, true), coalesce(p_academy_cancelled_billable, false), p_payment_day, v_memo
  )
  on conflict (enrollment_id, effective_month) do update set
    method = excluded.method,
    monthly_amount = excluded.monthly_amount,
    per_session_amount = excluded.per_session_amount,
    absent_billable = excluded.absent_billable,
    academy_cancelled_billable = excluded.academy_cancelled_billable,
    payment_day = excluded.payment_day,
    memo = excluded.memo
  returning p.id into v_policy_id;
  return v_policy_id;
end;
$$;

-- 그 달 청구를 확정한다. p_base_amount 가 null 이면 예상액으로 확정한다.
-- p_items: [{"kind": "extra" | "discount", "label": "교재비", "amount": 20000}, ...]
create function public.confirm_invoice(
  p_enrollment_id uuid,
  p_month date,
  p_base_amount integer,
  p_reason text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_items constant integer := 20;
  v_family_id uuid := private.current_family_id();
  v_month date := date_trunc('month', p_month)::date;
  v_estimate record;
  v_base bigint;
  v_invoice_id uuid;
  v_item jsonb;
begin
  -- 같은 과목을 동시에 확정하지 않도록 잠근다
  perform 1 from public.enrollments e
  where e.id = p_enrollment_id and e.family_id = v_family_id
  for update;
  if not found then
    raise exception 'enrollment_not_found';
  end if;
  if exists (
    select 1 from public.tuition_invoices i where i.enrollment_id = p_enrollment_id and i.billing_month = v_month
  ) then
    raise exception 'invoice_exists';
  end if;

  select * into v_estimate from public.tuition_estimates(v_month, p_enrollment_id) t;
  if not found then
    raise exception 'invalid_period';
  end if;
  if v_estimate.method is null then
    raise exception 'policy_required';
  end if;

  v_base := coalesce(p_base_amount, v_estimate.estimated_amount);
  if v_base is null then
    raise exception 'amount_required';
  end if;
  if v_base not between 0 and 100000000 then
    raise exception 'invalid_amount';
  end if;
  if p_items is not null and (
    jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > c_max_items
  ) then
    raise exception 'invalid_item';
  end if;

  insert into public.tuition_invoices (
    family_id, enrollment_id, billing_month, method, unit_amount, session_count, billable_count,
    estimated_amount, base_amount, adjustment_reason, confirmed_by
  )
  values (
    v_family_id, p_enrollment_id, v_month, v_estimate.method, v_estimate.unit_amount,
    v_estimate.session_count, v_estimate.billable_count, v_estimate.estimated_amount, v_base,
    nullif(btrim(coalesce(p_reason, '')), ''), auth.uid()
  )
  returning id into v_invoice_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    begin
      insert into public.tuition_invoice_items (family_id, invoice_id, kind, label, amount)
      values (
        v_family_id, v_invoice_id,
        (v_item ->> 'kind')::public.tuition_item_kind,
        btrim(v_item ->> 'label'),
        (v_item ->> 'amount')::integer
      );
    exception when others then
      raise exception 'invalid_item';
    end;
  end loop;

  return v_invoice_id;
end;
$$;

-- 확정액을 사용자가 확인한 값으로 조정한다. p_base_amount 가 null 이면 지금 예상액으로 맞춘다.
-- 조정 시점의 계산 근거로 스냅샷도 바꿔 "예상액이 달라졌다" 경고가 사라지게 한다.
create function public.adjust_invoice(
  p_invoice_id uuid,
  p_version integer,
  p_base_amount integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.tuition_invoices;
  v_estimate record;
  v_base bigint;
begin
  select * into v_invoice
  from public.tuition_invoices i
  where i.id = p_invoice_id and i.family_id = private.current_family_id()
  for update;
  if not found then
    raise exception 'invoice_not_found';
  end if;
  if v_invoice.version is distinct from p_version then
    raise exception 'invoice_conflict';
  end if;

  select * into v_estimate
  from public.tuition_estimates(v_invoice.billing_month, v_invoice.enrollment_id) t
  where t.enrollment_id = v_invoice.enrollment_id;

  v_base := coalesce(p_base_amount, v_estimate.estimated_amount);
  if v_base is null then
    raise exception 'amount_required';
  end if;
  if v_base not between 0 and 100000000 then
    raise exception 'invalid_amount';
  end if;

  update public.tuition_invoices i
  set base_amount = v_base,
      adjustment_reason = nullif(btrim(coalesce(p_reason, '')), ''),
      method = coalesce(v_estimate.method, i.method),
      unit_amount = case when v_estimate.method is null then i.unit_amount else v_estimate.unit_amount end,
      session_count = coalesce(v_estimate.session_count, i.session_count),
      billable_count = coalesce(v_estimate.billable_count, i.billable_count),
      estimated_amount = case when v_estimate.method is null then i.estimated_amount else v_estimate.estimated_amount end
  where i.id = p_invoice_id;
end;
$$;

-- 잘못 확정한 청구를 되돌린다. 납부 기록이 있으면 먼저 납부를 지워야 한다.
create function public.cancel_invoice(p_invoice_id uuid, p_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.tuition_invoices;
begin
  select * into v_invoice
  from public.tuition_invoices i
  where i.id = p_invoice_id and i.family_id = private.current_family_id()
  for update;
  if not found then
    raise exception 'invoice_not_found';
  end if;
  if v_invoice.version is distinct from p_version then
    raise exception 'invoice_conflict';
  end if;
  if exists (select 1 from public.tuition_payments p where p.invoice_id = p_invoice_id) then
    raise exception 'invoice_has_payments';
  end if;

  delete from public.tuition_invoices i where i.id = p_invoice_id;
end;
$$;

-- 청구서가 있는 수강 과목도 이력이 있는 것으로 본다 (M3 정의에 조건 추가)
create or replace function public.delete_enrollment(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 검사와 삭제 사이에 다른 사람이 회차를 바꾸거나 새로 만들지 못하게 수강 과목과 회차를 잠근다
  perform 1 from public.enrollments e
  where e.id = p_enrollment_id and e.family_id = private.current_family_id()
  for update;
  if not found then
    raise exception 'enrollment_not_found';
  end if;
  perform 1 from public.class_sessions s where s.enrollment_id = p_enrollment_id for update;

  if exists (
    select 1 from public.class_sessions s
    where s.enrollment_id = p_enrollment_id
      and (s.session_date < private.family_today() or s.kind <> 'regular' or s.status <> 'scheduled')
  ) or exists (
    select 1 from public.tuition_invoices i where i.enrollment_id = p_enrollment_id
  ) then
    raise exception 'enrollment_has_history';
  end if;

  delete from public.enrollments e where e.id = p_enrollment_id;
end;
$$;

revoke all on function public.save_tuition_policy(
  uuid, date, public.tuition_method, integer, integer, boolean, boolean, smallint, text) from public, anon;
revoke all on function public.confirm_invoice(uuid, date, integer, text, jsonb) from public, anon;
revoke all on function public.adjust_invoice(uuid, integer, integer, text) from public, anon;
revoke all on function public.cancel_invoice(uuid, integer) from public, anon;

grant execute on function public.save_tuition_policy(
  uuid, date, public.tuition_method, integer, integer, boolean, boolean, smallint, text) to authenticated;
grant execute on function public.confirm_invoice(uuid, date, integer, text, jsonb) to authenticated;
grant execute on function public.adjust_invoice(uuid, integer, integer, text) to authenticated;
grant execute on function public.cancel_invoice(uuid, integer) to authenticated;
