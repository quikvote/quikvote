package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"quikvote/internal/database"
)

func GetResultHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	resultsID := r.PathValue("id")

	result, err := database.GetResult(ctx, resultsID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if result == nil {
		http.Error(w, fmt.Sprintf("Result %s does not exist", resultsID), http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"results": result.SortedOptions})
}
