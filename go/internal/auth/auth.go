package auth

import (
	"context"
	"net/http"
	"quikvote/internal/database"
	"quikvote/internal/models"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const authCookieName = "token"

type ctxKey string

const UserCtx = ctxKey("user")

func Middleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := GetUserFromRequest(r)
		if err != nil || user == nil {
			if err == http.ErrNoCookie {
				SetAuthCookie(w, user.Token)
			} else {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
		}
		ctx := context.WithValue(r.Context(), UserCtx, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

func newAnonUser(token string) *models.User {
	if token == "" {
		token = uuid.New().String()
	}
	return &models.User{
		Username: token,
		Token:    token,
	}
}

func GetUserFromRequest(r *http.Request) (*models.User, error) {
	c, err := r.Cookie(authCookieName)
	if err != nil {
		if err == http.ErrNoCookie {
			user := newAnonUser("")
			return user, err
		}
		return nil, err
	}
	user, err := database.GetUserByToken(r.Context(), c.Value)
	if err != nil {
		return nil, err
	}
	if user == nil {
		user = newAnonUser(c.Value)
	}
	return user, nil
}

func GetUserFromToken(ctx context.Context, token string) (*models.User, error) {
	user, err := database.GetUserByToken(ctx, token)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func SetAuthCookie(w http.ResponseWriter, authToken string) {
	cookie := &http.Cookie{
		Name:     authCookieName,
		Value:    authToken,
		Secure:   true, // TODO: Set to true in production (HTTPS)
		HttpOnly: true, // Prevents client-side JavaScript access
		SameSite: http.SameSiteStrictMode,
		Expires:  time.Now().Add(12 * time.Hour),
		Path:     "/",
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

func ComparePasswords(hashedPwd []byte, plainPwd string) bool {
	err := bcrypt.CompareHashAndPassword(hashedPwd, []byte(plainPwd))
	if err != nil {
		return false
	}
	return true
}
