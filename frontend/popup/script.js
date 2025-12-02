// Extension State
const state = {
  isActive: true,
  voiceEnabled: true,
  textSize: 100,
  cursorEnabled: true,
  cursorSize: 2,
  voiceSpeed: 1.0,
  backendUrl: "http://localhost:8080",
  backendConnected: false,
};

// DOM Elements
const globalToggle = document.getElementById("globalToggle");
const voiceToggle = document.getElementById("voiceToggle");
const cursorToggle = document.getElementById("cursorToggle");
const voiceSpeed = document.getElementById("voiceSpeed");
const speedValue = document.getElementById("speedValue");
const cursorSize = document.getElementById("cursorSize");
const cursorSizeValue = document.getElementById("cursorSizeValue");
const textSizeValue = document.getElementById("textSizeValue");
const decreaseText = document.getElementById("decreaseText");
const increaseText = document.getElementById("increaseText");
const resetText = document.getElementById("resetText");
const statusText = document.getElementById("statusText");
const connectionStatus = document.getElementById("connectionStatus");
const testBtn = document.getElementById("testBtn");

// Initialize
loadState();
updateUI();
checkBackendConnection();

// Event Listeners
globalToggle.addEventListener("change", (e) => {
  state.isActive = e.target.checked;
  updateStatusText();
  saveAndApply();
});

voiceToggle.addEventListener("change", (e) => {
  state.voiceEnabled = e.target.checked;
  saveAndApply();
});

cursorToggle.addEventListener("change", (e) => {
  state.cursorEnabled = e.target.checked;
  saveAndApply();
});

voiceSpeed.addEventListener("input", (e) => {
  state.voiceSpeed = parseFloat(e.target.value);
  speedValue.textContent = `${state.voiceSpeed.toFixed(1)}x`;
  saveAndApply();
});

cursorSize.addEventListener("input", (e) => {
  state.cursorSize = parseFloat(e.target.value);
  cursorSizeValue.textContent = `${state.cursorSize}x`;
  saveAndApply();
});

decreaseText.addEventListener("click", () => {
  if (state.textSize > 50) {
    state.textSize -= 10;
    updateTextSize();
    forceTextResizeOnPage();
  }
});

increaseText.addEventListener("click", () => {
  if (state.textSize < 200) {
    state.textSize += 10;
    updateTextSize();
    forceTextResizeOnPage();
  }
});

resetText.addEventListener("click", () => {
  state.textSize = 100;
  updateTextSize();
  forceTextResizeOnPage();
});

testBtn.addEventListener("click", () => {
  testTTSBackend();
});

// Help button
document.getElementById("helpBtn").addEventListener("click", () => {
  alert(
    "Lansia Friendly Extension\n\nFitur:\n1. 🔊 Mode Suara: Hover di teks untuk mendengar\n2. 🔠 Ukuran Teks: Perbesar/perkecil semua teks\n3. 🖱️ Kursor Besar: Kursor besar untuk visibilitas\n\nPastikan backend berjalan di localhost:8080"
  );
});

// Functions
function loadState() {
  chrome.storage.sync.get(["lansiaSettings"], (result) => {
    if (result.lansiaSettings) {
      Object.assign(state, result.lansiaSettings);
    }
  });
}

function updateUI() {
  globalToggle.checked = state.isActive;
  voiceToggle.checked = state.voiceEnabled;
  cursorToggle.checked = state.cursorEnabled;
  voiceSpeed.value = state.voiceSpeed;
  speedValue.textContent = `${state.voiceSpeed.toFixed(1)}x`;
  cursorSize.value = state.cursorSize;
  cursorSizeValue.textContent = `${state.cursorSize}x`;
  updateStatusText();
  updateTextSizeDisplay();
}

function updateStatusText() {
  statusText.textContent = state.isActive ? "ON" : "OFF";
  statusText.style.color = state.isActive ? "#4cc9f0" : "#f72585";
}

function updateTextSizeDisplay() {
  textSizeValue.textContent = `${state.textSize}%`;
}

function updateTextSize() {
  updateTextSizeDisplay();
  saveAndApply();
}

function saveAndApply() {
  saveState();
  sendStateToContentScript();

  // Force text resize update
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs
        .sendMessage(tabs[0].id, {
          type: "FORCE_TEXT_RESIZE",
          textSize: state.textSize,
        })
        .catch(() => {
          // If content script not ready, reload page
          chrome.tabs.reload(tabs[0].id);
        });
    }
  });
}

function saveState() {
  chrome.storage.sync.set({ lansiaSettings: state });
}

function sendStateToContentScript() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs
        .sendMessage(tabs[0].id, {
          type: "UPDATE_SETTINGS",
          settings: state,
        })
        .catch(() => {
          // Retry injection if content script not loaded
          injectContentScript(tabs[0].id);
        });
    }
  });
}

function injectContentScript(tabId) {
  chrome.scripting
    .executeScript({
      target: { tabId: tabId },
      files: ["content/content.js"],
    })
    .then(() => {
      // Send settings after injection
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, {
          type: "UPDATE_SETTINGS",
          settings: state,
        });
      }, 100);
    });
}

async function checkBackendConnection() {
  try {
    const response = await fetch(`${state.backendUrl}/api/health`);
    if (response.ok) {
      state.backendConnected = true;
      connectionStatus.innerHTML =
        '<div class="status-dot connected"></div><span>Backend: Connected</span>';
    }
  } catch (error) {
    state.backendConnected = false;
    connectionStatus.innerHTML =
      '<div class="status-dot disconnected"></div><span>Backend: Disconnected</span>';
    connectionStatus.querySelector(".status-dot").style.background = "#f72585";
  }
}

async function testTTSBackend() {
  if (!state.backendConnected) {
    alert(
      "Backend tidak terhubung. Pastikan server berjalan di localhost:8080"
    );
    return;
  }

  try {
    const response = await fetch(`${state.backendUrl}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Extension Lansia Friendly bekerja dengan baik. Selamat menggunakan!",
        speed: state.voiceSpeed,
        lang: "id-ID",
      }),
    });

    if (response.ok) {
      alert("✅ Suara test berhasil dikirim ke backend!");
    } else {
      alert("❌ Gagal mengirim test suara");
    }
  } catch (error) {
    alert("❌ Error: " + error.message);
  }
}

// Function untuk force text resize
function forceTextResizeOnPage() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (textSize) => {
          // Force apply text size
          document.documentElement.style.fontSize = textSize + "%";
          document.documentElement.classList.add("lansia-text-resized");

          // Apply to all text elements
          const allElements = document.querySelectorAll("*");
          allElements.forEach((element) => {
            if (
              element.tagName !== "INPUT" &&
              element.tagName !== "TEXTAREA" &&
              element.tagName !== "SELECT" &&
              element.tagName !== "BUTTON"
            ) {
              element.style.fontSize = "inherit";
            }
          });

          // Trigger reflow
          document.body.style.visibility = "hidden";
          document.body.offsetHeight;
          document.body.style.visibility = "visible";

          console.log("📏 Force text resize to:", textSize + "%");
        },
        args: [state.textSize],
      });
    }
  });
}
