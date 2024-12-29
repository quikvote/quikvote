package database

import (
	"context"
	"fmt"
	"math/rand"
	"quikvote/internal/models"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

const roomsCollection = "room"

func generateRandomRoomCode() string {
	const alpha = "ABCDEFGHJKMNPQRSTUVWXYZ"
	const numeric = "23456789"
	const alphanumeric = alpha + numeric

	code := make([]byte, 4)
	for i := 0; i < 4; i++ {
		code[i] = alphanumeric[rand.Intn(len(alphanumeric))]
	}
	return string(code)
}

func CreateRoom(ctx context.Context, creatorUsername string) (*models.Room, error) {
	col := db.Collection(roomsCollection)
	newRoom := models.Room{
		Code:         generateRandomRoomCode(),
		Owner:        creatorUsername,
		Participants: []string{creatorUsername},
		Options:      []string{},
		Votes: []models.Vote{
			{
				Username: creatorUsername,
				Votes:    make(map[string]int),
			},
		},
		State:     "open",
		Timestamp: time.Now().UnixMilli(),
	}
	result, err := col.InsertOne(ctx, newRoom)
	if err != nil {
		return nil, fmt.Errorf("failed to create room: %w", err)
	}
	newRoom.ID = result.InsertedID.(primitive.ObjectID)
	return &newRoom, nil
}

func GetRoomByCode(ctx context.Context, roomCode string) (*models.Room, error) {
	col := db.Collection(roomsCollection)
	var room models.Room
	err := col.FindOne(ctx, bson.M{"code": roomCode}).Decode(&room)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get room by code: %w", err)
	}
	return &room, nil
}

func GetRoomById(ctx context.Context, roomID string) (*models.Room, error) {
	col := db.Collection(roomsCollection)
	objID, err := primitive.ObjectIDFromHex(roomID)
	if err != nil {
		return nil, fmt.Errorf("invalid room ID: %w", err)
	}
	var room models.Room
	err = col.FindOne(ctx, bson.M{"_id": objID}).Decode(&room)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get room by id: %w", err)
	}
	return &room, nil
}

func AddParticipantToRoom(ctx context.Context, roomCode, username string) (bool, error) {
	col := db.Collection(roomsCollection)
	_, err := col.UpdateOne(ctx, bson.M{"code": roomCode, "state": "open"}, bson.M{"$addToSet": bson.M{"participants": username}})
	if err != nil {
		return false, fmt.Errorf("failed to add participant: %w", err)
	}
	return true, nil
}

func AddOptionToRoom(ctx context.Context, roomID, option string) (bool, error) {
	col := db.Collection(roomsCollection)
	objID, err := primitive.ObjectIDFromHex(roomID)
	if err != nil {
		return false, fmt.Errorf("invalid room ID: %w", err)
	}
	result, err := col.UpdateOne(ctx, bson.M{"_id": objID, "state": "open"}, bson.M{"$addToSet": bson.M{"options": option}})
	if err != nil {
		return false, fmt.Errorf("failed to add option: %w", err)
	}
	return result.ModifiedCount > 0, nil
}

func SubmitUserVotes(ctx context.Context, roomID, username string, votes map[string]int) (bool, error) {
	col := db.Collection(roomsCollection)
	objID, err := primitive.ObjectIDFromHex(roomID)
	if err != nil {
		return false, fmt.Errorf("invalid room ID: %w", err)
	}
	filter := bson.M{"_id": objID, "votes.username": bson.M{"$ne": username}}
	update := bson.M{"$push": bson.M{"votes": models.Vote{Username: username, Votes: votes}}}
	result, err := col.UpdateOne(ctx, filter, update)
	if err != nil {
		return false, fmt.Errorf("failed to submit votes: %w", err)
	}
	return result.ModifiedCount > 0, nil
}

func CloseRoom(ctx context.Context, roomID string) (bool, error) {
	col := db.Collection(roomsCollection)
	objID, err := primitive.ObjectIDFromHex(roomID)
	if err != nil {
		return false, fmt.Errorf("invalid room ID: %w", err)
	}
	result, err := col.UpdateOne(ctx, bson.M{"_id": objID}, bson.M{"$set": bson.M{"state": "closed"}})
	if err != nil {
		return false, fmt.Errorf("failed to close room: %w", err)
	}
	return result.ModifiedCount > 0, nil
}

func DeleteRoom(ctx context.Context, roomID string) (bool, error) {
	col := db.Collection(roomsCollection)
	objID, err := primitive.ObjectIDFromHex(roomID)
	if err != nil {
		return false, fmt.Errorf("invalid room ID: %w", err)
	}
	result, err := col.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		return false, fmt.Errorf("failed to delete room: %w", err)
	}
	return result.DeletedCount > 0, nil
}
