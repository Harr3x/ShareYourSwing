-- Secure RLS: tighten anon grants, add missing policies
-- 1. Revoke unnecessary anon grants
revoke all on table public.profiles           from anon;
revoke all on table public.cloud_rounds       from anon;
revoke all on table public.round_participants from anon;
revoke all on table public.courses            from anon;
revoke all on table public.friendships        from anon;
revoke all on table public.push_subscriptions from anon;

revoke all on function public.are_friends(uuid, uuid)   from anon;
revoke all on function public.can_see_round(uuid)       from anon;

-- 2. Add missing profiles_delete policy
create policy "profiles_delete" on public.profiles
  for delete using (auth.uid() = id);

-- 3. Improve rounds_select: non-creators see only published rounds
drop policy if exists "rounds_select" on public.cloud_rounds;
create policy "rounds_select" on public.cloud_rounds
  for select
  using (
    auth.uid() = created_by
    or (
      status = 'published'
      and (
        exists (
          select 1 from public.round_participants
          where round_id = cloud_rounds.id and user_id = auth.uid()
        )
        or public.are_friends(auth.uid(), created_by)
      )
    )
  );

-- 4. Improve participants_update: allow participant to update own scores too
drop policy if exists "participants_update" on public.round_participants;
create policy "participants_update" on public.round_participants
  for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.cloud_rounds
      where id = round_id and created_by = auth.uid()
    )
  );

-- 5. Add missing push_subscriptions delete policy
drop policy if exists "Users manage own subscriptions" on public.push_subscriptions;
create policy "push_subscriptions_manage" on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 6. Improve courses RLS: use auth check instead of subquery for perf
drop policy if exists "courses_insert" on public.courses;
drop policy if exists "courses_update" on public.courses;
drop policy if exists "courses_delete" on public.courses;
drop policy if exists "courses_select" on public.courses;

create policy "courses_select" on public.courses
  for select to authenticated using (true);

create policy "courses_insert" on public.courses
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "courses_update" on public.courses
  for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "courses_delete" on public.courses
  for delete to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );