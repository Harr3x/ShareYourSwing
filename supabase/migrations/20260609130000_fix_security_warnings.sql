-- Fix security advisor warnings:
-- 1. Add SET search_path = '' to are_friends, can_see_round, merge_player_score
-- 2. Revoke anon execute on are_friends, can_see_round, rls_auto_enable
-- 3. Revoke authenticated execute on rls_auto_enable (event trigger, not user-callable)

create or replace function public.are_friends(user_a uuid, user_b uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
    and ((requester_id = user_a and addressee_id = user_b)
      or (requester_id = user_b and addressee_id = user_a))
  );
$$;

create or replace function public.can_see_round(rid uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cloud_rounds
    where id = rid
    and (created_by = auth.uid() or public.are_friends(auth.uid(), created_by))
  );
$$;

create or replace function public.merge_player_score(
  p_round_id uuid,
  p_user_id uuid,
  p_hole_index int,
  p_score int
) returns void
language sql
set search_path = ''
as $$
  update public.round_participants
  set scores = jsonb_set(
    coalesce(scores, '[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]'::jsonb),
    array[p_hole_index::text],
    to_jsonb(p_score)
  )
  where round_id = p_round_id and user_id = p_user_id;
$$;

revoke execute on function public.are_friends(uuid, uuid) from anon;
revoke execute on function public.can_see_round(uuid) from anon;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
