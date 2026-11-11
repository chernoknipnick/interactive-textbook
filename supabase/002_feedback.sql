begin;

create table if not exists public.textbook_feedback (
  id uuid primary key,
  category text not null check (category in ('unclear', 'bug', 'idea')),
  message text not null check (char_length(btrim(message)) between 10 and 3000),
  topic_url text not null default '' check (char_length(topic_url) <= 2048),
  sender_name text not null default '' check (char_length(sender_name) <= 100),
  status text not null default 'new' check (status in ('new', 'planned', 'done')),
  created_at timestamptz not null default now()
);
alter table public.textbook_feedback enable row level security;
revoke all on public.textbook_feedback from public, anon, authenticated;
grant select on public.textbook_feedback to authenticated;
grant update(status) on public.textbook_feedback to authenticated;

create or replace function textbook_private.send_feedback(
  p_id uuid, p_category text, p_message text, p_topic_url text,
  p_sender_name text, p_website text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
begin
  if p_id is null or p_category is null or p_category not in ('unclear', 'bug', 'idea')
     or p_message is null or char_length(btrim(p_message)) not between 10 and 3000
     or p_sender_name is null or char_length(p_sender_name) > 100
     or p_topic_url is null or char_length(p_topic_url) > 2048
     or coalesce(p_website, '') <> '' then
    raise exception 'INVALID_FEEDBACK';
  end if;
  if p_topic_url <> '' and p_topic_url !~
    '^https://chernoknipnick\.github\.io/interactive-textbook/[^?=&]*$' then
    raise exception 'INVALID_TOPIC_URL';
  end if;
  insert into public.textbook_feedback(id, category, message, topic_url, sender_name)
  values (p_id, p_category, btrim(p_message), p_topic_url, btrim(p_sender_name))
  on conflict (id) do nothing;
  return p_id;
end;
$$;

create or replace function public.textbook_send_feedback(
  p_id uuid, p_category text, p_message text, p_topic_url text,
  p_sender_name text, p_website text default ''
)
returns uuid language sql security invoker set search_path = ''
as $$
  select textbook_private.send_feedback(
    p_id, p_category, p_message, p_topic_url, p_sender_name, p_website
  );
$$;

revoke all on function textbook_private.send_feedback(uuid,text,text,text,text,text) from public;
revoke all on function public.textbook_send_feedback(uuid,text,text,text,text,text) from public;
grant usage on schema textbook_private to anon;
grant execute on function textbook_private.send_feedback(uuid,text,text,text,text,text),
  public.textbook_send_feedback(uuid,text,text,text,text,text) to anon, authenticated;

drop policy if exists textbook_feedback_read on public.textbook_feedback;
create policy textbook_feedback_read on public.textbook_feedback
  for select to authenticated using (textbook_private.is_teacher());
drop policy if exists textbook_feedback_update on public.textbook_feedback;
create policy textbook_feedback_update on public.textbook_feedback
  for update to authenticated using (textbook_private.is_teacher())
  with check (textbook_private.is_teacher());

commit;
