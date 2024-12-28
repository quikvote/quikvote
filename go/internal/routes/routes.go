package routes

import (
	"net/http"

	"quikvote/internal/auth"
	"quikvote/internal/handlers"
)

func SetupRoutes(r *http.ServeMux) {
	// pages
	r.HandleFunc("GET /{$}", handlers.HomePageHandler)
	r.HandleFunc("GET /new", handlers.NewPageHandler)
	r.HandleFunc("GET /join", handlers.JoinPageHandler)
	r.HandleFunc("GET /vote", handlers.VotePageHandler)
	r.HandleFunc("GET /results", handlers.ResultsPageHandler)

	r.HandleFunc("POST /api/register", handlers.RegisterHandler)
	r.HandleFunc("POST /api/login", handlers.LoginHandler)
	r.HandleFunc("DELETE /api/logout", handlers.LogoutHandler)
	r.HandleFunc("GET /api/me", auth.Middleware(handlers.GetUserHandler))

	// Secure routes (using middleware)
	r.HandleFunc("POST /api/room", auth.Middleware(handlers.CreateRoomHandler))
	r.HandleFunc("GET /api/room/{id}", auth.Middleware(handlers.GetRoomHandler))
	r.HandleFunc("POST /api/room/{code}/join", auth.Middleware(handlers.JoinRoomHandler))
	r.HandleFunc("POST /api/room/{id}/options", auth.Middleware(handlers.AddOptionToRoomHandler))
	r.HandleFunc("POST /api/room/{id}/close", auth.Middleware(handlers.CloseRoomHandler))

	r.HandleFunc("/api/results/{id}", handlers.GetResultHandler)
	r.HandleFunc("/api/history", auth.Middleware(handlers.GetHistoryHandler))

	// r.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	// 	http.ServeFile(w, r, "public/index.html")
	// })
}
