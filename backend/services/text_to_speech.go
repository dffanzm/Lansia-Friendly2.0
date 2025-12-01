package services

import (
	"context"
	"fmt"
	"log"
	"net/http" // Added for CloudTTSService
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"
)

// TTSConfig konfigurasi untuk text-to-speech
type TTSConfig struct {
    Language    string  `json:"language"`
    Speed       float64 `json:"speed"`       // 0.5 - 2.0
    Volume      float64 `json:"volume"`      // 0.0 - 1.0
    Voice       string  `json:"voice"`       // Nama voice tertentu
    UseSystemTTS bool   `json:"use_system_tts"` // Gunakan sistem atau cloud
}

// TTSRequest request untuk text-to-speech
type TTSRequest struct {
    Text     string   `json:"text"`
    Config   TTSConfig `json:"config"`
    ClientID string   `json:"client_id"` // Untuk tracking
}

// TTSResponse response dari text-to-speech
type TTSResponse struct {
    Success    bool      `json:"success"`
    AudioURL   string    `json:"audio_url,omitempty"` // Untuk cloud TTS
    Duration   float64   `json:"duration_ms,omitempty"`
    Timestamp  time.Time `json:"timestamp"`
    Error      string    `json:"error,omitempty"`
}

// TTSService interface untuk TTS
type TTSService interface {
    Speak(text string, config TTSConfig) (*TTSResponse, error)
    Stop() error
    GetVoices() ([]string, error)
    IsSpeaking() bool
}

// SystemTTSService implementasi menggunakan sistem TTS
type SystemTTSService struct {
    mu        sync.Mutex
    isSpeaking bool
    currentCmd *exec.Cmd
    ctx        context.Context
    cancel     context.CancelFunc
}

// NewSystemTTSService membuat instance baru SystemTTSService
func NewSystemTTSService() *SystemTTSService {
    ctx, cancel := context.WithCancel(context.Background())
    return &SystemTTSService{
        ctx:    ctx,
        cancel: cancel,
    }
}

// Speak mengonversi teks ke suara menggunakan sistem TTS
func (s *SystemTTSService) Speak(text string, config TTSConfig) (*TTSResponse, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    // Stop speech sebelumnya jika sedang berjalan
    if s.isSpeaking {
        s.Stop()
    }

    // Validasi input
    if strings.TrimSpace(text) == "" {
        return &TTSResponse{
            Success:   false,
            Error:     "Text is empty",
            Timestamp: time.Now(),
        }, nil
    }

    if len(text) > 5000 {
        return &TTSResponse{
            Success:   false,
            Error:     "Text too long (max 5000 characters)",
            Timestamp: time.Now(),
        }, nil
    }

    // Set default config jika kosong
    if config.Language == "" {
        config.Language = "id-ID"
    }
    if config.Speed == 0 {
        config.Speed = 1.0
    }
    if config.Volume == 0 {
        config.Volume = 1.0
    }

    // Mulai timer untuk menghitung durasi
    startTime := time.Now()

    // Eksekusi perintah TTS berdasarkan OS
    var cmd *exec.Cmd
    switch runtime.GOOS {
    case "darwin": // macOS
        cmd = s.getMacOSTTSCommand(text, config)
    case "linux":
        cmd = s.getLinuxTTSCommand(text, config)
    case "windows":
        cmd = s.getWindowsTTSCommand(text, config)
    default:
        return &TTSResponse{
            Success:   false,
            Error:     fmt.Sprintf("Unsupported OS: %s", runtime.GOOS),
            Timestamp: time.Now(),
        }, nil
    }

    if cmd == nil {
        return &TTSResponse{
            Success:   false,
            Error:     "Failed to create TTS command",
            Timestamp: time.Now(),
        }, nil
    }

    s.currentCmd = cmd
    s.isSpeaking = true

    // Jalankan perintah dalam goroutine
    go func() {
        defer func() {
            s.mu.Lock()
            s.isSpeaking = false
            s.currentCmd = nil
            s.mu.Unlock()
        }()

        err := cmd.Run()
        if err != nil {
            log.Printf("TTS error: %v", err)
        }
    }()

    duration := time.Since(startTime).Seconds() * 1000

    return &TTSResponse{
        Success:   true,
        Duration:  duration,
        Timestamp: time.Now(),
    }, nil
}

// getMacOSTTSCommand membuat command TTS untuk macOS
func (s *SystemTTSService) getMacOSTTSCommand(text string, config TTSConfig) *exec.Cmd {
    // Gunakan 'say' command dengan parameter
    args := []string{}
    
    // Pilih voice berdasarkan bahasa
    switch config.Language {
    case "id-ID", "id":
        args = append(args, "-v", "Damayanti") // Voice Indonesia
    case "en-US", "en":
        args = append(args, "-v", "Alex") // Voice English US
    default:
        args = append(args, "-v", "Damayanti")
    }
    
    // Speed rate (say command menggunakan rate dalam WPM)
    // Default rate adalah 175 WPM, adjust berdasarkan config.Speed
    rate := int(175 * config.Speed)
    if rate < 50 {
        rate = 50
    }
    if rate > 400 {
        rate = 400
    }
    args = append(args, "-r", fmt.Sprintf("%d", rate))
    
    // Volume (0-100)
    volume := int(config.Volume * 100)
    if volume > 0 {
        args = append(args, "-a", fmt.Sprintf("%d", volume))
    }
    
    // Tambahkan teks
    args = append(args, text)
    
    return exec.CommandContext(s.ctx, "say", args...)
}

