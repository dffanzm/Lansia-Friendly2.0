// Background script - runs in background
console.log("🎯 Lansia Friendly Background script loaded");

// Set default settings on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");

  chrome.storage.sync.set({
    lansiaSettings: {
      isActive: true,
      voiceEnabled: true,
      textSize: 100,
      cursorEnabled: true,
      cursorSize: 2,
      voiceSpeed: 1.0,
      backendUrl: "http://localhost:8080",
    },
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  if (message.type === "GET_SETTINGS") {
    chrome.storage.sync.get(["lansiaSettings"], (result) => {
      sendResponse(result.lansiaSettings || {});
    });
    return true; // Will respond asynchronously
  }
});
