package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type User struct {
	Username string `bson:"username"`
	Password []byte `bson:"password"`
	Token    string `bson:"token"`
}

type Result struct {
	ID            primitive.ObjectID `bson:"_id,omitempty"`
	Owner         string             `bson:"owner"`
	SortedOptions []string           `bson:"sortedOptions"`
	Timestamp     int64              `bson:"timestamp"`
}

type Room struct {
	ID           primitive.ObjectID `bson:"_id,omitempty"`
	Code         string             `bson:"code"`
	Owner        string             `bson:"owner"`
	Participants []string           `bson:"participants"`
	Options      []string           `bson:"options"`
	Votes        []Vote             `bson:"votes"`
	State        string             `bson:"state"`
}

type Vote struct {
	Username string   `bson:"username"`
	Votes    []string `bson:"votes"`
}
