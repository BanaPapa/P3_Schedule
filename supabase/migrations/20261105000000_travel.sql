-- 2차: 가족 여행 — 여행, 날짜별 일정(방문 장소), 분류별 예산, 실제 지출
-- 일정은 통합 캘린더에, 지출은 월별 비용에 함께 보인다(앱에서 합친다).

create type public.trip_category as enum ('transport', 'lodging', 'food', 'activity', 'shopping', 'etc');

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 50),
  destination text check (destination is null or char_length(destination) <= 50),
  start_date date not null,
  end_date date not null,
  -- 여행 전체 예산(선택). 분류별 예산은 trip_budgets.
  budget_amount integer check (budget_amount between 0 and 1000000000),
  memo text check (memo is null or char_length(memo) <= 1000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_date - start_date <= 60),
  unique (id, family_id)
);
create index trips_family_id_start_date_idx on public.trips (family_id, start_date);

create table public.trip_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  trip_id uuid not null,
  day_date date not null,
  start_time time,
  end_time time,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  place_name text check (place_name is null or char_length(place_name) <= 80),
  address text check (address is null or char_length(address) <= 200),
  memo text check (memo is null or char_length(memo) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time is null or start_time is null or end_time > start_time),
  foreign key (trip_id, family_id) references public.trips (id, family_id) on delete cascade
);
create index trip_items_trip_id_day_date_idx on public.trip_items (trip_id, day_date);
create index trip_items_family_id_day_date_idx on public.trip_items (family_id, day_date);

create table public.trip_budgets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  trip_id uuid not null,
  category public.trip_category not null,
  planned_amount integer not null check (planned_amount between 0 and 1000000000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, category),
  foreign key (trip_id, family_id) references public.trips (id, family_id) on delete cascade
);

create table public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  trip_id uuid not null,
  spent_on date not null check (spent_on >= date '2000-01-01'),
  category public.trip_category not null,
  amount integer not null check (amount between 1 and 100000000),
  description text check (description is null or char_length(description) <= 100),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (trip_id, family_id) references public.trips (id, family_id) on delete cascade
);
create index trip_expenses_trip_id_idx on public.trip_expenses (trip_id);
create index trip_expenses_family_id_spent_on_idx on public.trip_expenses (family_id, spent_on);

-- 여행별 예산·지출 합계와 분류별 비교 (security invoker → RLS)
create view public.trip_summaries with (security_invoker = true) as
select t.*,
       coalesce((select sum(b.planned_amount::bigint) from public.trip_budgets b where b.trip_id = t.id), 0)
         as planned_total,
       coalesce((select sum(e.amount::bigint) from public.trip_expenses e where e.trip_id = t.id), 0)
         as spent_total
from public.trips t;

create view public.trip_category_totals with (security_invoker = true) as
select coalesce(b.trip_id, e.trip_id) as trip_id,
       coalesce(b.category, e.category) as category,
       coalesce(b.planned_amount, 0)::bigint as planned_amount,
       coalesce(e.spent_amount, 0) as spent_amount
from public.trip_budgets b
full join (
  select trip_id, category, sum(amount::bigint) as spent_amount
  from public.trip_expenses
  group by trip_id, category
) e on e.trip_id = b.trip_id and e.category = b.category;

-- ---------------------------------------------------------------------------
-- 날짜 범위 검사
-- ---------------------------------------------------------------------------

create function private.check_trip_item_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.trips t
    where t.id = new.trip_id and new.day_date between t.start_date and t.end_date
  ) then
    raise exception 'invalid_trip_day';
  end if;
  return new;
end;
$$;

create function private.check_trip_range()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.trip_items i
    where i.trip_id = new.id and i.day_date not between new.start_date and new.end_date
  ) then
    raise exception 'trip_items_outside';
  end if;
  return new;
end;
$$;

revoke all on function private.check_trip_item_day() from public;
revoke all on function private.check_trip_range() from public;

create trigger trip_items_check_day before insert or update on public.trip_items
  for each row execute function private.check_trip_item_day();
create trigger trips_check_range before update of start_date, end_date on public.trips
  for each row execute function private.check_trip_range();

create trigger trips_bump_version before update on public.trips
  for each row execute function private.bump_version();
create trigger trip_items_bump_version before update on public.trip_items
  for each row execute function private.bump_version();
create trigger trip_budgets_bump_version before update on public.trip_budgets
  for each row execute function private.bump_version();

create trigger trips_audit after insert or update or delete on public.trips
  for each row execute function private.write_audit_log();
create trigger trip_items_audit after insert or update or delete on public.trip_items
  for each row execute function private.write_audit_log();
create trigger trip_budgets_audit after insert or update or delete on public.trip_budgets
  for each row execute function private.write_audit_log();
create trigger trip_expenses_audit after insert or update or delete on public.trip_expenses
  for each row execute function private.write_audit_log();

-- ---------------------------------------------------------------------------
-- 권한과 RLS
-- ---------------------------------------------------------------------------

alter table public.trips enable row level security;
alter table public.trip_items enable row level security;
alter table public.trip_budgets enable row level security;
alter table public.trip_expenses enable row level security;

revoke all on public.trips, public.trip_items, public.trip_budgets, public.trip_expenses,
  public.trip_summaries, public.trip_category_totals from anon, authenticated;

grant select, delete on public.trips to authenticated;
grant insert (family_id, title, destination, start_date, end_date, budget_amount, memo) on public.trips to authenticated;
grant update (title, destination, start_date, end_date, budget_amount, memo) on public.trips to authenticated;

grant select, delete on public.trip_items to authenticated;
grant insert (family_id, trip_id, day_date, start_time, end_time, title, place_name, address, memo)
  on public.trip_items to authenticated;
grant update (day_date, start_time, end_time, title, place_name, address, memo) on public.trip_items to authenticated;

grant select, delete on public.trip_budgets to authenticated;
grant insert (family_id, trip_id, category, planned_amount) on public.trip_budgets to authenticated;
grant update (planned_amount) on public.trip_budgets to authenticated;

grant select, delete on public.trip_expenses to authenticated;
grant insert (family_id, trip_id, spent_on, category, amount, description) on public.trip_expenses to authenticated;

grant select on public.trip_summaries, public.trip_category_totals to authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['trips', 'trip_items', 'trip_budgets', 'trip_expenses'] loop
    execute format(
      'create policy "members read %1$s" on public.%1$I for select to authenticated using (private.is_family_member(family_id))',
      v_table);
    execute format(
      'create policy "members add %1$s" on public.%1$I for insert to authenticated with check (private.is_family_member(family_id))',
      v_table);
    execute format(
      'create policy "members update %1$s" on public.%1$I for update to authenticated using (private.is_family_member(family_id)) with check (private.is_family_member(family_id))',
      v_table);
    execute format(
      'create policy "members delete %1$s" on public.%1$I for delete to authenticated using (private.is_family_member(family_id))',
      v_table);
  end loop;
end;
$$;
