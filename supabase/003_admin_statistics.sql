-- Aggregate registration statistics and a paged directory for appointed admins.
-- Assign administrators separately as the database owner; never through the client.
begin;

create table if not exists public.textbook_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.textbook_administrators enable row level security;
revoke all on public.textbook_administrators from public, anon, authenticated;
grant select on public.textbook_administrators to authenticated;
drop policy if exists textbook_administrator_self on public.textbook_administrators;
create policy textbook_administrator_self on public.textbook_administrators
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function textbook_private.is_administrator()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.textbook_administrators where user_id=auth.uid()); $$;

create or replace function textbook_private.admin_statistics()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Moscow')::date;
  v_result jsonb;
begin
  if not textbook_private.is_administrator() then raise exception 'ADMIN_REQUIRED'; end if;
  with accounts as (
    select email_confirmed_at, (created_at at time zone 'Europe/Moscow')::date as day
    from auth.users where not coalesce(is_anonymous,false)
  ), days as (
    select v_today - n as day from generate_series(0,13) n
  )
  select jsonb_build_object(
    'generated_at', now(), 'timezone', 'Europe/Moscow',
    'accounts', (select count(*) from accounts),
    'confirmed', (select count(*) from accounts where email_confirmed_at is not null),
    'unconfirmed', (select count(*) from accounts where email_confirmed_at is null),
    'new_today', (select count(*) from accounts where day=v_today),
    'new_7_days', (select count(*) from accounts where day between v_today-6 and v_today),
    'groups', (select count(*) from public.textbook_groups),
    'group_members', (select count(distinct user_id) from public.textbook_memberships),
    'daily', (select jsonb_agg(jsonb_build_object('date',day,'count',registrations) order by day)
      from (select d.day,count(a.day) as registrations from days d
            left join accounts a on a.day=d.day group by d.day) counts)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function textbook_private.admin_users(p_query text, p_page integer)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if not textbook_private.is_administrator() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_query is null or char_length(p_query)>100 or p_page is null or p_page<1 or p_page>100000 then
    raise exception 'INVALID_ADMIN_FILTER';
  end if;
  with people as (
    select u.id, coalesce(nullif(btrim(p.full_name),''),nullif(btrim(u.raw_user_meta_data->>'full_name'),''),'Без имени') as full_name,
      coalesce(u.email,'') as email, u.created_at, u.email_confirmed_at is not null as confirmed,
      case when exists(select 1 from public.textbook_administrators a where a.user_id=u.id) then 'administrator'
           when exists(select 1 from public.textbook_teachers t where t.user_id=u.id) then 'teacher'
           else 'student' end as role
    from auth.users u left join public.textbook_profiles p on p.user_id=u.id
    where not coalesce(u.is_anonymous,false)
  ), filtered as (
    select * from people where strpos(lower(full_name||' '||email),lower(btrim(p_query)))>0
  )
  select jsonb_build_object('total',(select count(*) from filtered),'page',p_page,'page_size',25,
    'users',coalesce((select jsonb_agg(to_jsonb(page_rows) order by created_at desc,id)
      from (select id,full_name,email,created_at,confirmed,role from filtered
            order by created_at desc,id limit 25 offset (p_page-1)*25) page_rows),'[]'::jsonb))
  into v_result;
  return v_result;
end;
$$;

create or replace function public.textbook_admin_statistics()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select textbook_private.admin_statistics(); $$;
create or replace function public.textbook_admin_users(p_query text default '',p_page integer default 1)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select textbook_private.admin_users(p_query,p_page); $$;

revoke all on function textbook_private.is_administrator(),textbook_private.admin_statistics(),
  textbook_private.admin_users(text,integer),public.textbook_admin_statistics(),public.textbook_admin_users(text,integer)
  from public,anon;
grant execute on function textbook_private.is_administrator(),textbook_private.admin_statistics(),
  textbook_private.admin_users(text,integer),public.textbook_admin_statistics(),public.textbook_admin_users(text,integer)
  to authenticated;
commit;
