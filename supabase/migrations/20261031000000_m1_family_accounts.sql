-- M1: 가족 계정 시스템
-- 가족 그룹, 부모 구성원, 자녀 프로필, 배우자 초대, 변경 이력.
--
-- 원칙
-- * 모든 행은 family_id로 격리하고 RLS로 강제한다.
-- * 가족 생성, 초대 수락처럼 "아직 구성원이 아닌 사람"이 하는 일은 security definer RPC로만 한다.
-- * 수정 가능한 테이블은 version 컬럼을 두어 동시 수정을 감지한다 (클라이언트는 where version = 읽은값).
-- * 클라이언트 권한은 컬럼 단위로 준다. family_id, role, version은 클라이언트가 바꿀 수 없다.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.family_role as enum ('owner', 'parent');

-- ---------------------------------------------------------------------------
-- 테이블
-- ---------------------------------------------------------------------------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 50),
  created_by uuid references auth.users (id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- v1은 한 사람이 한 가족에만 속한다
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role public.family_role not null default 'parent',
  display_name text not null check (char_length(display_name) between 1 and 30),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index family_members_family_id_idx on public.family_members (family_id);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  birth_date date,
  -- 캘린더에서 자녀를 구분하는 색
  color text not null default '#2563eb' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order smallint not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index children_family_id_idx on public.children (family_id);

create table public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  code text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index family_invitations_family_id_idx on public.family_invitations (family_id);
-- 가족당 열린(수락·취소 전) 초대는 하나. 만료 여부는 now() 가 필요해 인덱스 조건에 넣을 수 없다.
create unique index family_invitations_one_open_per_family_idx
  on public.family_invitations (family_id)
  where accepted_at is null and revoked_at is null;

-- 가족이 삭제돼도 이력은 남도록 FK를 두지 않는다
create table public.audit_logs (
  id bigint generated always as identity primary key,
  family_id uuid not null,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_family_id_created_at_idx on public.audit_logs (family_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 내부 함수와 트리거
-- ---------------------------------------------------------------------------

create function private.is_family_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members m
    where m.family_id = p_family_id
      and m.user_id = (select auth.uid())
  );
$$;

create function private.current_family_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.family_id
  from public.family_members m
  where m.user_id = (select auth.uid());
$$;

create function private.bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create function private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  insert into public.audit_logs (family_id, table_name, record_id, action, actor_id, old_data, new_data)
  values (
    case when tg_table_name = 'families' then (v_row ->> 'id')::uuid else (v_row ->> 'family_id')::uuid end,
    tg_table_name,
    (v_row ->> 'id')::uuid,
    lower(tg_op),
    auth.uid(),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end;
$$;

revoke all on all functions in schema private from public;
grant execute on function private.is_family_member(uuid) to authenticated;
grant execute on function private.current_family_id() to authenticated;

create trigger families_bump_version before update on public.families
  for each row execute function private.bump_version();
create trigger family_members_bump_version before update on public.family_members
  for each row execute function private.bump_version();
create trigger children_bump_version before update on public.children
  for each row execute function private.bump_version();

create trigger families_audit after insert or update or delete on public.families
  for each row execute function private.write_audit_log();
create trigger family_members_audit after insert or update or delete on public.family_members
  for each row execute function private.write_audit_log();
create trigger children_audit after insert or update or delete on public.children
  for each row execute function private.write_audit_log();

-- ---------------------------------------------------------------------------
-- 권한과 RLS
-- ---------------------------------------------------------------------------

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.children enable row level security;
alter table public.family_invitations enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.families, public.family_members, public.children,
  public.family_invitations, public.audit_logs from anon, authenticated;

grant select on public.families to authenticated;
grant update (name) on public.families to authenticated;

grant select on public.family_members to authenticated;
grant update (display_name) on public.family_members to authenticated;

grant select, delete on public.children to authenticated;
grant insert (family_id, name, birth_date, color, sort_order) on public.children to authenticated;
grant update (name, birth_date, color, sort_order) on public.children to authenticated;

grant select on public.family_invitations to authenticated;
grant select on public.audit_logs to authenticated;

create policy "members read their family" on public.families
  for select to authenticated using (private.is_family_member(id));
create policy "members update their family" on public.families
  for update to authenticated
  using (private.is_family_member(id)) with check (private.is_family_member(id));

create policy "members read family members" on public.family_members
  for select to authenticated using (private.is_family_member(family_id));
create policy "members update themselves" on public.family_members
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "members read children" on public.children
  for select to authenticated using (private.is_family_member(family_id));
create policy "members add children" on public.children
  for insert to authenticated with check (private.is_family_member(family_id));
create policy "members update children" on public.children
  for update to authenticated
  using (private.is_family_member(family_id)) with check (private.is_family_member(family_id));
create policy "members delete children" on public.children
  for delete to authenticated using (private.is_family_member(family_id));

create policy "members read invitations" on public.family_invitations
  for select to authenticated using (private.is_family_member(family_id));

create policy "members read audit logs" on public.audit_logs
  for select to authenticated using (private.is_family_member(family_id));

-- ---------------------------------------------------------------------------
-- RPC
-- 오류는 errcode P0001과 기계용 메시지 코드로 던진다. 앱이 메시지 코드를 한국어로 바꾼다.
-- ---------------------------------------------------------------------------

create function public.create_family(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_family_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(v_name) not between 1 and 50 then
    raise exception 'invalid_family_name';
  end if;
  if char_length(v_display_name) not between 1 and 30 then
    raise exception 'invalid_display_name';
  end if;
  if exists (select 1 from public.family_members where user_id = v_uid) then
    raise exception 'already_in_family';
  end if;

  insert into public.families (name, created_by)
  values (v_name, v_uid)
  returning id into v_family_id;

  insert into public.family_members (family_id, user_id, role, display_name)
  values (v_family_id, v_uid, 'owner', v_display_name);

  return v_family_id;
end;
$$;

-- 새 초대를 만들면 아직 쓰지 않은 이전 초대는 취소된다. 가족당 열린 초대는 하나뿐이다.
create function public.create_invitation()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_parents constant integer := 2;
  v_uid uuid := auth.uid();
  v_family_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select m.family_id into v_family_id
  from public.family_members m
  where m.user_id = v_uid;
  if v_family_id is null then
    raise exception 'not_in_family';
  end if;

  perform 1 from public.families f where f.id = v_family_id for update;
  if (select count(*) from public.family_members m where m.family_id = v_family_id) >= c_max_parents then
    raise exception 'family_full';
  end if;

  update public.family_invitations i
  set revoked_at = now()
  where i.family_id = v_family_id
    and i.accepted_at is null
    and i.revoked_at is null;

  return query
  insert into public.family_invitations as i (family_id, created_by)
  values (v_family_id, v_uid)
  returning i.code, i.expires_at;
end;
$$;

-- 아직 구성원이 아닌 초대받은 사람이 수락 전에 볼 정보만 돌려준다
create function public.get_invitation(p_code text)
returns table (family_name text, inviter_name text, status text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    f.name,
    m.display_name,
    case
      when i.revoked_at is not null then 'revoked'
      when i.accepted_at is not null then 'used'
      when i.expires_at <= now() then 'expired'
      else 'valid'
    end,
    i.expires_at
  from public.family_invitations i
  join public.families f on f.id = i.family_id
  left join public.family_members m on m.user_id = i.created_by and m.family_id = i.family_id
  where (select auth.uid()) is not null
    and i.code = p_code;
$$;

create function public.accept_invitation(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_parents constant integer := 2;
  v_uid uuid := auth.uid();
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_family_id uuid;
  v_invitation public.family_invitations;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(v_display_name) not between 1 and 30 then
    raise exception 'invalid_display_name';
  end if;

  select i.family_id into v_family_id
  from public.family_invitations i
  where i.code = p_code;
  if v_family_id is null then
    raise exception 'invitation_not_found';
  end if;

  -- create_invitation 과 같은 순서(가족 → 초대)로 잠가 교착을 피한다.
  -- 가족 행 잠금은 같은 가족에 대한 동시 수락도 직렬화한다.
  perform 1 from public.families f where f.id = v_family_id for update;

  select * into v_invitation
  from public.family_invitations i
  where i.code = p_code
  for update;
  if v_invitation.revoked_at is not null then
    raise exception 'invitation_revoked';
  end if;
  if v_invitation.accepted_at is not null then
    raise exception 'invitation_used';
  end if;
  if v_invitation.expires_at <= now() then
    raise exception 'invitation_expired';
  end if;
  if exists (select 1 from public.family_members m where m.user_id = v_uid) then
    raise exception 'already_in_family';
  end if;
  if (select count(*) from public.family_members m where m.family_id = v_invitation.family_id) >= c_max_parents then
    raise exception 'family_full';
  end if;

  insert into public.family_members (family_id, user_id, role, display_name)
  values (v_invitation.family_id, v_uid, 'parent', v_display_name);

  update public.family_invitations i
  set accepted_by = v_uid, accepted_at = now()
  where i.id = v_invitation.id;

  return v_invitation.family_id;
end;
$$;

create function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.family_invitations i
  set revoked_at = now()
  where i.id = p_invitation_id
    and i.family_id = private.current_family_id()
    and i.accepted_at is null
    and i.revoked_at is null;

  if not found then
    raise exception 'invitation_not_found';
  end if;
end;
$$;

revoke all on function public.create_family(text, text) from public, anon;
revoke all on function public.create_invitation() from public, anon;
revoke all on function public.get_invitation(text) from public, anon;
revoke all on function public.accept_invitation(text, text) from public, anon;
revoke all on function public.revoke_invitation(uuid) from public, anon;

grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.create_invitation() to authenticated;
grant execute on function public.get_invitation(text) to authenticated;
grant execute on function public.accept_invitation(text, text) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
