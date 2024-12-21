package handlers

import (
	"encoding/json"
	"net/http"

	"quikvote/internal/database"
	"quikvote/internal/models"
)

func GetHistoryHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := ctx.Value("user").(*models.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	history, err := database.GetHistory(ctx, user.Username)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"history": history})
}
