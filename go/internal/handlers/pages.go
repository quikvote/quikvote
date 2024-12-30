package handlers

import (
	"html/template"
	"net/http"
	"path/filepath"
	"quikvote/internal/auth"
	"quikvote/internal/database"
	"quikvote/internal/models"
)

var templateDir = "templates"

type PageData struct {
	Title string
	IsHX  bool
	Data  interface{}
}

func isHTMX(r *http.Request) bool {
	return r.Header.Get("HX-Request") != ""
}

func getPageTemplate(name string) *template.Template {
	return template.Must(template.ParseFiles(
		filepath.Join(templateDir, "base.html"),
		filepath.Join(templateDir, "pages", name),
	))
}

func sendLayoutResponse(w http.ResponseWriter, r *http.Request, template *template.Template, data PageData) {
	if isHTMX(r) {
		data.IsHX = true
		template.ExecuteTemplate(w, "header", data)
		template.ExecuteTemplate(w, "main", data.Data)
	} else {
		data.IsHX = false
		template.ExecuteTemplate(w, "base.html", data)
	}
}

func HomePageHandler(w http.ResponseWriter, r *http.Request) {
	template := getPageTemplate("home.html")

	data := PageData{
		Title: "Home",
		Data: struct {
			LoggedIn bool
		}{
			LoggedIn: true,
		},
	}

	sendLayoutResponse(w, r, template, data)
}

func NewPageHandler(w http.ResponseWriter, r *http.Request) {
	template := getPageTemplate("new.html")

	room, err := database.CreateRoom(r.Context(), r.Context().Value(auth.UserCtx).(*models.User).Username)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	data := PageData{
		Title: "New Quikvote",
		Data: struct {
			RoomCode string
			RoomUrl  string
			IconUrl  string
			Room     models.Room
		}{
			RoomUrl: "/vote?room=" + room.ID.Hex(),
			IconUrl: "https://api.dicebear.com/9.x/icons/svg?seed=" + room.Code,
			Room:    *room,
		},
	}

	sendLayoutResponse(w, r, template, data)
}

func JoinPageHandler(w http.ResponseWriter, r *http.Request) {
	template := getPageTemplate("join.html")

	roomCode := ""

	data := PageData{
		Title: "Join Quikvote",
		Data: struct {
			RoomCode  string
			RoomUrl   string
			IconUrl   string
			MaxLength int
		}{
			RoomCode:  roomCode,
			MaxLength: 4,
			RoomUrl:   "/vote",
			IconUrl:   "https://api.dicebear.com/9.x/icons/svg?seed=" + roomCode,
		},
	}

	sendLayoutResponse(w, r, template, data)
}

type VoteOption struct {
	Key              string
	Name             string
	Value            int
	IncreaseDisabled bool
	DecreaseDisabled bool
}

func VotePageHandler(w http.ResponseWriter, r *http.Request) {
	template := getPageTemplate("vote.html")

	roomId := r.URL.Query().Get("room")
	if roomId == "" {
		http.Error(w, "Must include room query parameter", http.StatusBadRequest)
		return
	}

	room, err := database.GetRoomById(r.Context(), roomId)
	if err != nil {
		http.Error(w, "Room does not exist", http.StatusBadRequest)
		return
	}

	user, ok := r.Context().Value(auth.UserCtx).(*models.User)
	if !ok {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	isParticipant := false
	for _, username := range room.Participants {
		if username == user.Username {
			isParticipant = true
			break
		}
	}
	if !isParticipant {
		http.Error(w, "You must join this room first before voting", http.StatusBadRequest)
		return
	}

	data := struct {
		Room     *models.Room
		RoomID   string
		Options  []VoteOption
		Disabled bool
	}{
		Room:   room,
		RoomID: roomId,
	}

	for _, username := range room.LockedInUsers {
		if username == user.Username {
			data.Disabled = true
		}
	}

	var uservotes map[string]int
	for _, v := range room.Votes {
		if v.Username == user.Username {
			uservotes = v.Votes
			break
		}
	}
	if uservotes == nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	MAX_VAL := 10
	MIN_VAL := 0
	data.Options = make([]VoteOption, len(room.Options))
	for i, opt := range room.Options {
		val := uservotes[opt]
		data.Options[i] = VoteOption{

			Name:             opt,
			Value:            val,
			IncreaseDisabled: data.Disabled || val == MAX_VAL,
			DecreaseDisabled: data.Disabled || val == MIN_VAL,
		}
	}

	pageData := PageData{
		Title: "QuikVote",
		Data:  data,
	}

	sendLayoutResponse(w, r, template, pageData)
}

type VoteResult struct {
	Name  string
	Value int
}

func ResultsPageHandler(w http.ResponseWriter, r *http.Request) {
	template := getPageTemplate("results.html")

	data := PageData{
		Title: "Results",
		Data: struct {
			Results []VoteResult
		}{
			Results: []VoteResult{
				{
					Name:  "one",
					Value: 21,
				},
				{
					Name:  "two",
					Value: 21,
				},
			},
		},
	}

	sendLayoutResponse(w, r, template, data)
}
