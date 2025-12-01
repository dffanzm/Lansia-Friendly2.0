package main

import (
    "log"
    "net/http"
    "lansia-backend/handlers"
    "github.com/gorilla/mux"
    "github.com/rs/cors"
)

func main() {
    r := mux.NewRouter()
    
    // API Routes
    r.HandleFunc("/api/tts", handlers.TextToSpeechHandler).Methods("POST")
    r.HandleFunc("/api/tts/stop", handlers.StopSpeechHandler).Methods("POST")
    r.HandleFunc("/api/tts/voices", handlers.GetVoicesHandler).Methods("GET")
    r.HandleFunc("/api/health", handlers.HealthCheck).Methods("GET")
    
    // Static files (untuk audio jika menggunakan cloud TTS)
    r.PathPrefix("/audio/").Handler(http.StripPrefix("/audio/", 
        http.FileServer(http.Dir("./audio"))))
    
    // CORS configuration
    c := cors.New(cors.Options{
        AllowedOrigins:   []string{"chrome-extension://*", "http://localhost:*"},
        AllowedMethods:   []string{"POST", "GET", "OPTIONS", "DELETE"},
        AllowedHeaders:   []string{"Content-Type", "Authorization", "X-Client-ID"},
        AllowCredentials: true,
        MaxAge:           86400,
    })
    
    handler := c.Handler(r)
    
    log.Println("Lansia Friendly TTS Server running on :8080")
    log.Println("Available endpoints:")
    log.Println("  POST /api/tts        - Convert text to speech")
    log.Println("  POST /api/tts/stop   - Stop current speech")
    log.Println("  GET  /api/tts/voices - Get available voices")
    log.Println("  GET  /api/health     - Health check")
    
    log.Fatal(http.ListenAndServe(":8080", handler))
}