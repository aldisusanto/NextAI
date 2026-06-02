import { DEFAULT_SYSTEM_PROMPT, PROVIDER_MODELS, PROVIDER_DEFAULTS, state } from "./config.js";
import { messagesContainer, chatInput, sendBtn, micBtn, toggleSidebarBtn, sidebar, newChatBtn, chatHistoryList, openSettingsBtn, settingsModal, closeSettingsBtn, providerSelect, apiKeyGroup, apiKeyInput, toggleApiKeyBtn, modelSelect, customModelInput, apiHostGroup, apiHostInput, ttsToggle, voiceSelect, systemPromptInput, clearChatBtn, connectionCheckBtn, statusIndicator, statusText, avatarGlow } from "./dom.js";
import { updateModelDropdown, handleProviderChange, saveSettings, loadSettings, checkProviderStatus } from "./api.js";
import { initChatHistory, saveConversations, createNewConversation, loadConversation, deleteConversation, renderConversationsList, updateConversationHistory, toggleModal, sendMessage } from "./chat.js";
import { loadVoices, normalizeTextForTTS, speakText, stopSpeaking, initSpeechRecognition, toggleListening } from "./audio.js";




export function setupEventListeners() {
  // Send Message on click
  sendBtn.addEventListener("click", sendMessage);

  // Send Message on Enter (Shift+Enter for new line)
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-grow input textarea
  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = chatInput.scrollHeight + "px";
  });

  // Toggle mic
  micBtn.addEventListener("click", toggleListening);

  // Connection refresh / check status
  connectionCheckBtn.addEventListener("click", checkProviderStatus);

  // Toggle Sidebar
  toggleSidebarBtn.addEventListener("click", () => {
    sidebar.classList.toggle("closed");
    const isClosed = sidebar.classList.contains("closed");
    toggleSidebarBtn.innerHTML = `<i data-lucide="${isClosed ? 'menu' : 'panel-left'}"></i>`;
    if (window.lucide) {
      lucide.createIcons();
    }
  });

  // Modal Settings events
  openSettingsBtn.addEventListener("click", () => toggleModal(true));
  closeSettingsBtn.addEventListener("click", () => toggleModal(false));
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) {
      toggleModal(false);
    }
  });

  // New Chat Button
  newChatBtn.addEventListener("click", createNewConversation);

  // Provider Select listener
  providerSelect.addEventListener("change", handleProviderChange);

  // API Key Toggle Eye button
  toggleApiKeyBtn.addEventListener("click", () => {
    const isPassword = apiKeyInput.type === "password";
    apiKeyInput.type = isPassword ? "text" : "password";
    const icon = toggleApiKeyBtn.querySelector("i");
    icon.setAttribute("data-lucide", isPassword ? "eye-off" : "eye");
    lucide.createIcons();
  });

  // Kredensial input changes
  apiKeyInput.addEventListener("input", saveSettings);
  apiHostInput.addEventListener("input", saveSettings);
  customModelInput.addEventListener("input", saveSettings);

  // Model Select customization
  modelSelect.addEventListener("change", () => {
    if (modelSelect.value === "custom") {
      customModelInput.classList.remove("hidden");
    } else {
      customModelInput.classList.add("hidden");
    }
    saveSettings();
  });

  // TTS and Voice Selection listener
  ttsToggle.addEventListener("change", saveSettings);
  voiceSelect.addEventListener("change", saveSettings);

  // Clear Chat (Hapus Semua Sesi Obrolan)
  clearChatBtn.addEventListener("click", () => {
    if (confirm("Yakin ingin menghapus semua sesi obrolan? Tindakan ini tidak bisa dibatalkan.")) {
      stopSpeaking();
      state.conversations = [];
      saveConversations();
      createNewConversation();
      toggleModal(false);
      showToast("Semua sesi obrolan telah dihapus.", "success");
    }
  });

  // System Prompt modification live update
  systemPromptInput.addEventListener("change", () => {
    if (state.chatHistory[0] && state.chatHistory[0].role === "system") {
      state.chatHistory[0].content = systemPromptInput.value;
    } else {
      state.chatHistory.unshift({ role: "system", content: systemPromptInput.value });
    }
    updateConversationHistory();
    showToast("Karakter NAI berhasil diperbarui!", "success");
  });

  // Initialize suggestion card listeners
  setupSuggestionCards();
}

export function setupSuggestionCards() {
  document.querySelectorAll(".suggestion-card").forEach((card) => {
    card.addEventListener("click", () => {
      const promptText = card.querySelector("p").textContent.replace(/"/g, "");
      chatInput.value = promptText;
      chatInput.style.height = "auto";
      chatInput.style.height = chatInput.scrollHeight + "px";
      chatInput.focus();
    });
  });
}

export function resetChatHistory() {
  const sysPrompt = systemPromptInput
    ? systemPromptInput.value
    : DEFAULT_SYSTEM_PROMPT;
  state.chatHistory = [{ role: "system", content: sysPrompt }];
}

export function addMessageToUI(sender, text) {
  // Remove welcome box if present
  const welcome = messagesContainer.querySelector(".welcome-box");
  if (welcome) welcome.remove();

  const wrapper = document.createElement("div");
  wrapper.className = `message-wrapper ${sender}`;

  const bubbleContainer = document.createElement("div");
  bubbleContainer.className = "message-bubble-container";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;

  const timeSpan = document.createElement("span");
  timeSpan.className = "message-time";
  timeSpan.textContent = getCurrentTime();

  bubbleContainer.appendChild(bubble);
  bubbleContainer.appendChild(timeSpan);
  wrapper.appendChild(bubbleContainer);
  messagesContainer.appendChild(wrapper);

  scrollToBottom();
}

export function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

export function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.style.position = "fixed";
  toast.style.bottom = "24px";
  toast.style.right = "24px";
  toast.style.padding = "12px 20px";
  toast.style.borderRadius = "10px";
  toast.style.fontSize = "14px";
  toast.style.fontWeight = "500";
  toast.style.zIndex = "1000";
  toast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
  toast.style.animation = "fade-in 0.3s ease-out";
  toast.style.display = "flex";
  toast.style.alignItems = "center";
  toast.style.gap = "8px";
  toast.style.border = "1px solid rgba(255,255,255,0.08)";

  if (type === "error") {
    toast.style.backgroundColor = "#ef4444";
    toast.style.color = "#ffffff";
  } else if (type === "success") {
    toast.style.backgroundColor = "#10b981";
    toast.style.color = "#ffffff";
  } else {
    // info
    toast.style.backgroundColor = "#1e1b4b";
    toast.style.color = "#c7d2fe";
    toast.style.borderColor = "#4338ca";
  }

  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "animate-pulse 0.3s ease-out reverse";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

