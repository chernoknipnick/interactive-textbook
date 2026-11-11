-- Run in the textbook Supabase project, as the project database owner.
begin;

create schema if not exists textbook_private;
revoke all on schema textbook_private from public;
grant usage on schema textbook_private to authenticated;

create table if not exists public.textbook_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 100),
  created_at timestamptz not null default now()
);
create table if not exists public.textbook_teachers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.textbook_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  created_at timestamptz not null default now()
);
create table if not exists public.textbook_memberships (
  group_id uuid not null references public.textbook_groups(id) on delete cascade,
  user_id uuid not null references public.textbook_profiles(user_id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists textbook_memberships_user_idx
  on public.textbook_memberships(user_id);
create index if not exists textbook_groups_owner_idx
  on public.textbook_groups(owner_id);
create table if not exists textbook_private.group_codes (
  group_id uuid primary key references public.textbook_groups(id) on delete cascade,
  code text not null unique
);
alter table textbook_private.group_codes enable row level security;
revoke all on textbook_private.group_codes from public, anon, authenticated;

create or replace function textbook_private.is_teacher()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.textbook_teachers where user_id = auth.uid());
$$;

create or replace function textbook_private.owns_group(p_group uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.textbook_groups
    where id = p_group and owner_id = auth.uid()
  );
$$;

create or replace function textbook_private.is_member(p_group uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.textbook_memberships
    where group_id = p_group and user_id = auth.uid()
  );
$$;

create or replace function textbook_private.can_read_profile(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_user = auth.uid() or exists (
    select 1 from public.textbook_memberships m
    join public.textbook_groups g on g.id = m.group_id
    where m.user_id = p_user and g.owner_id = auth.uid()
  );
$$;

create or replace function textbook_private.save_profile(p_full_name text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_full_name is null or char_length(btrim(p_full_name)) not between 2 and 100 then
    raise exception 'INVALID_NAME';
  end if;
  insert into public.textbook_profiles(user_id, full_name)
  values (auth.uid(), btrim(p_full_name))
  on conflict (user_id) do update set full_name = excluded.full_name;
end;
$$;

create or replace function textbook_private.create_group(p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_group uuid;
begin
  if not textbook_private.is_teacher() then raise exception 'TEACHER_REQUIRED'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 80 then
    raise exception 'INVALID_GROUP_NAME';
  end if;
  insert into public.textbook_groups(owner_id, name)
  values (auth.uid(), btrim(p_name)) returning id into v_group;
  insert into textbook_private.group_codes(group_id, code)
  values (v_group, replace(gen_random_uuid()::text, '-', ''));
  return v_group;
end;
$$;

create or replace function textbook_private.group_code(p_group uuid, p_rotate boolean)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_code text;
begin
  if not textbook_private.owns_group(p_group) then raise exception 'GROUP_ACCESS_DENIED'; end if;
  if p_rotate then
    update textbook_private.group_codes
    set code = replace(gen_random_uuid()::text, '-', '') where group_id = p_group;
  end if;
  select code into v_code from textbook_private.group_codes where group_id = p_group;
  return v_code;
end;
$$;

create or replace function textbook_private.join_group(p_code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_group uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.textbook_profiles where user_id = auth.uid()) then
    raise exception 'PROFILE_REQUIRED';
  end if;
  select group_id into v_group from textbook_private.group_codes
  where code = lower(btrim(p_code)) for share;
  if v_group is null then raise exception 'INVALID_GROUP_CODE'; end if;
  insert into public.textbook_memberships(group_id, user_id)
  values (v_group, auth.uid()) on conflict do nothing;
  return v_group;
end;
$$;

-- Public RPC entry points keep privileged implementations in a private schema.
create or replace function public.textbook_save_profile(p_full_name text)
returns void language sql security invoker set search_path = ''
as $$ select textbook_private.save_profile(p_full_name); $$;
create or replace function public.textbook_create_group(p_name text)
returns uuid language sql security invoker set search_path = ''
as $$ select textbook_private.create_group(p_name); $$;
create or replace function public.textbook_group_code(p_group uuid, p_rotate boolean default false)
returns text language sql security invoker set search_path = ''
as $$ select textbook_private.group_code(p_group, p_rotate); $$;
create or replace function public.textbook_join_group(p_code text)
returns uuid language sql security invoker set search_path = ''
as $$ select textbook_private.join_group(p_code); $$;

alter table public.textbook_profiles enable row level security;
alter table public.textbook_teachers enable row level security;
alter table public.textbook_groups enable row level security;
alter table public.textbook_memberships enable row level security;

revoke all on public.textbook_profiles, public.textbook_teachers,
  public.textbook_groups, public.textbook_memberships from public, anon, authenticated;
grant select on public.textbook_profiles, public.textbook_teachers,
  public.textbook_groups, public.textbook_memberships to authenticated;
grant update(name) on public.textbook_groups to authenticated;
grant delete on public.textbook_memberships to authenticated;

drop policy if exists textbook_profile_read on public.textbook_profiles;
create policy textbook_profile_read on public.textbook_profiles
  for select to authenticated using (textbook_private.can_read_profile(user_id));
drop policy if exists textbook_teacher_read on public.textbook_teachers;
create policy textbook_teacher_read on public.textbook_teachers
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists textbook_group_read on public.textbook_groups;
create policy textbook_group_read on public.textbook_groups
  for select to authenticated using (owner_id = (select auth.uid()) or textbook_private.is_member(id));
drop policy if exists textbook_group_rename on public.textbook_groups;
create policy textbook_group_rename on public.textbook_groups
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
drop policy if exists textbook_membership_read on public.textbook_memberships;
create policy textbook_membership_read on public.textbook_memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or textbook_private.owns_group(group_id));
drop policy if exists textbook_membership_remove on public.textbook_memberships;
create policy textbook_membership_remove on public.textbook_memberships
  for delete to authenticated
  using (user_id = (select auth.uid()) or textbook_private.owns_group(group_id));

revoke all on all functions in schema textbook_private from public, anon;
grant execute on all functions in schema textbook_private to authenticated;
revoke all on function public.textbook_save_profile(text),
  public.textbook_create_group(text), public.textbook_group_code(uuid, boolean),
  public.textbook_join_group(text) from public, anon;
grant execute on function public.textbook_save_profile(text),
  public.textbook_create_group(text), public.textbook_group_code(uuid, boolean),
  public.textbook_join_group(text) to authenticated;

commit;