// getLinuxTTSCommand membuat command TTS untuk Linux
func (s *SystemTTSService) getLinuxTTSCommand(text string, config TTSConfig) *exec.Cmd {
    // Coba espeak dulu, lalu festival
    var cmd *exec.Cmd
    
    // Check if espeak is available
    if _, err := exec.LookPath("espeak"); err == nil {
        args := []string{}
        
        // Language
        switch config.Language {
        case "id-ID", "id":
            args = append(args, "-v", "id") // Indonesian
        case "en-US", "en":
            args = append(args, "-v", "en-us")
        default:
            args = append(args, "-v", "id")
        }
        
        // Speed (espeak default 175, range 80-450)
        speed := int(175 * config.Speed)
        if speed < 80 {
            speed = 80
        }
        if speed > 450 {
            speed = 450
        }
        args = append(args, "-s", fmt.Sprintf("%d", speed))
        
        // Volume (0-200, default 100)
        volume := int(config.Volume * 100)
        args = append(args, "-a", fmt.Sprintf("%d", volume))
        
        // Pitch (30-99, default 50)
        pitch := 50
        args = append(args, "-p", fmt.Sprintf("%d", pitch))
        
        args = append(args, text)
        cmd = exec.CommandContext(s.ctx, "espeak", args...)
        
    } else if _, err := exec.LookPath("festival"); err == nil {
        // Use festival with pipe
        script := fmt.Sprintf(`(SayText "%s")`, text)
        cmd = exec.CommandContext(s.ctx, "sh", "-c", fmt.Sprintf("echo '%s' | festival --tts", script))
    } else {
        log.Println("No TTS engine found on Linux (espeak or festival)")
        return nil
    }
    
    return cmd
}

// getWindowsTTSCommand membuat command TTS untuk Windows
func (s *SystemTTSService) getWindowsTTSCommand(text string, config TTSConfig) *exec.Cmd {
    // Gunakan PowerShell dengan System.Speech
    script := fmt.Sprintf(`
    Add-Type -AssemblyName System.speech
    $speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
    
    # Set language
    $culture = New-Object System.Globalization.CultureInfo("%s")
    try {
        $speak.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, 
                                   [System.Speech.Synthesis.VoiceAge]::Adult,
                                   0, $culture)
    } catch {
        # Use default voice if specific language not found
    }
    
    # Set rate (-10 to 10)
    $rate = %d
    if ($rate -lt -10) { $rate = -10 }
    if ($rate -gt 10) { $rate = 10 }
    $speak.Rate = $rate
    
    # Set volume (0-100)
    $volume = %d
    if ($volume -lt 0) { $volume = 0 }
    if ($volume -gt 100) { $volume = 100 }
    $speak.Volume = $volume
    
    # Speak
    $speak.Speak("%s")
    `, 
    config.Language,
    int((config.Speed-1)*10), // Convert 0.5-2.0 to -5 to 10
    int(config.Volume*100),
    escapePowerShellString(text))
    
    return exec.CommandContext(s.ctx, "powershell", "-Command", script)
}

// escapePowerShellString escape string untuk PowerShell
func escapePowerShellString(s string) string {
    // Escape quotes dan karakter khusus
    s = strings.ReplaceAll(s, `"`, `\"`)
    s = strings.ReplaceAll(s, "`", "``")
    s = strings.ReplaceAll(s, "$", "`$")
    return s
}

// Stop menghentikan speech yang sedang berjalan
func (s *SystemTTSService) Stop() error {
    s.mu.Lock()
    defer s.mu.Unlock()
    
    if s.currentCmd != nil && s.currentCmd.Process != nil {
        // Cancel context
        if s.cancel != nil {
            s.cancel()
        }
        
        // Kill process
        err := s.currentCmd.Process.Kill()
        if err != nil {
            return fmt.Errorf("failed to stop TTS: %v", err)
        }
        
        // Reset context
        ctx, cancel := context.WithCancel(context.Background())
        s.ctx = ctx
        s.cancel = cancel
    }
    
    s.isSpeaking = false
    s.currentCmd = nil
    return nil
}

