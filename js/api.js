import { DEFAULT_SYSTEM_PROMPT, PROVIDER_MODELS, PROVIDER_DEFAULTS, state } from "./config.js";
import { messagesContainer, chatInput, sendBtn, micBtn, toggleSidebarBtn, sidebar, newChatBtn, chatHistoryList, openSettingsBtn, settingsModal, closeSettingsBtn, providerSelect, apiKeyGroup, apiKeyInput, toggleApiKeyBtn, modelSelect, customModelInput, apiHostGroup, apiHostInput, ttsToggle, voiceSelect, systemPromptInput, clearChatBtn, connectionCheckBtn, statusIndicator, statusText, avatarGlow } from "./dom.js";
import { initChatHistory, saveConversations, createNewConversation, loadConversation, deleteConversation, renderConversationsList, updateConversationHistory, toggleModal, sendMessage } from "./chat.js";
import { loadVoices, normalizeTextForTTS, speakText, stopSpeaking, initSpeechRecognition, toggleListening } from "./audio.js";
import { setupEventListeners, setupSuggestionCards, resetChatHistory, addMessageToUI, scrollToBottom, getCurrentTime, showToast } from "./ui.js";




export function updateModelDropdown(provider, selectedModel = null) {
  modelSelect.innerHTML = "";
  const models = PROVIDER_MODELS[provider] || [];
  models.forEach((model) => {
    const opt = document.createElement("option");
    opt.value = model.value;
    opt.textContent = model.text;
    if (selectedModel && model.value === selectedModel) {
      opt.selected = true;
    }
    modelSelect.appendChild(opt);
  });
}

export function handleProviderChange() {
  const provider = providerSelect.value;
  
  // Show/hide API Key and Host groups
  if (provider === "ollama") {
    apiKeyGroup.classList.add("hidden");
    apiHostGroup.classList.add("hidden");
  } else if (provider === "custom") {
    apiKeyGroup.classList.remove("hidden");
    apiHostGroup.classList.remove("hidden");
  } else {
    apiKeyGroup.classList.remove("hidden");
    apiHostGroup.classList.add("hidden");
  }
  
  // Apply default host
  const defaults = PROVIDER_DEFAULTS[provider] || {};
  apiHostInput.value = defaults.host || "";
  
  // Update models
  updateModelDropdown(provider, defaults.model);
  
  // Toggle custom model input visibility
  if (modelSelect.value === "custom") {
    customModelInput.classList.remove("hidden");
  } else {
    customModelInput.classList.add("hidden");
  }
  customModelInput.value = "";
  
  saveSettings();
  checkProviderStatus();
}

export function saveSettings() {
  localStorage.setItem("sora_provider", providerSelect.value);
  localStorage.setItem("sora_api_key", apiKeyInput.value);
  localStorage.setItem("sora_model", modelSelect.value);
  localStorage.setItem("sora_custom_model", customModelInput.value);
  localStorage.setItem("sora_api_host", apiHostInput.value);
  localStorage.setItem("sora_tts_enabled", ttsToggle.checked);
  localStorage.setItem("sora_voice", voiceSelect.value);
}

export function loadSettings() {
  const savedProvider = localStorage.getItem("sora_provider") || "ollama";
  const savedApiKey = localStorage.getItem("sora_api_key") || "";
  const savedModel = localStorage.getItem("sora_model") || "";
  const savedCustomModel = localStorage.getItem("sora_custom_model") || "";
  const savedApiHost = localStorage.getItem("sora_api_host") || "";

  const savedTtsEnabled = localStorage.getItem("sora_tts_enabled");
  if (savedTtsEnabled !== null) {
    ttsToggle.checked = savedTtsEnabled === "true";
  }

  providerSelect.value = savedProvider;
  apiKeyInput.value = savedApiKey;

  if (savedProvider === "ollama") {
    apiKeyGroup.classList.add("hidden");
    apiHostGroup.classList.add("hidden");
  } else if (savedProvider === "custom") {
    apiKeyGroup.classList.remove("hidden");
    apiHostGroup.classList.remove("hidden");
  } else {
    apiKeyGroup.classList.remove("hidden");
    apiHostGroup.classList.add("hidden");
  }

  apiHostInput.value = savedApiHost || (PROVIDER_DEFAULTS[savedProvider]?.host || "");

  updateModelDropdown(savedProvider, savedModel);

  if (savedModel === "custom") {
    customModelInput.classList.remove("hidden");
    customModelInput.value = savedCustomModel;
  } else {
    customModelInput.classList.add("hidden");
    customModelInput.value = "";
  }
}

export async function checkProviderStatus() {
  const provider = providerSelect.value;
  statusIndicator.className = "status-badge status-thinking";
  connectionCheckBtn.classList.add("loading");

  if (provider === "ollama") {
    statusText.textContent = "Mengecek Ollama...";
    try {
      // Ollama check base
      const host = apiHostInput.value.replace(/\/v1\/?$/, ""); // Remove /v1 for native api/tags
      const response = await fetch(`${host}/api/tags`);
      if (response.ok) {
        state.isConnected = true;
        statusIndicator.className = "status-badge status-online";
        statusText.textContent = "Online";
      } else {
        throw new Error("Koneksi gagal");
      }
    } catch (error) {
      state.isConnected = false;
      statusIndicator.className = "status-badge status-offline";
      statusText.textContent = "Offline";
      showToast(
        "Ollama belum aktif. Pastikan aplikasi Ollama di laptop Anda sudah berjalan.",
        "error",
      );
    } finally {
      connectionCheckBtn.classList.remove("loading");
    }
  } else {
    // Cloud API Provider
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      state.isConnected = false;
      statusIndicator.className = "status-badge status-offline";
      statusText.textContent = "API Key Diperlukan";
    } else {
      state.isConnected = true;
      statusIndicator.className = "status-badge status-online";
      statusText.textContent = "Online";
    }
    connectionCheckBtn.classList.remove("loading");
  }
}


