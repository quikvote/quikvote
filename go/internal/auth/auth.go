package auth

import (
	"context"
	"net/http"
	"quikvote/internal/database"
	"quikvote/internal/models"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const authCookieName = "token"

func Middleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := getUserFromRequest(r)
		if err != nil || user == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), "user", user)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

func getUserFromRequest(r *http.Request) (*models.User, error) {
	c, err := r.Cookie("token")
	if err != nil {
		return nil, err
	}
	user, err := database.GetUserByToken(r.Context(), c.Value)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func SetAuthCookie(w http.ResponseWriter, authToken string) {
	cookie := &http.Cookie{
		Name:     authCookieName,
		Value:    authToken,
		Secure:   true, // Set to true in production (HTTPS)
		HttpOnly: true, // Prevents client-side JavaScript access
		SameSite: http.SameSiteStrictMode,
		Expires:  time.Now().Add(12 * time.Hour),
	}
	http.SetCookie(w, cookie)
}

func ClearAuthCookie(w http.ResponseWriter) {
	cookie := &http.Cookie{
		Name:     authCookieName,
		Value:    "",
		Expires:  time.Unix(0, 0), // Expire the cookie immediately
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, cookie)
}

func ComparePasswords(hashedPwd []byte, plainPwd []byte) bool {
	err := bcrypt.CompareHashAndPassword(hashedPwd, plainPwd)
	if err != nil {
		return false
	}
	return true
}
