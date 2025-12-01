# test_windows_tts.ps1
Write-Host "=== Testing Windows TTS Capabilities ===" -ForegroundColor Green

Write-Host "`n[1] Testing simple PowerShell TTS..." -ForegroundColor Yellow
try {
    $voice = New-Object -ComObject SAPI.SPVoice
    $voice.Speak("Testing Windows TTS sederhana") | Out-Null
    Write-Host "✅ Simple TTS Berhasil" -ForegroundColor Green
} catch {
    Write-Host "❌ Simple TTS Gagal: $_" -ForegroundColor Red
}

Write-Host "`n[2] Testing System.Speech Assembly..." -ForegroundColor Yellow
try {
    Add-Type -AssemblyName System.speech
    $speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $speak.Speak("Testing System Speech Assembly") | Out-Null
    Write-Host "✅ System.Speech Berhasil" -ForegroundColor Green
    
    # Tampilkan voices yang tersedia
    Write-Host "`nAvailable Voices:" -ForegroundColor Cyan
    $speak.GetInstalledVoices() | ForEach-Object {
        Write-Host "  - $($_.VoiceInfo.Name)"
    }
} catch {
    Write-Host "❌ System.Speech Gagal: $_" -ForegroundColor Red
    Write-Host "`nInstalling .NET Framework might be needed" -ForegroundColor Yellow
}

Write-Host "`n=== Test Selesai ===" -ForegroundColor Green