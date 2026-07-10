create table if not exists einding.vocab_game_rounds (
  id uuid primary key default gen_random_uuid(),
  score integer not null,
  played_at timestamptz not null default now()
);

create index if not exists vocab_game_rounds_score_idx on einding.vocab_game_rounds (score desc);
