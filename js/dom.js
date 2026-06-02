import { DEFAULT_SYSTEM_PROMPT, PROVIDER_MODELS, PROVIDER_DEFAULTS, state } from "./config.js";
import { updateModelDropdown, handleProviderChange, saveSettings, loadSettings, checkProviderStatus } from "./api.js";
import { initChatHistory, saveConversations, createNewConversation, loadConversation, deleteConversation, renderConversationsList, updateConversationHistory, toggleModal, sendMessage } from "./chat.js";
import { loadVoices, normalizeTextForTTS, speakText, stopSpeaking, initSpeechRecognition, toggleListening } from "./audio.js";
import { setupEventListeners, setupSuggestionCards, resetChatHistory, addMessageToUI, scrollToBottom, getCurrentTime, showToast } from "./ui.js";




export const messagesContainer = document.getElementById("messages-container");
export const chatInput = document.getElementById("chat-input");
export const sendBtn = document.getElementById("send-btn");
export const micBtn = document.getElementById("mic-btn");
export const toggleSidebarBtn = document.getElementById("toggle-sidebar");
export const sidebar = document.querySelector(".sidebar");
export const newChatBtn = document.getElementById("new-chat-btn");
export const chatHistoryList = document.getElementById("chat-history-list");
export const openSettingsBtn = document.getElementById("open-settings-btn");
export const settingsModal = document.getElementById("settings-modal");
export const closeSettingsBtn = document.getElementById("close-settings-btn");
export const providerSelect = document.getElementById("provider-select");
export const apiKeyGroup = document.getElementById("api-key-group");
export const apiKeyInput = document.getElementById("api-key-input");
export const toggleApiKeyBtn = document.getElementById("toggle-api-key-btn");
export const modelSelect = document.getElementById("model-select");
export const customModelInput = document.getElementById("custom-model-input");
export const apiHostGroup = document.getElementById("api-host-group");
export const apiHostInput = document.getElementById("api-host-input");
export const ttsToggle = document.getElementById("tts-toggle");
export const voiceSelect = document.getElementById("voice-select");
export const systemPromptInput = document.getElementById("system-prompt");
export const clearChatBtn = document.getElementById("clear-chat-btn");
export const connectionCheckBtn = document.getElementById("connection-check-btn");
export const statusIndicator = document.getElementById("status-indicator");
export const statusText = statusIndicator.querySelector(".status-text");
export const avatarGlow = document.querySelector(".avatar-glow");


