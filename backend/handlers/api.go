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
	var req TTSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, TTSResponse{
			Success: false,
			Message: "Invalid request body",
		})
		return
	}

	// Validate text
	if strings.TrimSpace(req.Text) == "" {
		respondJSON(w, http.StatusBadRequest, TTSResponse{
			Success: false,
			Message: "Text cannot be empty",
		})
		return
	}

	// Start timing
	startTime := time.Now()

	// Execute TTS based on OS
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin": // macOS
		cmd = exec.Command("say", req.Text)
	case "linux": // Linux
		cmd = exec.Command("espeak", "-v", "id", req.Text)
	case "windows": // Windows
		psScript := `Add-Type -AssemblyName System.speech; $speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; $speak.Speak("` + escapeForPowerShell(req.Text) + `")`
		cmd = exec.Command("powershell", "-Command", psScript)
	default:
		respondJSON(w, http.StatusInternalServerError, TTSResponse{
			Success: false,
			Message: "Unsupported operating system",
		})
		return
	}

	// Run TTS command
	if err := cmd.Run(); err != nil {
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
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "healthy",
		"service":   "lansia-tts",
		"version":   "1.0.0",
		"timestamp": time.Now().Format(time.RFC3339),
		"os":        runtime.GOOS,
	})
}

func GetVoicesHandler(w http.ResponseWriter, r *http.Request) {
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
	return text
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}