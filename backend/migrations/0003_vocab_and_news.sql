create table if not exists einding.vocab_cards (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  type text not null default '',
  english text not null,
  example_de text not null default '',
  example_en text not null default '',
  -- FSRS scheduling state (see github.com/open-spaced-repetition/go-fsrs)
  due timestamptz not null default now(),
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days bigint not null default 0,
  scheduled_days bigint not null default 0,
  reps bigint not null default 0,
  lapses bigint not null default 0,
  state smallint not null default 0,
  last_review timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists vocab_cards_word_lower_idx on einding.vocab_cards (lower(word));
create index if not exists vocab_cards_due_idx on einding.vocab_cards (due);

create table if not exists einding.vocab_reviews (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references einding.vocab_cards(id) on delete cascade,
  rating smallint not null,
  state smallint not null,
  elapsed_days bigint not null,
  scheduled_days bigint not null,
  reviewed_at timestamptz not null default now()
);

create index if not exists vocab_reviews_card_id_idx on einding.vocab_reviews (card_id);

create table if not exists einding.news_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('global', 'nepali')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists news_items_category_created_idx on einding.news_items (category, created_at desc);
