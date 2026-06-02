import { DEFAULT_SYSTEM_PROMPT, PROVIDER_MODELS, PROVIDER_DEFAULTS, state } from "./config.js";
import { messagesContainer, chatInput, sendBtn, micBtn, toggleSidebarBtn, sidebar, newChatBtn, chatHistoryList, openSettingsBtn, settingsModal, closeSettingsBtn, providerSelect, apiKeyGroup, apiKeyInput, toggleApiKeyBtn, modelSelect, customModelInput, apiHostGroup, apiHostInput, ttsToggle, voiceSelect, systemPromptInput, clearChatBtn, connectionCheckBtn, statusIndicator, statusText, avatarGlow } from "./dom.js";
import { updateModelDropdown, handleProviderChange, saveSettings, loadSettings, checkProviderStatus } from "./api.js";
import { initChatHistory, saveConversations, createNewConversation, loadConversation, deleteConversation, renderConversationsList, updateConversationHistory, toggleModal, sendMessage } from "./chat.js";
import { loadVoices, normalizeTextForTTS, speakText, stopSpeaking, initSpeechRecognition, toggleListening } from "./audio.js";
import { setupEventListeners, setupSuggestionCards, resetChatHistory, addMessageToUI, scrollToBottom, getCurrentTime, showToast } from "./ui.js";




document.addEventListener("DOMContentLoaded", () => {
  // Initial UI Icons
  lucide.createIcons();

  // Set default system prompt in UI
  systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;

  // Load and apply settings from localStorage
  loadSettings();

  // Initialize Chat History and session lists
  initChatHistory();

  // Check Connection status of the selected provider
  checkProviderStatus();

  // Load Voice Options
  loadVoices();
  if (state.synthesis.onvoiceschanged !== undefined) {
    state.synthesis.onvoiceschanged = loadVoices;
  }

  // Initialize Speech Recognition
  initSpeechRecognition();

  // Add Event Listeners
  setupEventListeners();
});


