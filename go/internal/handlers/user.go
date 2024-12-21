package handlers

import (
	"encoding/json"
	"net/http"
	"quikvote/internal/auth"
	"quikvote/internal/database"
	"quikvote/internal/models"
)

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var user models.User
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if user.Username == "" {
		http.Error(w, "Missing username", http.StatusBadRequest)
		return
	}
	if len(user.Password) == 0 {
		http.Error(w, "Missing password", http.StatusBadRequest)
		return
	}

	existingUser, err := database.GetUser(ctx, user.Username)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	if existingUser != nil {
		http.Error(w, "Existing user", http.StatusConflict)
		return
	}

	createdUser, err := database.CreateUser(ctx, user.Username, string(user.Password))
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
	var user models.User
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if user.Username == "" {
		http.Error(w, "Missing username", http.StatusBadRequest)
		return
	}
	if len(user.Password) == 0 {
		http.Error(w, "Missing password", http.StatusBadRequest)
		return
	}

	existingUser, err := database.GetUser(ctx, user.Username)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if existingUser != nil && auth.ComparePasswords(existingUser.Password, user.Password) {
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
