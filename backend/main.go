package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

type server struct {
	db              *db
	apiToken        string
	staticDir       string
	newsRefreshURLs map[string]string
	httpClient      *http.Client
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	databaseURL := requireEnv("DATABASE_URL")
	apiToken := requireEnv("EINDING_API_TOKEN")
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "frontend/dist"
	}

	// Optional: only set once the matching n8n webhook exists for that
	// category. Missing here just means "refresh" 502s for that category
	// instead of failing the whole app at startup.
	newsRefreshURLs := map[string]string{}
	if url := os.Getenv("N8N_GLOBAL_NEWS_REFRESH_URL"); url != "" {
		newsRefreshURLs["global"] = url
	}
	if url := os.Getenv("N8N_NEPALI_NEWS_REFRESH_URL"); url != "" {
		newsRefreshURLs["nepali"] = url
	}

	pool, err := newPool(ctx, databaseURL)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()

	if err := runMigrations(ctx, pool); err != nil {
		log.Fatalf("running migrations: %v", err)
	}

	s := &server{
		db:              &db{pool: pool},
		apiToken:        apiToken,
		staticDir:       staticDir,
		newsRefreshURLs: newsRefreshURLs,
		// RSS reads across ~9 feeds plus an LLM summarization can genuinely
		// take several minutes. handleRefreshNews fires this in the
		// background and responds to the client immediately, so this only
		// needs to cap a stuck workflow rather than block anyone's request.
		httpClient: &http.Client{Timeout: 6 * time.Minute},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.Handle("GET /api/tasks", s.auth(http.HandlerFunc(s.handleListTasks)))
	mux.Handle("POST /api/tasks", s.auth(http.HandlerFunc(s.handleCreateTask)))
	mux.Handle("PUT /api/tasks/order", s.auth(http.HandlerFunc(s.handleReorderTasks)))
	mux.Handle("PATCH /api/tasks/{id}", s.auth(http.HandlerFunc(s.handleRenameTask)))
	mux.Handle("DELETE /api/tasks/{id}", s.auth(http.HandlerFunc(s.handleDeleteTask)))
	mux.Handle("GET /api/tasks/{id}/sessions", s.auth(http.HandlerFunc(s.handleListSessions)))
	mux.Handle("POST /api/tasks/{id}/sessions", s.auth(http.HandlerFunc(s.handleCreateSession)))
	mux.Handle("POST /api/vocab/words", s.auth(http.HandlerFunc(s.handleIngestVocabWords)))
	mux.Handle("GET /api/vocab/due", s.auth(http.HandlerFunc(s.handleListDueVocabCards)))
	mux.Handle("POST /api/vocab/cards/{id}/review", s.auth(http.HandlerFunc(s.handleReviewVocabCard)))
	mux.Handle("POST /api/news", s.auth(http.HandlerFunc(s.handleIngestNews)))
	mux.Handle("GET /api/news", s.auth(http.HandlerFunc(s.handleListNews)))
	mux.Handle("POST /api/news/refresh", s.auth(http.HandlerFunc(s.handleRefreshNews)))

	fileServer := http.FileServer(http.Dir(staticDir))
	mux.Handle("/", spaHandler(staticDir, fileServer))

	handler := logging(mux)

	httpServer := &http.Server{
		Addr:              ":" + port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("einding listening on :%s", port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}

func requireEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("missing required env var %s", key)
	}
	return v
}

func (s *server) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		token, ok := strings.CutPrefix(authHeader, "Bearer ")
		if !ok || token != s.apiToken {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

// spaHandler serves static files, falling back to index.html for unknown
// (non-file, non-/api) paths so client-side routing and PWA installs work.
func spaHandler(staticDir string, fileServer http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := staticDir + r.URL.Path
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, staticDir+"/index.html")
	})
}
