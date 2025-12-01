// State management
const state = {
  isActive: false,
  voiceEnabled: true,
  textSize: 100,
  cursorEnabled: true,
  cursorSize: 2,
  voiceSpeed: 1.0,
};

// DOM Elements
const globalToggle = document.getElementById("globalToggle");
const voiceToggle = document.getElementById("voiceToggle");
const cursorToggle = document.getElementById("cursorToggle");
const decreaseText = document.getElementById("decreaseText");
const increaseText = document.getElementById("increaseText");
const resetText = document.getElementById("resetText");
const textSizeValue = document.getElementById("textSizeValue");
const voiceSpeed = document.getElementById("voiceSpeed");
const speedValue = document.getElementById("speedValue");
const cursorSize = document.getElementById("cursorSize");

// Load saved state
chrome.storage.sync.get(["lansiaSettings"], (result) => {
  if (result.lansiaSettings) {
    Object.assign(state, result.lansiaSettings);
    updateUI();
  }
});

// Event Listeners
globalToggle.addEventListener("change", (e) => {
  state.isActive = e.target.checked;
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

voiceSpeed.addEventListener("input", (e) => {
  state.voiceSpeed = parseFloat(e.target.value);
  speedValue.textContent = `${state.voiceSpeed.toFixed(1)}x`;
  saveState();
});

cursorSize.addEventListener("input", (e) => {
  state.cursorSize = parseFloat(e.target.value);
  saveState();
  sendStateToContentScript();
});

// Functions
function updateUI() {
  globalToggle.checked = state.isActive;
  voiceToggle.checked = state.voiceEnabled;
  cursorToggle.checked = state.cursorEnabled;
  textSizeValue.textContent = `${state.textSize}%`;
  voiceSpeed.value = state.voiceSpeed;
  speedValue.textContent = `${state.voiceSpeed.toFixed(1)}x`;
  cursorSize.value = state.cursorSize;
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
    if (tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "UPDATE_SETTINGS",
        settings: state,
      });
    }
  });
}
