package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	fsrs "github.com/open-spaced-repetition/go-fsrs/v3"
)

// One shared scheduler using FSRS's published default weights (trained on
// hundreds of millions of real Anki reviews) — the same algorithm modern
// Anki itself ships with.
var vocabScheduler = fsrs.NewFSRS(fsrs.DefaultParam())

type vocabCard struct {
	ID            string     `json:"id"`
	Word          string     `json:"word"`
	Type          string     `json:"type"`
	English       string     `json:"english"`
	ExampleDE     string     `json:"exampleDe"`
	ExampleEN     string     `json:"exampleEn"`
	Due           time.Time  `json:"due"`
	Stability     float64    `json:"stability"`
	Difficulty    float64    `json:"difficulty"`
	ElapsedDays   int64      `json:"elapsedDays"`
	ScheduledDays int64      `json:"scheduledDays"`
	Reps          int64      `json:"reps"`
	Lapses        int64      `json:"lapses"`
	State         int16      `json:"state"`
	LastReview    *time.Time `json:"lastReview"`
	CreatedAt     time.Time  `json:"createdAt"`
}

const vocabCardColumns = `id, word, type, english, example_de, example_en,
	due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review, created_at`

func scanVocabCard(row pgx.Row) (vocabCard, error) {
	var c vocabCard
	err := row.Scan(
		&c.ID, &c.Word, &c.Type, &c.English, &c.ExampleDE, &c.ExampleEN,
		&c.Due, &c.Stability, &c.Difficulty, &c.ElapsedDays, &c.ScheduledDays,
		&c.Reps, &c.Lapses, &c.State, &c.LastReview, &c.CreatedAt,
	)
	return c, err
}

func (c vocabCard) toFSRSCard() fsrs.Card {
	card := fsrs.Card{
		Due:           c.Due,
		Stability:     c.Stability,
		Difficulty:    c.Difficulty,
		ElapsedDays:   uint64(c.ElapsedDays),
		ScheduledDays: uint64(c.ScheduledDays),
		Reps:          uint64(c.Reps),
		Lapses:        uint64(c.Lapses),
		State:         fsrs.State(c.State),
	}
	if c.LastReview != nil {
		card.LastReview = *c.LastReview
	}
	return card
}

// n8n's German-words automation posts objects shaped exactly like this
// (see the "Format Message" / "Parse Claude Response" nodes) — matched
// field-for-field so no transform is needed on the n8n side.
type vocabWordInput struct {
	Word      string `json:"word"`
	Type      string `json:"type"`
	English   string `json:"english"`
	ExampleDE string `json:"example_de"`
	ExampleEN string `json:"example_en"`
}

func (s *server) handleIngestVocabWords(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Words []vocabWordInput `json:"words"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(body.Words) == 0 {
		writeError(w, http.StatusBadRequest, "words must contain at least one entry")
		return
	}
	if len(body.Words) > 100 {
		writeError(w, http.StatusBadRequest, "words must contain at most 100 entries")
		return
	}

	ctx := r.Context()
	created := []vocabCard{}
	skipped := []string{}

	for _, word := range body.Words {
		trimmed := strings.TrimSpace(word.Word)
		if trimmed == "" || word.English == "" {
			continue
		}

		card, err := scanVocabCard(s.db.pool.QueryRow(ctx,
			`insert into einding.vocab_cards (word, type, english, example_de, example_en)
			 values ($1, $2, $3, $4, $5)
			 on conflict ((lower(word))) do nothing
			 returning `+vocabCardColumns,
			trimmed, word.Type, word.English, word.ExampleDE, word.ExampleEN,
		))
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				skipped = append(skipped, trimmed)
				continue
			}
			writeError(w, http.StatusInternalServerError, "failed to save word: "+trimmed)
			return
		}
		created = append(created, card)
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"created": created,
		"skipped": skipped,
	})
}

func (s *server) handleListDueVocabCards(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.pool.Query(r.Context(),
		`select `+vocabCardColumns+`
		 from einding.vocab_cards
		 where due <= now()
		 order by due asc
		 limit 100`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list due cards")
		return
	}
	defer rows.Close()

	cards := []vocabCard{}
	for rows.Next() {
		c, err := scanVocabCard(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read cards")
			return
		}
		cards = append(cards, c)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list due cards")
		return
	}

	writeJSON(w, http.StatusOK, cards)
}

func (s *server) handleReviewVocabCard(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body struct {
		Rating int8 `json:"rating"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Rating < int8(fsrs.Again) || body.Rating > int8(fsrs.Easy) {
		writeError(w, http.StatusBadRequest, "rating must be 1 (Again), 2 (Hard), 3 (Good), or 4 (Easy)")
		return
	}

	ctx := r.Context()
	tx, err := s.db.pool.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(ctx)

	existing, err := scanVocabCard(tx.QueryRow(ctx,
		`select `+vocabCardColumns+` from einding.vocab_cards where id = $1 for update`,
		id,
	))
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			writeError(w, http.StatusNotFound, "card not found")
		case pgErrorCode(err) == pgInvalidTextRepresentation:
			writeError(w, http.StatusBadRequest, "invalid card id")
		default:
			writeError(w, http.StatusInternalServerError, "failed to load card")
		}
		return
	}

	now := time.Now()
	result := vocabScheduler.Next(existing.toFSRSCard(), now, fsrs.Rating(body.Rating))

	var lastReview *time.Time
	if !result.Card.LastReview.IsZero() {
		lastReview = &result.Card.LastReview
	}

	updated, err := scanVocabCard(tx.QueryRow(ctx,
		`update einding.vocab_cards set
		   due = $1, stability = $2, difficulty = $3, elapsed_days = $4,
		   scheduled_days = $5, reps = $6, lapses = $7, state = $8, last_review = $9
		 where id = $10
		 returning `+vocabCardColumns,
		result.Card.Due, result.Card.Stability, result.Card.Difficulty,
		int64(result.Card.ElapsedDays), int64(result.Card.ScheduledDays),
		int64(result.Card.Reps), int64(result.Card.Lapses), int16(result.Card.State),
		lastReview, id,
	))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update card")
		return
	}

	if _, err := tx.Exec(ctx,
		`insert into einding.vocab_reviews (card_id, rating, state, elapsed_days, scheduled_days)
		 values ($1, $2, $3, $4, $5)`,
		id, int16(result.ReviewLog.Rating), int16(result.ReviewLog.State),
		int64(result.ReviewLog.ElapsedDays), int64(result.ReviewLog.ScheduledDays),
	); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to log review")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to commit review")
		return
	}

	writeJSON(w, http.StatusOK, updated)
}
