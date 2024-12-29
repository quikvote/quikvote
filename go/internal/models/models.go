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

type Room struct {
	ID            primitive.ObjectID `bson:"_id,omitempty"`
	Code          string             `bson:"code"`
	Owner         string             `bson:"owner"`
	Participants  []string           `bson:"participants"`
	Options       []string           `bson:"options"`
	Votes         []Vote             `bson:"votes"`
	LockedInUsers []string           `bson:"lockedInUsers"`
	State         string             `bson:"state"`
	Timestamp     int64              `bson:"timestamp" json:"timestamp"`
}

type Vote struct {
	Username string         `bson:"username"`
	Votes    map[string]int `bson:"votes"`
}
