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
	Position     int64     `json:"position"`
	CreatedAt    time.Time `json:"createdAt"`
}

type session struct {
	ID              string    `json:"id"`
	TaskID          string    `json:"taskId"`
	StartedAt       time.Time `json:"startedAt"`
	EndedAt         time.Time `json:"endedAt"`
	DurationSeconds int64     `json:"durationSeconds"`
}

const taskColumns = `id, name, total_seconds, position, created_at`

func scanTask(row pgx.Row) (task, error) {
	var t task
	err := row.Scan(&t.ID, &t.Name, &t.TotalSeconds, &t.Position, &t.CreatedAt)
	return t, err
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

func validTaskName(w http.ResponseWriter, name string) (string, bool) {
	name = strings.TrimSpace(name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return "", false
	}
	if len(name) > 200 {
		writeError(w, http.StatusBadRequest, "name too long (max 200 characters)")
		return "", false
	}
	return name, true
}

func (s *server) handleListTasks(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.pool.Query(r.Context(),
		`select `+taskColumns+` from einding.tasks order by position asc, created_at asc`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}
	defer rows.Close()

	tasks := []task{}
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read tasks")
			return
		}
		tasks = append(tasks, t)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list tasks")
		return
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
	name, ok := validTaskName(w, body.Name)
	if !ok {
		return
	}

	t, err := scanTask(s.db.pool.QueryRow(r.Context(),
		`insert into einding.tasks (name, position)
		 values ($1, (select coalesce(max(position), 0) + 1 from einding.tasks))
		 returning `+taskColumns,
		name,
	))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create task")
		return
	}

	writeJSON(w, http.StatusCreated, t)
}

func (s *server) handleRenameTask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	name, ok := validTaskName(w, body.Name)
	if !ok {
		return
	}

	t, err := scanTask(s.db.pool.QueryRow(r.Context(),
		`update einding.tasks set name = $1 where id = $2 returning `+taskColumns,
		name, id,
	))
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			writeError(w, http.StatusNotFound, "task not found")
		case pgErrorCode(err) == pgInvalidTextRepresentation:
			writeError(w, http.StatusBadRequest, "invalid task id")
		default:
			writeError(w, http.StatusInternalServerError, "failed to rename task")
		}
		return
	}

	writeJSON(w, http.StatusOK, t)
}

func (s *server) handleReorderTasks(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(body.IDs) == 0 || len(body.IDs) > 1000 {
		writeError(w, http.StatusBadRequest, "ids must contain between 1 and 1000 entries")
		return
	}

	ctx := r.Context()
	tx, err := s.db.pool.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(ctx)

	for i, id := range body.IDs {
		if _, err := tx.Exec(ctx,
			`update einding.tasks set position = $1 where id = $2`, i+1, id,
		); err != nil {
			if pgErrorCode(err) == pgInvalidTextRepresentation {
				writeError(w, http.StatusBadRequest, "invalid task id in ids")
				return
			}
			writeError(w, http.StatusInternalServerError, "failed to reorder tasks")
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to commit reorder")
		return
	}

	w.WriteHeader(http.StatusNoContent)
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

func (s *server) handleListSessions(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	rows, err := s.db.pool.Query(r.Context(),
		`select id, task_id, started_at, ended_at, duration_seconds
		 from einding.sessions
		 where task_id = $1
		 order by started_at desc
		 limit 500`,
		id,
	)
	if err != nil {
		if pgErrorCode(err) == pgInvalidTextRepresentation {
			writeError(w, http.StatusBadRequest, "invalid task id")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to list sessions")
		return
	}
	defer rows.Close()

	sessions := []session{}
	for rows.Next() {
		var sess session
		if err := rows.Scan(&sess.ID, &sess.TaskID, &sess.StartedAt, &sess.EndedAt, &sess.DurationSeconds); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read sessions")
			return
		}
		sessions = append(sessions, sess)
	}
	if err := rows.Err(); err != nil {
		if pgErrorCode(err) == pgInvalidTextRepresentation {
			writeError(w, http.StatusBadRequest, "invalid task id")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to list sessions")
		return
	}

	writeJSON(w, http.StatusOK, sessions)
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

	t, err := scanTask(tx.QueryRow(ctx,
		`update einding.tasks set total_seconds = total_seconds + $1
		 where id = $2
		 returning `+taskColumns,
		body.DurationSeconds, id,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
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
