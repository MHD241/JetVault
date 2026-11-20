-- Jetvault Flight Sim early access
--   Solo route:    150 approved photos.
--   Partner route: one invite link, one partner. Each of you needs 75 approved photos of your own,
--                  and access unlocks for both of you only when both have reached 75.
--
-- How it stays clean:
--   * Photos are never pooled or moved. Each account must hold its own 75, so an empty or
--     throwaway partner account blocks access instead of helping.
--   * One link pairs with exactly one person. Nobody can sit in two pairs. You cannot pair
--     with yourself. Once paired, the pair is locked.
--   * Only approved photos count (profile and post marker rows are ignored).
--   * Access is worked out on the server every time. Nothing is stored that a browser could fake.
--   * The table can only be reached through the functions below.
--
-- LOCKED BY DEFAULT: partner links cannot be created or accepted until you open the feature, which
-- you should do only after Flight Sim reads fs_early_access_status. To open (and to lock again):
--     update public.early_access_settings set teamup_open = true;     -- open
--     update public.early_access_settings set teamup_open = false;    -- lock
--
-- Run once in the Supabase SQL editor. It does not change any existing table.

create table if not exists public.early_access_pairs (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  inviter_id  uuid not null references auth.users(id) on delete cascade,
  invitee_id  uuid references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at  timestamptz,
  constraint early_access_not_self check (invitee_id is null or invitee_id <> inviter_id),
  constraint early_access_accept_consistent check ((invitee_id is null) = (accepted_at is null))
);

-- At most one live link per inviter, and a person can be the invitee of at most one live pair.
create unique index if not exists early_access_one_live_link_per_inviter
  on public.early_access_pairs (inviter_id) where revoked_at is null;
create unique index if not exists early_access_one_live_pair_per_invitee
  on public.early_access_pairs (invitee_id) where revoked_at is null and invitee_id is not null;

alter table public.early_access_pairs enable row level security;
revoke all on public.early_access_pairs from anon, authenticated;

-- One-row switch for the partner feature. Locked until you flip it.
create table if not exists public.early_access_settings (
  id          boolean primary key default true check (id),
  teamup_open boolean not null default false
);
insert into public.early_access_settings (id) values (true) on conflict do nothing;
alter table public.early_access_settings enable row level security;
revoke all on public.early_access_settings from anon, authenticated;

create or replace function public.fs_teamup_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select teamup_open from public.early_access_settings where id), false);
$$;

