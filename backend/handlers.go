package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type task struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	TotalSeconds int64     `json:"totalSeconds"`
	CreatedAt    time.Time `json:"createdAt"`
}

type session struct {
	ID              string    `json:"id"`
	TaskID          string    `json:"taskId"`
	StartedAt       time.Time `json:"startedAt"`
	EndedAt         time.Time `json:"endedAt"`
	DurationSeconds int64     `json:"durationSeconds"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// Postgres error codes worth translating into client errors instead of 500s.
const (
	pgInvalidTextRepresentation = "22P02" // e.g. malformed uuid in the path
	pgForeignKeyViolation       = "23503"
)

func pgErrorCode(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}

func (s *server) handleListTasks(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := s.db.pool.Query(ctx,
		`select id, name, total_seconds, created_at from einding.tasks order by created_at asc`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}
	defer rows.Close()

	tasks := []task{}
	for rows.Next() {
		var t task
		if err := rows.Scan(&t.ID, &t.Name, &t.TotalSeconds, &t.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read tasks")
			return
		}
		tasks = append(tasks, t)
	}

	writeJSON(w, http.StatusOK, tasks)
}

func (s *server) handleCreateTask(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	if body.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if len(body.Name) > 200 {
		writeError(w, http.StatusBadRequest, "name too long (max 200 characters)")
		return
	}

	var t task
	err := s.db.pool.QueryRow(r.Context(),
		`insert into einding.tasks (name) values ($1)
		 returning id, name, total_seconds, created_at`,
		body.Name,
	).Scan(&t.ID, &t.Name, &t.TotalSeconds, &t.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create task")
		return
	}

	writeJSON(w, http.StatusCreated, t)
}

func (s *server) handleDeleteTask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	tag, err := s.db.pool.Exec(r.Context(), `delete from einding.tasks where id = $1`, id)
	if err != nil {
		if pgErrorCode(err) == pgInvalidTextRepresentation {
			writeError(w, http.StatusBadRequest, "invalid task id")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to delete task")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *server) handleCreateSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body struct {
		StartedAt       time.Time `json:"startedAt"`
		EndedAt         time.Time `json:"endedAt"`
		DurationSeconds int64     `json:"durationSeconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.DurationSeconds <= 0 {
		writeError(w, http.StatusBadRequest, "durationSeconds must be positive")
		return
	}
	if body.StartedAt.IsZero() || body.EndedAt.IsZero() || body.EndedAt.Before(body.StartedAt) {
		writeError(w, http.StatusBadRequest, "startedAt and endedAt must be a valid interval")
		return
	}

	ctx := r.Context()
	tx, err := s.db.pool.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(ctx)

	var sess session
	err = tx.QueryRow(ctx,
		`insert into einding.sessions (task_id, started_at, ended_at, duration_seconds)
		 values ($1, $2, $3, $4)
		 returning id, task_id, started_at, ended_at, duration_seconds`,
		id, body.StartedAt, body.EndedAt, body.DurationSeconds,
	).Scan(&sess.ID, &sess.TaskID, &sess.StartedAt, &sess.EndedAt, &sess.DurationSeconds)
	if err != nil {
		switch pgErrorCode(err) {
		case pgForeignKeyViolation:
			writeError(w, http.StatusNotFound, "task not found")
		case pgInvalidTextRepresentation:
			writeError(w, http.StatusBadRequest, "invalid task id")
		default:
			writeError(w, http.StatusInternalServerError, "failed to log session")
		}
		return
	}

	var t task
	err = tx.QueryRow(ctx,
		`update einding.tasks set total_seconds = total_seconds + $1
		 where id = $2
		 returning id, name, total_seconds, created_at`,
		body.DurationSeconds, id,
	).Scan(&t.ID, &t.Name, &t.TotalSeconds, &t.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			writeError(w, http.StatusNotFound, "task not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to update task total")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to commit session")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"session": sess,
		"task":    t,
	})
}
