package handlers

import (
	"encoding/json"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

type TTSRequest struct {
	Text   string  `json:"text"`
	Speed  float64 `json:"speed"`
	Lang   string  `json:"lang"`
}

type TTSResponse struct {
	Success   bool    `json:"success"`
	Duration  float64 `json:"duration_ms,omitempty"`
	Timestamp string  `json:"timestamp"`
	Message   string  `json:"message,omitempty"`
}

func TextToSpeechHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req TTSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, TTSResponse{
			Success: false,
			Message: "Invalid request body",
		})
		return
	}

	// Validate text
	text := strings.TrimSpace(req.Text)
	if text == "" {
		respondJSON(w, http.StatusBadRequest, TTSResponse{
			Success: false,
			Message: "Text cannot be empty",
		})
		return
	}

	// Validate text length
	if len(text) > 5000 {
		respondJSON(w, http.StatusBadRequest, TTSResponse{
			Success: false,
			Message: "Text too long (max 5000 characters)",
		})
		return
	}

	// Start timing
	startTime := time.Now()

	// Execute TTS based on OS
	var cmd *exec.Cmd
	var err error
	
	switch runtime.GOOS {
	case "darwin": // macOS
		cmd = exec.Command("say", cleanTextForTTS(text))
	case "linux": // Linux
		cmd = exec.Command("espeak", "-v", "id", cleanTextForTTS(text))
	case "windows": // Windows
		psScript := `Add-Type -AssemblyName System.speech; $speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; $speak.Speak("` + escapeForPowerShell(cleanTextForTTS(text)) + `")`
		cmd = exec.Command("powershell", "-Command", psScript)
	default:
		respondJSON(w, http.StatusInternalServerError, TTSResponse{
			Success: false,
			Message: "Unsupported operating system",
		})
		return
	}

	// Run TTS command
	if err = cmd.Run(); err != nil {
		respondJSON(w, http.StatusInternalServerError, TTSResponse{
			Success: false,
			Message: "Failed to speak text: " + err.Error(),
		})
		return
	}

	// Calculate duration
	duration := time.Since(startTime).Seconds() * 1000

	respondJSON(w, http.StatusOK, TTSResponse{
		Success:   true,
		Duration:  duration,
		Timestamp: time.Now().Format(time.RFC3339),
		Message:   "Text spoken successfully",
	})
}

func HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "healthy",
		"service":   "lansia-tts",
		"version":   "1.0.0",
		"timestamp": time.Now().Format(time.RFC3339),
		"os":        runtime.GOOS,
	})
}

func GetVoicesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	voices := []string{"id-ID", "en-US", "en-GB"}
	if runtime.GOOS == "darwin" {
		voices = append(voices, "id", "en", "es", "fr")
	}
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"voices": voices,
		"default": "id-ID",
	})
}

func GetConfigHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"extension_name": "Lansia Friendly",
		"version": "1.0.0",
		"features": []string{
			"text_to_speech",
			"text_resize", 
			"cursor_enlarge",
		},
		"default_settings": map[string]interface{}{
			"voice_speed": 1.0,
			"text_size": 100,
			"cursor_size": 2,
		},
	})
}

// Helper functions
func escapeForPowerShell(text string) string {
	text = strings.ReplaceAll(text, `"`, `\"`)
	text = strings.ReplaceAll(text, "$", "`$")
	text = strings.ReplaceAll(text, "'", "`'")
	return text
}

func cleanTextForTTS(text string) string {
	// Remove extra whitespace
	text = strings.Join(strings.Fields(text), " ")
	// Escape quotes
	text = strings.ReplaceAll(text, `"`, `\"`)
	return text
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}