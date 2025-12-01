// Content Script - Runs on every webpage
console.log("🎯 Lansia Friendly Extension loaded");

// State
let settings = {
  isActive: true,
  voiceEnabled: true,
  textSize: 100,
  cursorEnabled: true,
  cursorSize: 2,
  voiceSpeed: 1.0,
};

// Hover tracking
let hoverTimeout = null;
let currentSpeech = null;

// Load settings
chrome.storage.sync.get(["lansiaSettings"], (result) => {
  if (result.lansiaSettings) {
    settings = result.lansiaSettings;
    applySettings();
  }
});

// Listen for settings updates from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "UPDATE_SETTINGS") {
    settings = message.settings;
    applySettings();
  }
});

// Apply all settings to current page
function applySettings() {
  if (!settings.isActive) {
    disableAllFeatures();
    return;
  }

  // Apply text size
  document.body.style.fontSize = `${settings.textSize}%`;
  document.body.style.lineHeight = "1.6";

  // Apply cursor
  if (settings.cursorEnabled) {
    const size = settings.cursorSize * 16;
    document.body.style.cursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="%234361ee" opacity="0.7"/><circle cx="16" cy="16" r="8" fill="white"/></svg>') ${
      size / 2
    } ${size / 2}, auto`;
  } else {
    document.body.style.cursor = "";
  }

  // Enable/disable voice feature
  if (settings.voiceEnabled) {
    enableVoiceFeature();
  } else {
    disableVoiceFeature();
  }

  console.log("✅ Settings applied:", settings);
}

function disableAllFeatures() {
  document.body.style.fontSize = "";
  document.body.style.lineHeight = "";
  document.body.style.cursor = "";
  disableVoiceFeature();
}

// Voice Feature
function enableVoiceFeature() {
  // Remove existing listeners first
  disableVoiceFeature();

  // Add new listeners
  document.addEventListener("mouseover", handleTextHover);
  document.addEventListener("mouseout", handleTextOut);
}

function disableVoiceFeature() {
  document.removeEventListener("mouseover", handleTextHover);
  document.removeEventListener("mouseout", handleTextOut);
  clearTimeout(hoverTimeout);
  stopSpeech();
}

// Text hover handler
function handleTextHover(e) {
  const element = e.target;

  // Check if element contains text
  if (shouldReadElement(element)) {
    const text = getElementText(element);

    if (text.trim()) {
      clearTimeout(hoverTimeout);

      // Start hover timeout
      hoverTimeout = setTimeout(() => {
        speakText(text);
      }, 500); // 500ms delay
    }
  }
}

function handleTextOut(e) {
  clearTimeout(hoverTimeout);
  stopSpeech();
}

function shouldReadElement(element) {
  // Ignore certain elements
  const ignoreTags = [
    "script",
    "style",
    "svg",
    "img",
    "canvas",
    "video",
    "audio",
  ];
  const tagName = element.tagName.toLowerCase();

  if (ignoreTags.includes(tagName)) return false;

  // Check if element has visible text
  const text = element.textContent || element.innerText;
  const hasText = text && text.trim().length > 0;
  const isVisible = element.offsetWidth > 0 && element.offsetHeight > 0;

  return hasText && isVisible;
}

function getElementText(element) {
  // Get clean text content
  let text = element.textContent || element.innerText;

  // Clean up text
  text = text.trim();
  text = text.replace(/\s+/g, " "); // Remove extra spaces
  text = text.substring(0, 500); // Limit length

  return text;
}

// Text-to-Speech functions
function speakText(text) {
  // Option 1: Use backend TTS
  speakWithBackend(text);

  // Option 2: Use Web Speech API (fallback)
  // speakWithWebAPI(text);
}

async function speakWithBackend(text) {
  if (!settings.voiceEnabled) return;

  try {
    const response = await fetch("http://localhost:8080/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text,
        speed: settings.voiceSpeed,
        lang: "id-ID",
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    console.log("🔊 Backend TTS success:", data);
  } catch (error) {
    console.warn("Backend TTS failed, falling back to Web Speech API:", error);
    speakWithWebAPI(text);
  }
}

function speakWithWebAPI(text) {
  if (!settings.voiceEnabled || !("speechSynthesis" in window)) return;

  // Stop any current speech
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "id-ID";
  utterance.rate = settings.voiceSpeed;
  utterance.volume = 1;

  utterance.onstart = () => {
    console.log("Speaking:", text.substring(0, 50));
  };

  utterance.onend = () => {
    currentSpeech = null;
  };

  currentSpeech = utterance;
  window.speechSynthesis.speak(utterance);
}

function stopSpeech() {
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  currentSpeech = null;
}

// Inject control panel into page
function injectControlPanel() {
  if (document.getElementById("lansia-control-panel")) return;

  const panel = document.createElement("div");
  panel.id = "lansia-control-panel";
  panel.innerHTML = `
        <style>
            #lansia-control-panel {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px;
                border-radius: 10px;
                z-index: 10000;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                font-family: 'Segoe UI', sans-serif;
                min-width: 200px;
                border: 2px solid white;
            }
            .lansia-status {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            }
            .status-dot {
                width: 10px;
                height: 10px;
                background: #4cc9f0;
                border-radius: 50%;
                animation: pulse 2s infinite;
            }
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
        </style>
        <div class="lansia-status">
            <div class="status-dot"></div>
            <strong>Lansia Friendly</strong>
        </div>
        <div style="font-size: 12px; opacity: 0.9;">
            Suara: ${settings.voiceEnabled ? "ON" : "OFF"} | 
            Teks: ${settings.textSize}% | 
            Kursor: ${settings.cursorEnabled ? "ON" : "OFF"}
        </div>
    `;

  document.body.appendChild(panel);
}

// Initialize
applySettings();
injectControlPanel();
