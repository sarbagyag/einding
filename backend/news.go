package main

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"
)

var validNewsCategories = map[string]bool{"global": true, "nepali": true}

// Keep only the newest N digests per category so the table can't grow
// unbounded from twice-daily (or on-demand) refreshes.
const newsRetentionPerCategory = 20

type newsItem struct {
	ID        string    `json:"id"`
	Category  string    `json:"category"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"createdAt"`
}

func (s *server) handleIngestNews(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Category string `json:"category"`
		Message  string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if !validNewsCategories[body.Category] {
		writeError(w, http.StatusBadRequest, `category must be "global" or "nepali"`)
		return
	}
	if body.Message == "" {
		writeError(w, http.StatusBadRequest, "message is required")
		return
	}

	ctx := r.Context()
	tx, err := s.db.pool.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(ctx)

	var item newsItem
	err = tx.QueryRow(ctx,
		`insert into einding.news_items (category, message)
		 values ($1, $2)
		 returning id, category, message, created_at`,
		body.Category, body.Message,
	).Scan(&item.ID, &item.Category, &item.Message, &item.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save news item")
		return
	}

	if _, err := tx.Exec(ctx,
		`delete from einding.news_items
		 where category = $1
		   and id not in (
		     select id from einding.news_items
		     where category = $1
		     order by created_at desc
		     limit $2
		   )`,
		body.Category, newsRetentionPerCategory,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to prune old news items")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to commit news item")
		return
	}

	writeJSON(w, http.StatusCreated, item)
}

// handleRefreshNews triggers the matching n8n workflow on demand (the
// Webhook node added alongside the Schedule Trigger / Telegram /news
// command). The workflow itself can take several minutes (RSS reads across
// several feeds plus an LLM summarization) and writes the finished digest to
// Postgres itself, via the same HTTP Request node that already POSTs to
// handleIngestNews — so rather than hold the client's request open for all
// of that, this handler fires the trigger in the background and reports
// back immediately. The client picks up the result by polling GET
// /api/news, same as it would for the scheduled runs.
func (s *server) handleRefreshNews(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Category string `json:"category"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if !validNewsCategories[body.Category] {
		writeError(w, http.StatusBadRequest, `category must be "global" or "nepali"`)
		return
	}

	webhookURL, ok := s.newsRefreshURLs[body.Category]
	if !ok {
		writeError(w, http.StatusNotImplemented, "on-demand refresh isn't configured for this category yet")
		return
	}

	category := body.Category
	go func() {
		req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, webhookURL, bytes.NewReader(nil))
		if err != nil {
			log.Printf("news refresh (%s): building request: %v", category, err)
			return
		}
		req.Header.Set("Authorization", "Bearer "+s.apiToken)
		req.Header.Set("Content-Type", "application/json")

		resp, err := s.httpClient.Do(req)
		if err != nil {
			log.Printf("news refresh (%s): %v", category, err)
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 300 {
			log.Printf("news refresh (%s): workflow responded with status %d", category, resp.StatusCode)
		}
	}()

	writeJSON(w, http.StatusAccepted, map[string]string{
		"category": category,
		"status":   "triggered",
	})
}

func (s *server) handleListNews(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	if !validNewsCategories[category] {
		writeError(w, http.StatusBadRequest, `category query param must be "global" or "nepali"`)
		return
	}

	rows, err := s.db.pool.Query(r.Context(),
		`select id, category, message, created_at
		 from einding.news_items
		 where category = $1
		 order by created_at desc
		 limit 20`,
		category,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list news")
		return
	}
	defer rows.Close()

	items := []newsItem{}
	for rows.Next() {
		var item newsItem
		if err := rows.Scan(&item.ID, &item.Category, &item.Message, &item.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read news")
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list news")
		return
	}

	writeJSON(w, http.StatusOK, items)
}
