CREATE TABLE IF NOT EXISTS public.player_stats (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  handicap NUMERIC(4,1),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_stats_select" ON public.player_stats
  FOR SELECT USING (true);

CREATE POLICY "player_stats_insert_own" ON public.player_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "player_stats_update_own" ON public.player_stats
  FOR UPDATE USING (auth.uid() = user_id);
