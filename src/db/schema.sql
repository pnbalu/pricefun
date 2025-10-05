-- Users are Supabase auth.users; we'll store profiles keyed by user id (phone as username)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  display_name text,
  created_at timestamp with time zone default now()
);

-- One-to-one or group chats
create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  is_group boolean default false,
  created_at timestamp with time zone default now()
);

-- Participants
create table if not exists chat_participants (
  chat_id uuid references chats(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member',
  inserted_at timestamp with time zone default now(),
  last_read_at timestamp with time zone default now(),
  primary key (chat_id, user_id)
);

-- Messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone default now()
);

-- Per-user hides (delete for me)
create table if not exists message_hides (
  message_id uuid references messages(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  hidden_at timestamp with time zone default now(),
  primary key (message_id, user_id)
);

-- Simple view for chat list items (latest message and title)
create or replace view chats_view as
with me as (
  select auth.uid() as id
)
select
  c.id,
  case
    when c.is_group then 'Group'
    else coalesce(other_p.display_name, other_p.phone, 'Chat')
  end as title,
  (select m.content from messages m where m.chat_id = c.id order by m.created_at desc limit 1) as last_message,
  (select m.created_at from messages m where m.chat_id = c.id order by m.created_at desc limit 1) as updated_at,
  (
    select count(*) from messages m
    join me on true
    where m.chat_id = c.id
      and m.author_id <> me.id
      and m.created_at > coalesce(cp.last_read_at, 'epoch')
  )::int as unread_count
from chats c
join me on true
join chat_participants cp on cp.chat_id = c.id and cp.user_id = me.id
left join chat_participants other_cp on other_cp.chat_id = c.id and other_cp.user_id <> me.id
left join profiles other_p on other_p.id = other_cp.user_id;

-- RLS
alter table profiles enable row level security;
alter table chats enable row level security;
alter table chat_participants enable row level security;
alter table messages enable row level security;
alter table message_hides enable row level security;

drop policy if exists "profiles are self" on profiles;
drop policy if exists "profiles self select" on profiles;
drop policy if exists "profiles self insert" on profiles;
drop policy if exists "profiles self update" on profiles;
create policy "profiles self select" on profiles for select using (true);
create policy "profiles self insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles self update" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "chat members can view chat" on chats;
create policy "chat members can view chat" on chats for select using (
  exists(select 1 from chat_participants cp where cp.chat_id = chats.id and cp.user_id = auth.uid())
);

drop policy if exists "chat members can list participants" on chat_participants;
drop policy if exists "chat participants visible to authed" on chat_participants;
create policy "chat participants visible to authed" on chat_participants
  for select using (auth.role() = 'authenticated');

-- allow users to update their own participant row (to set last_read_at)
drop policy if exists "chat participants update self" on chat_participants;
create policy "chat participants update self" on chat_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "chat members can read messages" on messages;
drop policy if exists "messages readable by author or chat members" on messages;
create policy "messages readable by author or chat members" on messages for select using (
  author_id = auth.uid() OR exists(select 1 from chat_participants cp where cp.chat_id = messages.chat_id and cp.user_id = auth.uid())
);

drop policy if exists "chat members can send messages" on messages;
drop policy if exists "messages insert by self" on messages;
create policy "messages insert by self" on messages for insert with check (
  author_id = auth.uid()
);

-- Allow author to hard-delete their own message
drop policy if exists "messages delete by author" on messages;
create policy "messages delete by author" on messages for delete using (
  author_id = auth.uid()
);

-- Hides: user can insert/select own hides
drop policy if exists "message_hides select self" on message_hides;
create policy "message_hides select self" on message_hides for select using (user_id = auth.uid());
drop policy if exists "message_hides insert self" on message_hides;
create policy "message_hides insert self" on message_hides for insert with check (user_id = auth.uid());

-- Helper RPC to get or create a direct chat by phone, ensures membership
create or replace function get_or_create_direct_chat_by_phone(target_phone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  other_user_id uuid;
  direct_chat_id uuid;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  select id into other_user_id from profiles where phone = target_phone;
  if other_user_id is null then
    raise exception 'user with phone % not found', target_phone;
  end if;
  if other_user_id = current_user_id then
    raise exception 'cannot chat with yourself';
  end if;

  -- check existing direct chat between the two
  select c.id into direct_chat_id
  from chats c
  join chat_participants a on a.chat_id = c.id and a.user_id = current_user_id
  join chat_participants b on b.chat_id = c.id and b.user_id = other_user_id
  where c.is_group = false
  limit 1;

  if direct_chat_id is null then
    insert into chats(is_group) values(false) returning id into direct_chat_id;
    insert into chat_participants(chat_id, user_id) values (direct_chat_id, current_user_id), (direct_chat_id, other_user_id);
  end if;

  return direct_chat_id;
end;
$$;


