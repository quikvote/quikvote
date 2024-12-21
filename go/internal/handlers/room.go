package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"quikvote/internal/database"
	"quikvote/internal/models"
)

func CreateRoomHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := ctx.Value("user").(*models.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	newRoom, err := database.CreateRoom(ctx, user.Username)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": newRoom.ID.Hex(), "code": newRoom.Code})
}

func GetRoomHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := ctx.Value("user").(*models.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	roomId := r.PathValue("id")

	room, err := database.GetRoomById(ctx, roomId)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if room == nil {
		http.Error(w, fmt.Sprintf("Room %s does not exist", roomId), http.StatusNotFound)
		return
	}

	if room.State != "open" {
		http.Error(w, "Room is not open", http.StatusConflict)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"...room": room, "isOwner": room.Owner == user.Username})
}

func JoinRoomHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := ctx.Value("user").(*models.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	roomCode := r.PathValue("code")

	room, err := database.GetRoomByCode(ctx, roomCode)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if room == nil {
		http.Error(w, fmt.Sprintf("Room %s does not exist", roomCode), http.StatusNotFound)
		return
	}

	if room.State != "open" {
		http.Error(w, "Room is not open", http.StatusConflict)
		return
	}

	success, err := database.AddParticipantToRoom(ctx, roomCode, user.Username)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if success {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{"id": room.ID.Hex()})
	} else {
		http.Error(w, "Error adding participant", http.StatusInternalServerError)
	}
}

func AddOptionToRoomHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := ctx.Value("user").(*models.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	roomId := r.PathValue("id")

	var reqBody map[string]string
	err := json.NewDecoder(r.Body).Decode(&reqBody)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	option, ok := reqBody["option"]
	if !ok || option == "" {
		http.Error(w, "Missing option", http.StatusBadRequest)
		return
	}

	room, err := database.GetRoomById(ctx, roomId)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	if room == nil {
		http.Error(w, fmt.Sprintf("Room %s does not exist", roomId), http.StatusNotFound)
		return
	}
	if room.State != "open" {
		http.Error(w, "Room is not open", http.StatusConflict)
		return
	}
	if !contains(room.Participants, user.Username) {
		http.Error(w, "User is not allowed to add options to room", http.StatusForbidden)
		return
	}
	if contains(room.Options, option) {
		http.Error(w, "Option already exists", http.StatusConflict)
		return
	}

	success, err := database.AddOptionToRoom(ctx, roomId, option)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if success {
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{"options": append(room.Options, option)})
		return
	}
	http.Error(w, "unknown server error", http.StatusInternalServerError)
}

func SubmitUserVotesHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := ctx.Value("user").(*models.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	roomId := r.PathValue("id")

	var reqBody map[string][]string
	err := json.NewDecoder(r.Body).Decode(&reqBody)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	votes, ok := reqBody["votes"]
	if !ok {
		http.Error(w, "Missing votes", http.StatusBadRequest)
		return
	}

	room, err := database.GetRoomById(ctx, roomId)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	if room == nil {
		http.Error(w, fmt.Sprintf("Room %s does not exist", roomId), http.StatusNotFound)
		return
	}
	if room.State != "open" {
		http.Error(w, "Room is not open", http.StatusConflict)
		return
	}
	if !contains(room.Participants, user.Username) {
		http.Error(w, "User is not allowed to participate in room", http.StatusForbidden)
		return
	}

	success, err := database.SubmitUserVotes(ctx, roomId, user.Username, votes)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if success {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{"resultsId": "", "isOwner": room.Owner == user.Username})
		return
	}
	http.Error(w, "unknown server error", http.StatusInternalServerError)
}

func CloseRoomHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := ctx.Value("user").(*models.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	roomId := r.PathValue("id")

	room, err := database.GetRoomById(ctx, roomId)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	if room == nil {
		http.Error(w, fmt.Sprintf("Room %s does not exist", roomId), http.StatusNotFound)
		return
	}

	isOwner := room.Owner == user.Username

	if !isOwner {
		http.Error(w, "User is not owner of room", http.StatusForbidden)
		return
	}

	if room.State != "open" {
		http.Error(w, "Room is not open", http.StatusConflict)
		return
	}

	success, err := database.CloseRoom(ctx, roomId)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	if !success {
		http.Error(w, "Failed to close room", http.StatusInternalServerError)
		return
	}

	// placeholder
	sortedOptions := []string{}
	result, err := database.CreateResult(ctx, user.Username, sortedOptions)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"resultsId": result.ID.Hex()})
}

func contains(s []string, str string) bool {
	for _, v := range s {
		if v == str {
			return true
		}
	}

	return false
}
