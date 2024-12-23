package websocket

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sort"

	"quikvote/internal/auth"
	"quikvote/internal/database"
	"quikvote/internal/models"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // Allow all origins (for development)
}

// Handler handles incoming WebSocket requests
func Handler(w http.ResponseWriter, r *http.Request) {
	// ctx := r.Context()
	ctx := context.TODO()
	user, err := auth.GetUserFromRequest(r)
	if err != nil || user == nil {
		log.Println(err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	// defer conn.Close()

	connection := &Connection{
		ID:    generateUUID(),
		User:  user.Username,
		WS:    conn,
		Alive: true,
	}
	connections[connection.ID] = connection

	go handleConnection(ctx, connection)
}

// Connection represents a WebSocket connection with a user
type Connection struct {
	ID    string
	User  string
	WS    *websocket.Conn
	Alive bool
}

var connections = make(map[string]*Connection)

func handleConnection(ctx context.Context, connection *Connection) {
	defer func() {
		delete(connections, connection.ID)
		connection.WS.Close()
	}()

	for {
		messageType, message, err := connection.WS.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseAbnormalClosure) {
				log.Printf("connection %s closed abruptly: %v\n", connection.ID, err)
			} else {
				log.Printf("connection %s error: %v\n", connection.ID, err)
			}
			break
		}

		if messageType == websocket.TextMessage {
			var event map[string]interface{}
			err := json.Unmarshal(message, &event)
			if err != nil {
				log.Printf("connection %s: error parsing message: %v\n", connection.ID, err)
				continue
			}

			handleEvent(ctx, connection, message)
		}
	}
}

func handleEvent(ctx context.Context, connection *Connection, message []byte) {
	var event map[string]interface{}
	err := json.Unmarshal(message, &event)
	if err != nil {
		log.Printf("connection %s: error parsing message: %v\n", connection.ID, err)
		return
	}

	eventType, ok := event["type"].(string)
	if !ok {
		log.Printf("connection %s: invalid event type\n", connection.ID)
		return
	}

	switch eventType {
	case "new_option":
		handleNewOption(ctx, connection, event)
	case "lock_in":
		handleLockIn(ctx, connection, message)
	case "close_room":
		handleCloseRoom(ctx, connection, event)
	default:
		log.Printf("connection %s: unknown event type: %s\n", connection.ID, eventType)
	}
}

func handleNewOption(ctx context.Context, connection *Connection, event map[string]interface{}) {
	roomId, ok := event["room"].(string)
	if !ok {
		log.Printf("connection %s: invalid room id\n", connection.ID)
		return
	}
	option, ok := event["option"].(string)
	if !ok {
		log.Printf("connection %s: invalid option\n", connection.ID)
		return
	}

	room, err := database.GetRoomById(ctx, roomId)
	if err != nil {
		log.Printf("connection %s: database error -- %v\n", connection.ID, err)
		return
	}
	if room == nil {
		log.Printf("connection %s: no room with id %s\n", connection.ID, roomId)
		return
	}
	if room.State != "open" {
		log.Printf("connection %s: room is closed\n", connection.ID)
		return
	}
	if !contains(room.Participants, connection.User) {
		log.Printf("connection %s: room does not include user %s\n", connection.ID, connection.User)
		return
	}
	if contains(room.Options, option) {
		log.Printf("connection %s: room already includes option\n", connection.ID)
		return
	}

	if ok, err := database.AddOptionToRoom(ctx, roomId, option); !ok || err != nil {
		log.Printf("connection %s: database error\n", connection.ID)
		return
	}

	room, err = database.GetRoomById(ctx, roomId)
	if err != nil {
		log.Printf("connection %s: database error\n", connection.ID)
		return
	}

	sendMessageToRoom(room, map[string]interface{}{"type": "options", "options": room.Options})
}

type LockInEvent struct {
	Type  string                 `json:"type"`
	Room  string                 `json:"room"`
	Votes map[string]interface{} `json:"votes"`
}

