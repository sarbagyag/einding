package main

import (
	"encoding/json"
	"net/http"
)

func (s *server) handleGetVocabHighScore(w http.ResponseWriter, r *http.Request) {
	var highScore int
	err := s.db.pool.QueryRow(r.Context(),
		`select coalesce(max(score), 0) from einding.vocab_game_rounds`,
	).Scan(&highScore)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load high score")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"highScore": highScore})
}

func (s *server) handleRecordVocabGameRound(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Score int `json:"score"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Score < 0 {
		writeError(w, http.StatusBadRequest, "score must be zero or positive")
		return
	}

	ctx := r.Context()
	tx, err := s.db.pool.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`insert into einding.vocab_game_rounds (score) values ($1)`, body.Score,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to record round")
		return
	}

	var highScore int
	if err := tx.QueryRow(ctx,
		`select coalesce(max(score), 0) from einding.vocab_game_rounds`,
	).Scan(&highScore); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load high score")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to commit round")
		return
	}

	writeJSON(w, http.StatusOK, map[string]int{"score": body.Score, "highScore": highScore})
}
