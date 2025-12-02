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
let highlightedElement = null;
let controlPanel = null;

// Inisialisasi
initializeExtension();

// ============= FUNGSI UTAMA =============

function initializeExtension() {
  loadSettings();
  setupEventListeners();

  // Inject CSS untuk text-only highlight
  injectTextOnlyCSS();
}

function loadSettings() {
  chrome.storage.sync.get(["lansiaSettings"], (result) => {
    if (result.lansiaSettings) {
      Object.assign(settings, result.lansiaSettings);
      applySettings();
    }
    injectControlPanel();
  });
}

function setupEventListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "UPDATE_SETTINGS") {
      settings = message.settings;
      applySettings();
      updateControlPanel();
    }
  });
}

// ============= TEXT-ONLY HOVER CSS =============

function injectTextOnlyCSS() {
  const style = document.createElement("style");
  style.id = "lansia-text-only-style";
  style.textContent = `
    /* Text-only highlight */
    .lansia-text-highlight {
      background-color: rgba(67, 97, 238, 0.15) !important;
      box-shadow: inset 0 -2px 0 rgba(67, 97, 238, 0.3) !important;
      transition: background-color 0.3s ease, box-shadow 0.3s ease !important;
      border-radius: 2px !important;
      padding: 1px 0 !important;
      margin: -1px 0 !important;
    }
    
    /* Exclude non-text elements */
    .lansia-text-highlight img,
    .lansia-text-highlight svg,
    .lansia-text-highlight canvas,
    .lansia-text-highlight video,
    .lansia-text-highlight audio,
    .lansia-text-highlight input,
    .lansia-text-highlight button,
    .lansia-text-highlight select,
    .lansia-text-highlight textarea {
      background-color: transparent !important;
      box-shadow: none !important;
    }
    
    /* Text resize global */
    html.lansia-text-resized {
      font-size: ${settings.textSize}% !important;
    }
    
    /* Force text resize inheritance */
    .lansia-text-resized * {
      font-size: inherit !important;
      line-height: 1.6 !important;
    }
    
    /* Exclude form elements from text resize */
    .lansia-text-resized input,
    .lansia-text-resized textarea,
    .lansia-text-resized select,
    .lansia-text-resized button {
      font-size: initial !important;
    }
  `;
  document.head.appendChild(style);
}

// ============= APPLY SETTINGS =============

function applySettings() {
  if (!settings.isActive) {
    disableAllFeatures();
    removeControlPanel();
    return;
  }

  injectControlPanel();

  // Apply text size to ALL elements
  applyTextSizeToAll();

  // Apply cursor
  applyCursor();

  // Enable/disable voice feature
  if (settings.voiceEnabled) {
    enableVoiceFeature();
  } else {
    disableVoiceFeature();
  }

  console.log("✅ Settings applied:", settings);
}

function disableAllFeatures() {
  // Reset text size
  document.documentElement.classList.remove("lansia-text-resized");
  document.documentElement.style.fontSize = "";

  // Reset cursor
  document.documentElement.style.cursor = "";
  document.body.style.cursor = "";

  // Remove all custom classes
  document.querySelectorAll(".lansia-text-highlight").forEach((el) => {
    el.classList.remove("lansia-text-highlight");
  });

  // Reset voice features
  disableVoiceFeature();
}

// ============= TEXT SIZE FEATURE (FIXED) =============

function applyTextSizeToAll() {
  // Add class to html element for inheritance
  document.documentElement.classList.add("lansia-text-resized");

  // Apply font size to html element (will inherit to all children)
  document.documentElement.style.fontSize = `${settings.textSize}%`;

  // Apply line height
  document.documentElement.style.lineHeight = "1.6";

  // Force reflow to ensure styles are applied
  document.body.style.visibility = "hidden";
  document.body.offsetHeight; // Trigger reflow
  document.body.style.visibility = "visible";

  console.log(`📏 Text size set to: ${settings.textSize}%`);
}