func handleLockIn(ctx context.Context, connection *Connection, message []byte) {
	var lockInEvent LockInEvent
	err := json.Unmarshal(message, &lockInEvent)
	if err != nil {
		log.Printf("connection %s: error parsing message: %v\n", connection.ID, err)
		return
	}
	stringVotes := make(map[string]int, 0)
	for vote, value := range lockInEvent.Votes {
		if floatValue, ok := value.(float64); ok {
			intValue := int(floatValue)
			stringVotes[vote] = intValue
		} else {
			log.Printf("connection %s: invalid vote value for %s: %v\n", connection.ID, vote, value)
			return
		}
	}

	roomId := lockInEvent.Room

	room, err := database.GetRoomById(ctx, roomId)
	if err != nil {
		log.Printf("connection %s: database error\n", connection.ID)
		return
	}
	if room == nil {
		log.Printf("connection %s: no room with id %s\n", connection.ID, roomId)
		return
	}

	if room.State != "open" {
		log.Printf("connection %s: room is closed\n", connection.ID)
		return
	}

	if !contains(room.Participants, connection.User) {
		log.Printf("connection %s: room does not include user %s\n", connection.ID, connection.User)
		return
	}

	_, err = database.SubmitUserVotes(ctx, roomId, connection.User, stringVotes)
	if err != nil {
		log.Printf("connection %s: database error\n", connection.ID)
		return
	}

	new_room, err := database.GetRoomById(ctx, roomId)
	if err != nil {
		log.Printf("connection %s: database error\n", connection.ID)
		return
	}
	if len(new_room.Votes) == len(new_room.Participants) {
		// all users have voted
		_, err = database.CloseRoom(ctx, roomId)
		if err != nil {
			log.Printf("connection %s: database error\n", connection.ID)
			return
		}
		// Tally up the votes
		voteCounts := make(map[string]int, 0)
		for _, option := range room.Options {
			voteCounts[option] = 0
		}
		for _, voter := range new_room.Votes {
			for vote, count := range voter.Votes {
				voteCounts[vote] += count
			}
		}

		// Convert voteCounts to a sortable slice of structs
		type kv struct {
			Key   string
			Value int
		}
		var ss []kv
		for k, v := range voteCounts {
			ss = append(ss, kv{k, v})
		}

		// Sort the slice by Value (descending) and then by Key (ascending)
		sort.SliceStable(ss, func(i, j int) bool {
			if ss[i].Value != ss[j].Value {
				return ss[i].Value > ss[j].Value // Descending by value
			}
			return ss[i].Key < ss[j].Key // Ascending by key (if values are equal)
		})

		// Extract the sorted options
		sortedOptions := make([]string, len(ss))
		for i, kv := range ss {
			sortedOptions[i] = kv.Key
		}
		result, err := database.CreateResult(ctx, connection.User, sortedOptions)
		if err != nil {
			log.Printf("connection %s: database error\n", connection.ID)
			return
		}
		sendMessageToRoom(new_room, map[string]interface{}{"type": "results-available", "id": result.ID.Hex()})
	}
}

func handleCloseRoom(ctx context.Context, connection *Connection, event map[string]interface{}) {
	roomId, ok := event["room"].(string)
	if !ok {
		log.Printf("connection %s: invalid room id\n", connection.ID)
		return
	}

	room, err := database.GetRoomById(ctx, roomId)
	if err != nil {
		log.Printf("connection %s: database error\n", connection.ID)
		return
	}
	if room == nil {
		log.Printf("connection %s: no room with id %s\n", connection.ID, roomId)
		return
	}

	if room.State != "open" {
		log.Printf("connection %s: room is closed\n", connection.ID)
		return
	}

	if room.Owner != connection.User {
		log.Printf("connection %s: user is not owner of room\n", connection.ID)
		return
	}

	_, err = database.CloseRoom(ctx, roomId)
	if err != nil {
		log.Printf("connection %s: database error\n", connection.ID)
		return
	}

	// placeholder
	sortedOptions := []string{}
	result, err := database.CreateResult(ctx, connection.User, sortedOptions)
	if err != nil {
		log.Printf("connection %s: database error\n", connection.ID)
		return
	}
	sendMessageToRoom(room, map[string]interface{}{"type": "results-available", "id": result.ID.Hex()})
}

func sendMessageToRoom(room *models.Room, message map[string]interface{}) {
	messageJson, _ := json.Marshal(message)
	for _, c := range connections {
		if contains(room.Participants, c.User) {
			c.WS.WriteMessage(websocket.TextMessage, messageJson)
		}
	}
}

func generateUUID() string {
	return uuid.New().String()
}

func contains(s []string, str string) bool {
	for _, v := range s {
		if v == str {
			return true
		}
	}
	return false
}
