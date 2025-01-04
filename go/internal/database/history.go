package database

import (
	"context"
	"fmt"
	"quikvote/internal/models"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const historyCollection = "history"

func CreateResult(ctx context.Context, username string, sortedOptions []string) (*models.Result, error) {
	col := db.Collection(historyCollection)
	result := models.Result{
		Owner:         username,
		SortedOptions: sortedOptions,
		Timestamp:     time.Now().UnixMilli(),
	}
	insertResult, err := col.InsertOne(ctx, result)
	if err != nil {
		return nil, fmt.Errorf("failed to create result: %w", err)
	}
	result.ID = insertResult.InsertedID.(primitive.ObjectID)
	return &result, nil
}

func GetResult(ctx context.Context, resultID string) (*models.Result, error) {
	col := db.Collection(historyCollection)
	objID, err := primitive.ObjectIDFromHex(resultID)
	if err != nil {
		return nil, fmt.Errorf("invalid result ID: %w", err)
	}
	var result models.Result
	err = col.FindOne(ctx, bson.M{"_id": objID}).Decode(&result)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get result: %w", err)
	}
	return &result, nil
}

func GetHistory(ctx context.Context, username string) ([]models.Result, error) {
	col := db.Collection(historyCollection)
	opts := options.Find().SetSort(bson.D{{Key: "timestamp", Value: -1}})
	cursor, err := col.Find(ctx, bson.M{"owner": username}, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to get history: %w", err)
	}
	defer cursor.Close(ctx)

	var history []models.Result
	if err := cursor.All(ctx, &history); err != nil {
		return nil, fmt.Errorf("failed to decode history: %w", err)
	}
	return history, nil
}
