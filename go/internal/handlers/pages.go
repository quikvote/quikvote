package handlers

import (
	"html/template"
	"net/http"
	"path/filepath"
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

	roomCode := "HJKL"

	data := PageData{
		Title: "New Quikvote",
		Data: struct {
			RoomCode string
			RoomUrl  string
			IconUrl  string
		}{
			RoomCode: roomCode,
			RoomUrl:  "idk",
			IconUrl:  "https://api.dicebear.com/9.x/icons/svg?seed=" + roomCode,
		},
	}

	sendLayoutResponse(w, r, template, data)
}
