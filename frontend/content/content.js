// Listen for settings updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "UPDATE_SETTINGS") {
    applySettings(message.settings);
  }
});

// Load initial settings
chrome.storage.sync.get(["lansiaSettings"], (result) => {
  if (result.lansiaSettings) {
    applySettings(result.lansiaSettings);
  }
});

function applySettings(settings) {
  if (!settings.isActive) {
    disableAllFeatures();
    return;
  }

  // Text size
  document.body.style.fontSize = `${settings.textSize}%`;
  document.body.style.lineHeight = "1.6";

  // Cursor
  if (settings.cursorEnabled) {
    document.body.style.cursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${
      settings.cursorSize * 32
    }" height="${
      settings.cursorSize * 32
    }" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="%234361ee" opacity="0.7"/><circle cx="16" cy="16" r="8" fill="white"/></svg>') 16 16, auto`;
  }

  // Voice feature
  if (settings.voiceEnabled) {
    enableVoiceFeature(settings.voiceSpeed);
  } else {
    disableVoiceFeature();
  }
}

function enableVoiceFeature(speed) {
  // Remove existing listeners
  disableVoiceFeature();

  // Hover handler for text elements
  document.addEventListener("mouseover", handleTextHover);
  document.addEventListener("mouseout", handleTextOut);
}

function disableVoiceFeature() {
  document.removeEventListener("mouseover", handleTextHover);
  document.removeEventListener("mouseout", handleTextOut);
}

function disableAllFeatures() {
  document.body.style.fontSize = "";
  document.body.style.cursor = "";
  document.body.style.lineHeight = "";
  disableVoiceFeature();
}

let currentSpeech = null;
let hoverTimeout = null;

async function handleTextHover(e) {
  const element = e.target;

  // Only process text elements
  if (shouldReadElement(element)) {
    const text = getElementText(element);

    if (text.trim()) {
      // Clear previous timeout
      clearTimeout(hoverTimeout);

      // Start new timeout
      hoverTimeout = setTimeout(() => {
        speakText(text);
      }, 500); // 500ms delay before speaking
    }
  }
}

function handleTextOut(e) {
  clearTimeout(hoverTimeout);
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
}

function shouldReadElement(element) {
  const tagName = element.tagName.toLowerCase();
  const ignoreTags = ["script", "style", "svg", "path", "img"];

  if (ignoreTags.includes(tagName)) return false;

  // Check if element has text
  const text = element.textContent || element.innerText;
  return text && text.trim().length > 0 && text.trim().length < 500;
}

function getElementText(element) {
  return element.textContent || element.innerText || "";
}

function speakText(text) {
  if (!window.speechSynthesis) {
    console.warn("Text-to-speech not supported");
    return;
  }

  // Cancel any ongoing speech
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  // Get settings for voice speed
  chrome.storage.sync.get(["lansiaSettings"], (result) => {
    if (result.lansiaSettings) {
      const speed = result.lansiaSettings.voiceSpeed || 1;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID"; // Indonesian
      utterance.rate = speed;
      utterance.volume = 1;
      utterance.pitch = 1;

      window.speechSynthesis.speak(utterance);
    }
  });
}

// Alternative: Use backend TTS (uncomment if needed)
async function speakTextBackend(text) {
  try {
    const response = await fetch("http://localhost:8080/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text,
        lang: "id-ID",
      }),
    });

    if (!response.ok) {
      throw new Error("TTS request failed");
    }
  } catch (error) {
    console.error("TTS Error:", error);
    // Fallback to browser TTS
    speakText(text);
  }
}
