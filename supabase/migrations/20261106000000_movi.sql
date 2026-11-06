-- Movi database schema for Supabase.
-- Film metadata is static (docs/data); film_id is the film's index in docs/data/index.json.

-- ============================================================
-- Tables
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_hue int not null default 40 check (avatar_hue between 0 and 359),
  is_private boolean not null default false,
  yearly_goal int not null default 52 check (yearly_goal between 1 and 1000),
  ranked_count int not null default 0,
  created_at timestamptz not null default now()
);

create table public.rankings (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  film_id int not null check (film_id >= 0),
  bucket text not null check (bucket in ('loved', 'fine', 'disliked')),
  pos int not null check (pos >= 0),
  score numeric(3, 1) not null check (score between 0 and 10),
  note text not null default '' check (char_length(note) <= 2000),
  watched_on date,
  watched_where text not null default '' check (char_length(watched_where) <= 40),
  watched_with text not null default '' check (char_length(watched_with) <= 120),
  rewatch boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, film_id)
);
create index rankings_film_idx on public.rankings (film_id);

create table public.watchlist (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  film_id int not null check (film_id >= 0),
  from_user uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, film_id)
);

create table public.follows (
  follower uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  followee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
create index follows_followee_idx on public.follows (followee);

create table public.activities (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('ranked', 'want')),
  film_id int not null check (film_id >= 0),
  bucket text check (bucket in ('loved', 'fine', 'disliked')),
  score numeric(3, 1),
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
create index activities_user_created_idx on public.activities (user_id, created_at desc);
create index activities_created_idx on public.activities (created_at desc);

create table public.likes (
  activity_id bigint not null references public.activities (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create table public.comments (
  id bigint generated always as identity primary key,
  activity_id bigint not null references public.activities (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_activity_idx on public.comments (activity_id, created_at);

create table public.recommendations (
  id bigint generated always as identity primary key,
  from_user uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  film_id int not null check (film_id >= 0),
  message text not null default '' check (char_length(message) <= 280),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create index recommendations_to_idx on public.recommendations (to_user, created_at desc);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('follow', 'follow_request', 'follow_accepted', 'like', 'comment', 'rec')),
  activity_id bigint references public.activities (id) on delete cascade,
  film_id int,
  body text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ============================================================
-- Helpers
-- ============================================================

-- Same formula as scoreFor() in docs/js/model.js.
create function public.movi_score(bucket text, pos int, n int) returns numeric
language sql immutable as $$
  select round((case
    when n <= 1 then lo + (hi - lo) * 0.75
    else hi - (hi - lo) * (pos::numeric / (n - 1))
  end)::numeric, 1)
  from (select
    case bucket when 'loved' then 6.8 when 'fine' then 3.4 else 0 end as lo,
    case bucket when 'loved' then 10 when 'fine' then 6.7 else 3.3 end as hi) b
$$;

-- Whether the current viewer may see a user's rankings, watchlist and activity.
create function public.can_view(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid()
    or exists (select 1 from profiles p where p.id = target and not p.is_private)
    or exists (select 1 from follows f where f.follower = auth.uid() and f.followee = target and f.status = 'accepted')
$$;

create function public.username_available(name text) returns boolean
language sql stable security definer set search_path = public as $$
  select name ~ '^[a-z0-9_.]{3,20}$' and not exists (select 1 from profiles where username = name)
$$;

-- ============================================================
-- Profile creation on sign-up
-- ============================================================

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_.]', '', 'g'));
  candidate text;
begin
  base := left(base, 16);
  if char_length(base) < 3 then base := 'movi' || base; end if;
  candidate := base;
  while exists (select 1 from profiles where username = candidate) loop
    candidate := left(base, 16) || floor(random() * 9000 + 1000)::int;
  end loop;
  insert into profiles (id, username, display_name, avatar_hue)
  values (
    new.id,
    candidate,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), candidate), 40),
    floor(random() * 360)::int
  );
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- RPCs
-- ============================================================

-- Replace the caller's three ranked lists in one transaction. Positions and
-- scores are recomputed; notes and other entry details are kept.
create function public.save_lists(loved int[], fine int[], disliked int[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  all_ids int[] := coalesce(loved, '{}') || coalesce(fine, '{}') || coalesce(disliked, '{}');
begin
  if uid is null then raise exception 'not signed in'; end if;
  if (select count(distinct x) from unnest(all_ids) x) <> coalesce(array_length(all_ids, 1), 0) then
    raise exception 'a film can only appear once';
  end if;

  delete from rankings where user_id = uid and not (film_id = any (all_ids));

  insert into rankings (user_id, film_id, bucket, pos, score)
  select uid, t.film_id, t.bucket, t.pos, movi_score(t.bucket, t.pos, t.n)
  from (
    select f as film_id, b.bucket, (o - 1)::int as pos, cardinality(b.ids) as n
    from (values ('loved', coalesce(loved, '{}')), ('fine', coalesce(fine, '{}')), ('disliked', coalesce(disliked, '{}'))) as b (bucket, ids),
      unnest(b.ids) with ordinality as u (f, o)
  ) t
  on conflict (user_id, film_id) do update
    set bucket = excluded.bucket, pos = excluded.pos, score = excluded.score,
        updated_at = case when rankings.bucket <> excluded.bucket then now() else rankings.updated_at end;

  update profiles set ranked_count = cardinality(all_ids) where id = uid;
end $$;

-- Average score across everyone on Movi for the given films.
create function public.film_stats(ids int[]) returns table (film_id int, avg_score numeric, n bigint)
language sql stable security definer set search_path = public as $$
  select r.film_id, round(avg(r.score), 1), count(*)
  from rankings r where r.film_id = any (ids)
  group by r.film_id
$$;

create function public.top_films(min_count int default 2, lim int default 30)
returns table (film_id int, avg_score numeric, n bigint)
language sql stable security definer set search_path = public as $$
  select r.film_id, round(avg(r.score), 1), count(*)
  from rankings r
  group by r.film_id
  having count(*) >= min_count
  order by avg(r.score) desc, count(*) desc
  limit least(lim, 100)
$$;

create function public.delete_me() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ============================================================
-- Triggers: follow status and notifications
-- ============================================================

create function public.follows_set_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.status := case when (select is_private from profiles where id = new.followee) then 'pending' else 'accepted' end;
  return new;
end $$;

create trigger follows_set_status before insert on public.follows
for each row execute function public.follows_set_status();

create function public.notify_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into notifications (user_id, actor_id, kind)
    values (new.followee, new.follower, case when new.status = 'pending' then 'follow_request' else 'follow' end);
  elsif old.status = 'pending' and new.status = 'accepted' then
    delete from notifications where user_id = new.followee and actor_id = new.follower and kind = 'follow_request';
    insert into notifications (user_id, actor_id, kind) values (new.follower, new.followee, 'follow_accepted');
  end if;
  return new;
end $$;

create trigger follows_notify after insert or update on public.follows
for each row execute function public.notify_follow();

create function public.notify_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; fid int;
begin
  select user_id, film_id into owner, fid from activities where id = new.activity_id;
  if owner is not null and owner <> new.user_id then
    insert into notifications (user_id, actor_id, kind, activity_id, film_id) values (owner, new.user_id, 'like', new.activity_id, fid);
  end if;
  return new;
end $$;

create trigger likes_notify after insert on public.likes
for each row execute function public.notify_like();

create function public.notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; fid int;
begin
  select user_id, film_id into owner, fid from activities where id = new.activity_id;
  if owner is not null and owner <> new.user_id then
    insert into notifications (user_id, actor_id, kind, activity_id, film_id, body)
    values (owner, new.user_id, 'comment', new.activity_id, fid, left(new.body, 140));
  end if;
  return new;
end $$;

create trigger comments_notify after insert on public.comments
for each row execute function public.notify_comment();

create function public.notify_rec() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, actor_id, kind, film_id, body)
  values (new.to_user, new.from_user, 'rec', new.film_id, left(new.message, 140));
  return new;
end $$;

create trigger recommendations_notify after insert on public.recommendations
for each row execute function public.notify_rec();

-- ============================================================
-- Row level security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.rankings enable row level security;
alter table public.watchlist enable row level security;
alter table public.follows enable row level security;
alter table public.activities enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.recommendations enable row level security;
alter table public.notifications enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "edit own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, bio, avatar_hue, is_private, yearly_goal) on public.profiles to authenticated;

create policy "see visible rankings" on public.rankings for select using (public.can_view(user_id));
create policy "edit own ranking details" on public.rankings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.rankings from anon, authenticated;
grant update (note, watched_on, watched_where, watched_with, rewatch) on public.rankings to authenticated;

create policy "see visible watchlists" on public.watchlist for select using (public.can_view(user_id));
create policy "add to own watchlist" on public.watchlist for insert to authenticated with check (user_id = auth.uid());
create policy "remove from own watchlist" on public.watchlist for delete to authenticated using (user_id = auth.uid());

create policy "see follows" on public.follows for select using (status = 'accepted' or follower = auth.uid() or followee = auth.uid());
create policy "follow as yourself" on public.follows for insert to authenticated with check (follower = auth.uid());
create policy "unfollow or remove follower" on public.follows for delete to authenticated using (follower = auth.uid() or followee = auth.uid());
create policy "approve requests" on public.follows for update to authenticated using (followee = auth.uid()) with check (followee = auth.uid() and status = 'accepted');
revoke update on public.follows from anon, authenticated;
grant update (status) on public.follows to authenticated;

create policy "see visible activity" on public.activities for select using (public.can_view(user_id));
create policy "post own activity" on public.activities for insert to authenticated with check (user_id = auth.uid());
create policy "update own activity" on public.activities for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own activity" on public.activities for delete to authenticated using (user_id = auth.uid());
revoke update on public.activities from anon, authenticated;
grant update (note, score, bucket) on public.activities to authenticated;

create policy "see likes on visible activity" on public.likes for select
  using (exists (select 1 from public.activities a where a.id = activity_id and public.can_view(a.user_id)));
create policy "like visible activity" on public.likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.activities a where a.id = activity_id and public.can_view(a.user_id)));
create policy "unlike" on public.likes for delete to authenticated using (user_id = auth.uid());

create policy "see comments on visible activity" on public.comments for select
  using (exists (select 1 from public.activities a where a.id = activity_id and public.can_view(a.user_id)));
create policy "comment on visible activity" on public.comments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.activities a where a.id = activity_id and public.can_view(a.user_id)));
create policy "delete own comment or comment on own activity" on public.comments for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.activities a where a.id = activity_id and a.user_id = auth.uid()));

create policy "see own recommendations" on public.recommendations for select to authenticated using (from_user = auth.uid() or to_user = auth.uid());
create policy "send recommendations" on public.recommendations for insert to authenticated with check (from_user = auth.uid());
create policy "delete received recommendations" on public.recommendations for delete to authenticated using (to_user = auth.uid() or from_user = auth.uid());

create policy "see own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark own notifications read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "clear own notifications" on public.notifications for delete to authenticated using (user_id = auth.uid());
revoke insert on public.notifications from anon, authenticated;
revoke update on public.notifications from anon, authenticated;
grant update (read) on public.notifications to authenticated;

revoke execute on function public.save_lists(int[], int[], int[]) from anon, public;
revoke execute on function public.delete_me() from anon, public;
grant execute on function public.save_lists(int[], int[], int[]) to authenticated;
grant execute on function public.delete_me() to authenticated;
