-- Allow any participant to update any player's scores in a round they belong to.
-- Previously only the participant themselves or the round creator could update,
-- which blocked a joiner from entering scores for other players.

drop policy if exists "participants_update" on public.round_participants;

create policy "participants_update" on public.round_participants
  for update
  using (
    exists (
      select 1 from public.cloud_rounds
      where id = round_id and (
        created_by = auth.uid()
        or exists (
          select 1 from public.round_participants rp
          where rp.round_id = cloud_rounds.id and rp.user_id = auth.uid()
        )
      )
    )
  );