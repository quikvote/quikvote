package database

import (
	"context"
	"fmt"
	"quikvote/internal/models"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

const usersCollection = "user"

func GetUser(ctx context.Context, username string) (*models.User, error) {
	col := db.Collection(usersCollection)
	result := col.FindOne(ctx, bson.M{"username": username})
	if err := result.Err(); err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find user: %w", err)
	}
	var user models.User
	if err := result.Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode user: %w", err)
	}
	return &user, nil
}

func GetUserByToken(ctx context.Context, token string) (*models.User, error) {
	col := db.Collection(usersCollection)
	result := col.FindOne(ctx, bson.M{"token": token})
	if err := result.Err(); err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find user by token: %w", err)
	}
	var user models.User
	if err := result.Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode user: %w", err)
	}
	return &user, nil
}

func CreateUser(ctx context.Context, username, password string) (*models.User, error) {
	col := db.Collection(usersCollection)
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := models.User{
		Username: username,
		Password: hashedPassword,
		Token:    uuid.New().String(),
	}
	_, err = col.InsertOne(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}
	return &user, nil
}
