package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	"quikvote/internal/database"
	"quikvote/internal/routes"
	"quikvote/internal/websocket"
)

func main() {
	ctx := context.Background()

	dbUrl := os.Getenv("MONGODB_URI")
	if dbUrl == "" {
		log.Fatal("must set MONGODB_URI")
	}
	err := database.Connect(ctx, dbUrl)
	if err != nil {
		log.Fatal(err)
	}
	defer database.Disconnect(ctx)

	r := http.NewServeMux()
	routes.SetupRoutes(r) // Set up the routes
	r.HandleFunc("/ws", websocket.Handler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}
	fmt.Printf("Server listening on :%s\n", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), r))
}
