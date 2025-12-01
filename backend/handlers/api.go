package handlers

import (
	"encoding/json"
	"lansia-backend/services"
	"net/http"
	"time"
)

var ttsService services.TTSService

func init() {
    // Initialize TTS service (System TTS by default)
    ttsService = services.NewSystemTTSService()
}

func TextToSpeechHandler(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Text   string             `json:"text"`
        Config services.TTSConfig `json:"config"`
    }
    
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", http.StatusBadRequest)
        return
    }
    
    // Validasi teks
    validatedText, err := services.ValidateText(req.Text)
    if err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    
    // Gunakan config default jika kosong
    if req.Config.Language == "" {
        req.Config = services.GetDefaultConfig()
    }
    
    // Konversi teks ke suara
    response, err := ttsService.Speak(validatedText, req.Config)
    if err != nil {
        http.Error(w, "TTS failed: "+err.Error(), http.StatusInternalServerError)
        return
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func StopSpeechHandler(w http.ResponseWriter, r *http.Request) {
    if err := ttsService.Stop(); err != nil {
        http.Error(w, "Failed to stop speech", http.StatusInternalServerError)
        return
    }
    
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{
        "status": "stopped",
    })
}

func GetVoicesHandler(w http.ResponseWriter, r *http.Request) {
    voices, err := ttsService.GetVoices()
    if err != nil {
        http.Error(w, "Failed to get voices", http.StatusInternalServerError)
        return
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "voices": voices,
        "count":  len(voices),
    })
}

func HealthCheck(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "status":    "healthy",
        "service":   "tts",
        "speaking":  ttsService.IsSpeaking(),
        "timestamp": time.Now().Unix(),
    })
}