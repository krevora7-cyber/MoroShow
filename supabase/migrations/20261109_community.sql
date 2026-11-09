-- Community data is separate from private viewing history and account settings.
create table if not exists public.moro_social_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(trim(display_name)) between 1 and 60),
  avatar text not null default 'disney_01' check (avatar ~ '^[a-zA-Z0-9_]{1,40}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.moro_social_posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null default auth.uid() references public.moro_social_profiles(user_id) on delete cascade,
  content_id text not null check (char_length(content_id) between 1 and 200),
  title text not null check (char_length(trim(title)) between 1 and 180),
  kind text not null check (kind in ('movie','series','short')),
  poster text check (poster is null or char_length(poster)<=2048),
  caption text not null default '' check (char_length(caption)<=1000),
  created_at timestamptz not null default now()
);
create index if not exists moro_social_posts_created_idx on public.moro_social_posts(created_at desc);
create table if not exists public.moro_social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.moro_social_posts(id) on delete cascade,
  author uuid not null default auth.uid() references public.moro_social_profiles(user_id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists moro_social_comments_post_idx on public.moro_social_comments(post_id,created_at);
create table if not exists public.moro_social_friends (
  requester uuid not null references public.moro_social_profiles(user_id) on delete cascade,
  recipient uuid not null references public.moro_social_profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key(requester,recipient),check(requester<>recipient)
);
create unique index if not exists moro_social_friends_pair_idx on public.moro_social_friends(least(requester,recipient),greatest(requester,recipient));
create table if not exists public.moro_social_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null default auth.uid() references public.moro_social_profiles(user_id) on delete cascade,
  post_id uuid references public.moro_social_posts(id) on delete cascade,
  comment_id uuid references public.moro_social_comments(id) on delete cascade,
  reason text not null check(char_length(trim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  check ((post_id is not null)::int + (comment_id is not null)::int = 1)
);
alter table public.moro_social_profiles enable row level security;
alter table public.moro_social_posts enable row level security;
alter table public.moro_social_comments enable row level security;
alter table public.moro_social_friends enable row level security;
alter table public.moro_social_reports enable row level security;
revoke all on public.moro_social_profiles,public.moro_social_posts,public.moro_social_comments,public.moro_social_friends,public.moro_social_reports from anon,authenticated;
grant select on public.moro_social_profiles,public.moro_social_posts,public.moro_social_comments to anon,authenticated;
grant insert,update,delete on public.moro_social_profiles to authenticated;
grant insert,delete on public.moro_social_posts,public.moro_social_comments to authenticated;
grant select,insert,update,delete on public.moro_social_friends to authenticated;
grant insert,select on public.moro_social_reports to authenticated;
create policy "Social profiles are public" on public.moro_social_profiles for select to anon,authenticated using (true);
create policy "Create own social profile" on public.moro_social_profiles for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Edit own social profile" on public.moro_social_profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Delete own social profile" on public.moro_social_profiles for delete to authenticated using ((select auth.uid())=user_id);
create policy "Social posts are public" on public.moro_social_posts for select to anon,authenticated using (true);
create policy "Create own social post" on public.moro_social_posts for insert to authenticated with check ((select auth.uid())=author);
create policy "Delete own social post" on public.moro_social_posts for delete to authenticated using ((select auth.uid())=author);
create policy "Social comments are public" on public.moro_social_comments for select to anon,authenticated using (true);
create policy "Create own social comment" on public.moro_social_comments for insert to authenticated with check ((select auth.uid())=author);
create policy "Delete own social comment" on public.moro_social_comments for delete to authenticated using ((select auth.uid())=author);
create policy "See own friendships" on public.moro_social_friends for select to authenticated using ((select auth.uid()) in (requester,recipient));
create policy "Create friend request" on public.moro_social_friends for insert to authenticated with check ((select auth.uid())=requester and status='pending');
create policy "Recipient accepts request" on public.moro_social_friends for update to authenticated using ((select auth.uid())=recipient and status='pending') with check ((select auth.uid())=recipient and status='accepted');
create policy "Remove own friendship" on public.moro_social_friends for delete to authenticated using ((select auth.uid()) in (requester,recipient));
create or replace function public.moro_protect_friend_update() returns trigger language plpgsql set search_path = '' as $$
begin
 if old.requester<>new.requester or old.recipient<>new.recipient or old.created_at<>new.created_at or old.status<>'pending' or new.status<>'accepted' then raise exception 'Invalid friend request update'; end if;
 return new;
end $$;
create trigger moro_social_friend_update before update on public.moro_social_friends for each row execute function public.moro_protect_friend_update();
create policy "Report content" on public.moro_social_reports for insert to authenticated with check ((select auth.uid())=reporter);
create policy "See own reports" on public.moro_social_reports for select to authenticated using ((select auth.uid())=reporter);