-- Approved photo count for one account (internal helper, not callable from the browser).
create or replace function public.fs_photo_count(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.photos
  where owner_id = p_user
    and coalesce(status, 'approved') = 'approved'
    and coalesce(registration, '') not in ('__SA_PROFILE__', '__SA_POST__');
$$;
revoke all on function public.fs_photo_count(uuid) from public, anon, authenticated;

-- Where the signed-in account stands.
create or replace function public.fs_early_access_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  mine       integer;
  pair       public.early_access_pairs;
  partner    uuid;
  partner_n  integer := 0;
  partner_j  jsonb := null;
  link_state text := 'none';
  solo_ok    boolean;
  pair_ok    boolean := false;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  mine := public.fs_photo_count(uid);

  select * into pair
  from public.early_access_pairs
  where revoked_at is null and (inviter_id = uid or invitee_id = uid)
  order by created_at desc
  limit 1;

  if pair.id is not null then
    if pair.invitee_id is null then
      link_state := 'open';
    else
      link_state := 'paired';
      partner := case when pair.inviter_id = uid then pair.invitee_id else pair.inviter_id end;
      partner_n := public.fs_photo_count(partner);
      select jsonb_build_object(
               'name', coalesce(nullif(display_name, ''), username, 'Your partner'),
               'username', username,
               'photos', partner_n)
        into partner_j
      from public.profiles where id = partner;
      if partner_j is null then
        partner_j := jsonb_build_object('name', 'Your partner', 'username', null, 'photos', partner_n);
      end if;
    end if;
  end if;

  solo_ok := mine >= 150;
  pair_ok := (link_state = 'paired' and mine >= 75 and partner_n >= 75);

  return jsonb_build_object(
    'teamup_open', public.fs_teamup_open(),
    'photos',      mine,
    'solo_target', 150,
    'pair_target', 75,
    'link_state',  link_state,
    'code',        case when link_state = 'open' then pair.code else null end,
    'partner',     partner_j,
    'unlocked',    (solo_ok or pair_ok),
    'via',         case when solo_ok then 'solo' when pair_ok then 'pair' else null end
  );
end;
$$;

-- Create (or fetch) your single invite link.
create or replace function public.fs_create_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  pair  public.early_access_pairs;
  c     text;
  tries integer := 0;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  if not public.fs_teamup_open() then
    raise exception 'teamup_locked';
  end if;
  perform pg_advisory_xact_lock(hashtext('fs_pair:' || uid::text));

  select * into pair
  from public.early_access_pairs
  where revoked_at is null and (inviter_id = uid or invitee_id = uid)
  limit 1;

  if pair.id is not null then
    if pair.invitee_id is not null then
      raise exception 'already_paired';
    end if;
    return pair.code;          -- you already have an open link: same one every time
  end if;

  loop
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    begin
      insert into public.early_access_pairs (code, inviter_id) values (c, uid);
      return c;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 5 then raise; end if;
    end;
  end loop;
end;
$$;

-- Accept someone's invite link. Pairs you with them, one-to-one.
create or replace function public.fs_accept_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  c    text := upper(btrim(coalesce(p_code, '')));
  pair public.early_access_pairs;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  if not public.fs_teamup_open() then
    raise exception 'teamup_locked';
  end if;

  select * into pair
  from public.early_access_pairs
  where code = c and revoked_at is null
  for update;

  if pair.id is null then
    raise exception 'invalid_code';
  end if;
  if pair.inviter_id = uid then
    raise exception 'own_link';
  end if;
  if pair.invitee_id is not null then
    if pair.invitee_id = uid then
      return public.fs_early_access_status();   -- already yours, nothing to do
    end if;
    raise exception 'link_used';
  end if;

  perform pg_advisory_xact_lock(hashtext('fs_pair:' || uid::text));

  -- You cannot be in two pairs.
  if exists (
    select 1 from public.early_access_pairs
    where revoked_at is null and id <> pair.id
      and (invitee_id = uid or (inviter_id = uid and invitee_id is not null))
  ) then
    raise exception 'already_paired';
  end if;

  -- The person who sent the link must not already be somebody's invitee.
  if exists (
    select 1 from public.early_access_pairs
    where revoked_at is null and invitee_id = pair.inviter_id
  ) then
    raise exception 'inviter_unavailable';
  end if;

  -- Your own unused link is cancelled, so you only ever have one partner.
  update public.early_access_pairs
     set revoked_at = now()
   where revoked_at is null and inviter_id = uid and invitee_id is null;

  update public.early_access_pairs
     set invitee_id = uid, accepted_at = now()
   where id = pair.id;

  return public.fs_early_access_status();
end;
$$;

-- Cancel your link before anyone has used it. A pair cannot be undone.
create or replace function public.fs_revoke_invite()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  if exists (
    select 1 from public.early_access_pairs
    where revoked_at is null and invitee_id is not null
      and (inviter_id = uid or invitee_id = uid)
  ) then
    raise exception 'locked';
  end if;
  update public.early_access_pairs
     set revoked_at = now()
   where revoked_at is null and inviter_id = uid and invitee_id is null;
end;
$$;

revoke all on function public.fs_early_access_status()   from public, anon;
revoke all on function public.fs_create_invite()         from public, anon;
revoke all on function public.fs_accept_invite(text)     from public, anon;
revoke all on function public.fs_revoke_invite()         from public, anon;
revoke all on function public.fs_teamup_open()           from public, anon;
grant execute on function public.fs_early_access_status() to authenticated;
grant execute on function public.fs_create_invite()       to authenticated;
grant execute on function public.fs_accept_invite(text)   to authenticated;
grant execute on function public.fs_revoke_invite()       to authenticated;
grant execute on function public.fs_teamup_open()         to authenticated;
