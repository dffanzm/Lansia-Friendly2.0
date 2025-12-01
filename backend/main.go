package main

import (
	"lansia-backend/handlers"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

func main() {
	// Create router
	r := mux.NewRouter()

	// API Routes
	r.HandleFunc("/api/tts", handlers.TextToSpeechHandler).Methods("POST")
	r.HandleFunc("/api/health", handlers.HealthCheck).Methods("GET")
	r.HandleFunc("/api/voices", handlers.GetVoicesHandler).Methods("GET")
	r.HandleFunc("/api/config", handlers.GetConfigHandler).Methods("GET")

	// CORS configuration for Chrome Extension
	c := cors.New(cors.Options{
		AllowedOrigins: []string{
			"chrome-extension://*",     // Chrome extensions
			"moz-extension://*",        // Firefox extensions
			"http://localhost:*",       // Local development
			"http://127.0.0.1:*",
		},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge: 300,
	})

	// Create server with timeout settings
	server := &http.Server{
		Handler:      c.Handler(r),
		Addr:         ":8080",
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Println("🚀 Lansia Friendly Backend starting on :8080")
	log.Println("📌 Endpoints:")
	log.Println("   POST /api/tts     - Text to Speech")
	log.Println("   GET  /api/health  - Health Check")
	log.Println("   GET  /api/voices  - Available Voices")
	log.Println("   GET  /api/config  - Extension Configuration")

	if err := server.ListenAndServe(); err != nil {
		log.Fatal("Server failed:", err)
	}
}