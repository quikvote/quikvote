package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type Room struct {
	ID           primitive.ObjectID `bson:"_id,omitempty"`
	Code         string             `bson:"code"`
	Owner        string             `bson:"owner"`
	Participants []UserVote         `bson:"participants"`
	Options      []string           `bson:"options"`
	State        string             `bson:"state"`
	Timestamp    int64              `bson:"timestamp" json:"timestamp"`
}

type UserVote struct {
	Username string         `bson:"username"`
	LockedIn bool           `bson:"lockedIn"`
	Votes    map[string]int `bson:"votes"`
}

func (r *Room) IncludesUser(username string) bool {
	for _, u := range r.Participants {
		if u.Username == username {
			return true
		}
	}
	return false
}

func (r *Room) GetUserVote(username string) *UserVote {
	for _, u := range r.Participants {
		if u.Username == username {
			return &u
		}
	}
	return nil
}

func (r *Room) IsLockedIn(username string) bool {
	userVote := r.GetUserVote(username)
	return userVote == nil || userVote.LockedIn
}
