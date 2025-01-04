package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type User struct {
	Username string `bson:"username"`
	Password []byte `bson:"password"`
	Token    string `bson:"token"`
}

type Result struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Owner         string             `bson:"owner" json:"owner"`
	SortedOptions []string           `bson:"sortedOptions" json:"sortedOptions"`
	Timestamp     int64              `bson:"timestamp" json:"timestamp"`
}