// ============= CURSOR FEATURE =============

function applyCursor() {
  if (settings.cursorEnabled) {
    const size = settings.cursorSize * 16;
    const cursorData = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="%234361ee" opacity="0.7"/><circle cx="16" cy="16" r="8" fill="white"/></svg>`;

    // Apply to html element (will inherit to all)
    document.documentElement.style.cursor = `url('${cursorData}') ${size / 2} ${
      size / 2
    }, auto`;

    // Special cursor for interactive elements
    document
      .querySelectorAll(
        'a, button, input, textarea, select, [role="button"], [onclick]'
      )
      .forEach((el) => {
        el.style.cursor = `url('${cursorData}') ${size / 2} ${
          size / 2
        }, pointer`;
      });
  } else {
    document.documentElement.style.cursor = "";

    document
      .querySelectorAll(
        'a, button, input, textarea, select, [role="button"], [onclick]'
      )
      .forEach((el) => {
        el.style.cursor = "";
      });
  }
}

// ============= VOICE FEATURE - TEXT-ONLY HOVER =============

function enableVoiceFeature() {
  disableVoiceFeature(); // Remove existing first

  // Use event delegation with more specific targeting
  document.addEventListener("mouseover", handleTextHover, { capture: true });
  document.addEventListener("mouseout", handleTextOut, { capture: true });
}

function disableVoiceFeature() {
  document.removeEventListener("mouseover", handleTextHover, { capture: true });
  document.removeEventListener("mouseout", handleTextOut, { capture: true });
  clearTimeout(hoverTimeout);
  stopSpeech();
  removeTextHighlight();
}

function handleTextHover(e) {
  const element = e.target;

  if (!isTextOnlyElement(element)) return;

  const text = getTextOnlyContent(element);
  if (!text.trim()) return;

  // Highlight ONLY the text nodes
  highlightTextOnly(element);

  clearTimeout(hoverTimeout);
  hoverTimeout = setTimeout(() => {
    speakText(text);
  }, 500);
}

function handleTextOut(e) {
  clearTimeout(hoverTimeout);
  stopSpeech();
  removeTextHighlight();
}

function isTextOnlyElement(element) {
  // Skip non-text elements completely
  const ignoreTags = [
    "script",
    "style",
    "svg",
    "img",
    "canvas",
    "video",
    "audio",
    "input",
    "textarea",
    "select",
    "button",
    "iframe",
    "object",
    "embed",
    "picture",
    "source",
    "track",
    "map",
    "area",
  ];

  const tagName = element.tagName.toLowerCase();

  if (ignoreTags.includes(tagName)) return false;
  if (element.classList.contains("lansia-control-panel")) return false;

  // Check if element has visible TEXT (not just children with text)
  const hasText =
    element.childNodes &&
    Array.from(element.childNodes).some(
      (node) =>
        node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
    );

  const isVisible = element.offsetWidth > 0 && element.offsetHeight > 0;

  return hasText && isVisible;
}

function getTextOnlyContent(element) {
  // Extract only direct text content, ignoring child elements
  let text = "";

  if (element.childNodes) {
    Array.from(element.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += " " + node.textContent.trim();
      }
    });
  }

  // Fallback to full text if no direct text nodes
  if (!text.trim() && element.textContent) {
    text = element.textContent;
  }

  // Clean up
  text = text.trim();
  text = text.replace(/\s+/g, " ");
  text = text.substring(0, 500);

  return text;
}

function highlightTextOnly(element) {
  removeTextHighlight();

  highlightedElement = element;
  element.classList.add("lansia-text-highlight");

  // Store original style
  element.dataset.originalBackground = element.style.backgroundColor;
  element.dataset.originalBoxShadow = element.style.boxShadow;
}

function removeTextHighlight() {
  if (highlightedElement) {
    highlightedElement.classList.remove("lansia-text-highlight");
    highlightedElement.style.backgroundColor =
      highlightedElement.dataset.originalBackground || "";
    highlightedElement.style.boxShadow =
      highlightedElement.dataset.originalBoxShadow || "";
    highlightedElement = null;
  }
}

// ============= TEXT-TO-SPEECH =============

async function speakText(text) {
  if (!settings.voiceEnabled || !settings.isActive) return;

  try {
    await speakWithBackend(text);
  } catch (error) {
    console.warn("Backend TTS failed:", error);
    speakWithWebAPI(text);
  }
}

async function speakWithBackend(text) {
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
  return data;
}

function speakWithWebAPI(text) {
  if (!("speechSynthesis" in window)) return;

  stopSpeech();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "id-ID";
  utterance.rate = settings.voiceSpeed;
  utterance.volume = 1;

  utterance.onend = () => {
    currentSpeech = null;
    removeTextHighlight();
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

// ============= CONTROL PANEL =============

function injectControlPanel() {
  if (controlPanel || !settings.isActive) return;

  controlPanel = document.createElement("div");
  controlPanel.id = "lansia-control-panel";
  controlPanel.className = "lansia-control-panel";
  controlPanel.innerHTML = `
    <div class="lansia-panel-header">
      <div class="lansia-status">
        <div class="status-dot active"></div>
        <strong>Lansia Friendly</strong>
      </div>
      <button class="lansia-close-btn" title="Sembunyikan">×</button>
    </div>
    <div class="lansia-panel-content">
      <div class="lansia-status-item">
        <span>Suara:</span>
        <span class="lansia-status-value" id="lansia-voice-status">${
          settings.voiceEnabled ? "ON" : "OFF"
        }</span>
      </div>
      <div class="lansia-status-item">
        <span>Teks:</span>
        <span class="lansia-status-value" id="lansia-text-size">${
          settings.textSize
        }%</span>
      </div>
      <div class="lansia-status-item">
        <span>Kursor:</span>
        <span class="lansia-status-value" id="lansia-cursor-status">${
          settings.cursorEnabled ? "ON" : "OFF"
        }</span>
      </div>
    </div>
  `;

  document.body.appendChild(controlPanel);

  const closeBtn = controlPanel.querySelector(".lansia-close-btn");
  closeBtn.addEventListener("click", () => {
    removeControlPanel();
  });

  makeDraggable(controlPanel);
}

function updateControlPanel() {
  if (!controlPanel) return;

  const voiceStatus = controlPanel.querySelector("#lansia-voice-status");
  const textSize = controlPanel.querySelector("#lansia-text-size");
  const cursorStatus = controlPanel.querySelector("#lansia-cursor-status");

  if (voiceStatus)
    voiceStatus.textContent = settings.voiceEnabled ? "ON" : "OFF";
  if (textSize) textSize.textContent = `${settings.textSize}%`;
  if (cursorStatus)
    cursorStatus.textContent = settings.cursorEnabled ? "ON" : "OFF";

  if (!settings.isActive) {
    removeControlPanel();
  }

  // Update CSS for text size
  updateTextSizeCSS();
}

function updateTextSizeCSS() {
  const style = document.getElementById("lansia-text-only-style");
  if (style) {
    style.textContent = style.textContent.replace(
      /font-size: \d+% !important/,
      `font-size: ${settings.textSize}% !important`
    );
  }

  // Re-apply text size
  applyTextSizeToAll();
}

function removeControlPanel() {
  if (controlPanel) {
    controlPanel.remove();
    controlPanel = null;
  }
}

function makeDraggable(element) {
  let isDragging = false;
  let currentX,
    currentY,
    initialX,
    initialY,
    xOffset = 0,
    yOffset = 0;

  element.addEventListener("mousedown", dragStart);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", dragEnd);

  function dragStart(e) {
    if (e.target.classList.contains("lansia-close-btn")) return;

    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target === element || e.target.closest(".lansia-panel-header")) {
      isDragging = true;
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      xOffset = currentX;
      yOffset = currentY;

      element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
  }

  function dragEnd() {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }
}
