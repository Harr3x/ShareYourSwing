-- Fix rounds_select: allow participants to see active rounds (not just published)
-- Previously, non-creators could only SELECT rounds with status='published',
-- which broke "Live Runden" / join mode for invited players.

drop policy if exists "rounds_select" on public.cloud_rounds;

create policy "rounds_select" on public.cloud_rounds
  for select
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.round_participants
      where round_id = cloud_rounds.id and user_id = auth.uid()
    )
    or (
      status = 'published'
      and public.are_friends(auth.uid(), created_by)
    )
  );