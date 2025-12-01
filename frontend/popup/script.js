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

// Load saved state
chrome.storage.sync.get(["lansiaSettings"], (result) => {
  if (result.lansiaSettings) {
    Object.assign(state, result.lansiaSettings);
    updateUI();
  }
  checkBackendConnection();
});

// Event Listeners
globalToggle.addEventListener("change", (e) => {
  state.isActive = e.target.checked;
  statusText.textContent = state.isActive ? "ON" : "OFF";
  statusText.style.color = state.isActive ? "#4cc9f0" : "#f72585";
  saveState();
  sendStateToContentScript();
});

voiceToggle.addEventListener("change", (e) => {
  state.voiceEnabled = e.target.checked;
  saveState();
  sendStateToContentScript();
});

cursorToggle.addEventListener("change", (e) => {
  state.cursorEnabled = e.target.checked;
  saveState();
  sendStateToContentScript();
});

voiceSpeed.addEventListener("input", (e) => {
  state.voiceSpeed = parseFloat(e.target.value);
  speedValue.textContent = `${state.voiceSpeed.toFixed(1)}x`;
  saveState();
  sendStateToContentScript();
});

cursorSize.addEventListener("input", (e) => {
  state.cursorSize = parseFloat(e.target.value);
  cursorSizeValue.textContent = `${state.cursorSize}x`;
  saveState();
  sendStateToContentScript();
});

decreaseText.addEventListener("click", () => {
  if (state.textSize > 50) {
    state.textSize -= 10;
    updateTextSize();
  }
});

increaseText.addEventListener("click", () => {
  if (state.textSize < 200) {
    state.textSize += 10;
    updateTextSize();
  }
});

resetText.addEventListener("click", () => {
  state.textSize = 100;
  updateTextSize();
});

testBtn.addEventListener("click", () => {
  testTTSBackend();
});

// Functions
function updateUI() {
  globalToggle.checked = state.isActive;
  voiceToggle.checked = state.voiceEnabled;
  cursorToggle.checked = state.cursorEnabled;
  voiceSpeed.value = state.voiceSpeed;
  speedValue.textContent = `${state.voiceSpeed.toFixed(1)}x`;
  cursorSize.value = state.cursorSize;
  cursorSizeValue.textContent = `${state.cursorSize}x`;
  textSizeValue.textContent = `${state.textSize}%`;
  statusText.textContent = state.isActive ? "ON" : "OFF";
  statusText.style.color = state.isActive ? "#4cc9f0" : "#f72585";
}

function updateTextSize() {
  textSizeValue.textContent = `${state.textSize}%`;
  saveState();
  sendStateToContentScript();
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
          // Tab might not have content script yet
          console.log("Content script not ready");
        });
    }
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
      '<div class="status-dot" style="background: #f72585;"></div><span>Backend: Disconnected</span>';
    console.warn("Backend connection failed:", error);
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

// Initialize
updateUI();
