package handlers

import (
	"encoding/json"
	"net/http"
	"quikvote/internal/auth"
	"quikvote/internal/database"
	"quikvote/internal/models"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var register_req LoginRequest
	err := json.NewDecoder(r.Body).Decode(&register_req)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if register_req.Username == "" {
		http.Error(w, "Missing username", http.StatusBadRequest)
		return
	}
	if len(register_req.Password) == 0 {
		http.Error(w, "Missing password", http.StatusBadRequest)
		return
	}

	existingUser, err := database.GetUser(ctx, register_req.Username)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	if existingUser != nil {
		http.Error(w, "Existing user", http.StatusConflict)
		return
	}

	createdUser, err := database.CreateUser(ctx, register_req.Username, string(register_req.Password))
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	auth.SetAuthCookie(w, createdUser.Token)

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"username": createdUser.Username})
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var login_req LoginRequest
	err := json.NewDecoder(r.Body).Decode(&login_req)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	existingUser, err := database.GetUser(ctx, login_req.Username)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if existingUser != nil && auth.ComparePasswords(existingUser.Password, login_req.Password) {
		auth.SetAuthCookie(w, existingUser.Token)
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"username": existingUser.Username})
	} else {
		http.Error(w, "Invalid username and/or password", http.StatusBadRequest)
	}
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	auth.ClearAuthCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func GetUserHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if user != nil {
		json.NewEncoder(w).Encode(map[string]string{"username": user.Username})
	} else {
		w.WriteHeader(http.StatusNoContent)
	}
}