// GetVoices mendapatkan daftar voice yang tersedia
func (s *SystemTTSService) GetVoices() ([]string, error) {
    switch runtime.GOOS {
    case "darwin": // macOS
        cmd := exec.Command("say", "-v", "?")
        output, err := cmd.Output()
        if err != nil {
            return nil, err
        }
        
        voices := []string{}
        lines := strings.Split(string(output), "\n")
        for _, line := range lines {
            if strings.Contains(line, "#") {
                continue
            }
            parts := strings.Fields(line)
            if len(parts) > 0 {
                voices = append(voices, parts[0])
            }
        }
        return voices, nil
        
    case "windows":
        // Windows - bisa menggunakan PowerShell untuk mendapatkan voices
        script := `
        Add-Type -AssemblyName System.speech
        $speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $speak.GetInstalledVoices() | ForEach-Object {
            $_.VoiceInfo.Name
        }
        `
        cmd := exec.Command("powershell", "-Command", script)
        output, err := cmd.Output()
        if err != nil {
            return nil, err
        }
        return strings.Split(strings.TrimSpace(string(output)), "\n"), nil
        
    case "linux":
        // Linux - espeak voices
        cmd := exec.Command("espeak", "--voices")
        output, err := cmd.Output()
        if err != nil {
            return nil, err
        }
        
        voices := []string{}
        lines := strings.Split(string(output), "\n")
        for i, line := range lines {
            if i == 0 {
                continue // Skip header
            }
            parts := strings.Fields(line)
            if len(parts) > 1 {
                voices = append(voices, parts[1]) // Language code
            }
        }
        return voices, nil
    }
    
    return []string{"default"}, nil
}

// IsSpeaking mengecek apakah sedang ada speech yang berjalan
func (s *SystemTTSService) IsSpeaking() bool {
    s.mu.Lock()
    defer s.mu.Unlock()
    return s.isSpeaking
}

// CloudTTSService implementasi menggunakan Google Cloud TTS (opsional)
type CloudTTSService struct {
    apiKey     string
    httpClient *http.Client
}

// NewCloudTTSService membuat instance baru CloudTTSService
func NewCloudTTSService(apiKey string) *CloudTTSService {
    return &CloudTTSService{
        apiKey: apiKey,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

// Speak menggunakan Google Cloud Text-to-Speech API
func (c *CloudTTSService) Speak(text string, config TTSConfig) (*TTSResponse, error) {
    // Implementasi Cloud TTS (Google, AWS, Azure)
    // Untuk sekarang, return error atau fallback ke system TTS
    return nil, fmt.Errorf("Cloud TTS not implemented. Please use SystemTTSService")
}

// Stop menghentikan speech (tidak ada implementasi untuk cloud)
func (c *CloudTTSService) Stop() error {
    // Cloud TTS biasanya streaming, tidak bisa di-stop
    return nil
}

// GetVoices mendapatkan daftar voices dari cloud service
func (c *CloudTTSService) GetVoices() ([]string, error) {
    // Untuk Google Cloud TTS, perlu implementasi API call
    // Return default voices untuk sekarang
    return []string{
        "id-ID-Standard-A",    // Female Indonesian
        "id-ID-Standard-B",    // Male Indonesian
        "id-ID-Standard-C",    // Male Indonesian 2
        "id-ID-Standard-D",    // Female Indonesian 2
        "en-US-Standard-A",    // Female English US
        "en-US-Standard-B",    // Male English US
        "en-US-Standard-C",    // Female English US 2
        "en-US-Standard-D",    // Male English US 2
    }, nil
}

// IsSpeaking mengecek apakah sedang ada speech yang berjalan
func (c *CloudTTSService) IsSpeaking() bool {
    // Cloud TTS biasanya stateless
    return false
}

// Utility functions untuk TTS

// ValidateText memvalidasi dan membersihkan teks untuk TTS
func ValidateText(text string) (string, error) {
    if strings.TrimSpace(text) == "" {
        return "", fmt.Errorf("text cannot be empty")
    }
    
    // Batasi panjang teks
    if len(text) > 5000 {
        text = text[:5000] + "..."
    }
    
    // Bersihkan karakter khusus yang mungkin bermasalah
    text = strings.ReplaceAll(text, "\"", "'")
    text = strings.ReplaceAll(text, "\n", ". ")
    text = strings.ReplaceAll(text, "\r", "")
    text = strings.ReplaceAll(text, "\t", " ")
    
    // Multiple spaces to single space
    text = strings.Join(strings.Fields(text), " ")
    
    return text, nil
}

// GetDefaultConfig mendapatkan konfigurasi default berdasarkan OS
func GetDefaultConfig() TTSConfig {
    return TTSConfig{
        Language:    "id-ID",
        Speed:       1.0,
        Volume:      1.0,
        Voice:       "",
        UseSystemTTS: true,
    }
}

// CreateTTSService membuat TTS service berdasarkan OS dan preferensi
func CreateTTSService(useCloud bool, cloudAPIKey string) TTSService {
    if useCloud && cloudAPIKey != "" {
        return NewCloudTTSService(cloudAPIKey)
    }
    return NewSystemTTSService()
}