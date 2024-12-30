package handlers

import (
	"net/http"
	"quikvote/internal/auth"
	"quikvote/internal/database"
	"quikvote/internal/models"
	"strconv"
)

func IncreaseVoteHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(auth.UserCtx).(*models.User)
	if !ok {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	roomID := r.PathValue("id")
	room, err := database.GetRoomById(r.Context(), roomID)
	if err != nil {
		http.Error(w, "Room does not exist", http.StatusBadRequest)
		return
	}

	option := r.PathValue("option")

	isParticipant := room.IncludesUser(user.Username)
	if !isParticipant {
		http.Error(w, "You must join this room first before voting", http.StatusBadRequest)
		return
	}

	uservotes := room.GetUserVote(user.Username)
	if uservotes == nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	optionExists := false
	for _, opt := range room.Options {
		if opt == option {
			optionExists = true
			break
		}
	}
	if !optionExists {
		http.Error(w, "Option does not exist", http.StatusBadRequest)
		return
	}

	uservotes.Votes[option] = uservotes.Votes[option] + 1
	w.Write([]byte(strconv.Itoa(uservotes.Votes[option])))
}
