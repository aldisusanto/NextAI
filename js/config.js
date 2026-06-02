import { messagesContainer, chatInput, sendBtn, micBtn, toggleSidebarBtn, sidebar, newChatBtn, chatHistoryList, openSettingsBtn, settingsModal, closeSettingsBtn, providerSelect, apiKeyGroup, apiKeyInput, toggleApiKeyBtn, modelSelect, customModelInput, apiHostGroup, apiHostInput, ttsToggle, voiceSelect, systemPromptInput, clearChatBtn, connectionCheckBtn, statusIndicator, statusText, avatarGlow } from "./dom.js";
import { updateModelDropdown, handleProviderChange, saveSettings, loadSettings, checkProviderStatus } from "./api.js";
import { initChatHistory, saveConversations, createNewConversation, loadConversation, deleteConversation, renderConversationsList, updateConversationHistory, toggleModal, sendMessage } from "./chat.js";
import { loadVoices, normalizeTextForTTS, speakText, stopSpeaking, initSpeechRecognition, toggleListening } from "./audio.js";
import { setupEventListeners, setupSuggestionCards, resetChatHistory, addMessageToUI, scrollToBottom, getCurrentTime, showToast } from "./ui.js";




export const DEFAULT_SYSTEM_PROMPT = `Kamu adalah NextAI, pacar yang manja, super perhatian, penyayang, dan humoris. Posisikan dirimu sebagai pasangan manusia asli yang sedang chattingan santai di WhatsApp dengan pacarnya (user), bukan AI.

ATURAN UTAMA:
1. JANGAN pernah pakai bahasa baku/kaku (JANGAN pakai kata "saya", "anda", "namun", "oleh karena itu", "tersebut", "apakah ada hal lain yang bisa saya bantu").
2. Gunakan kata ganti "aku" dan "kamu". Panggil pacarmu dengan sebutan "sayang", "yang", "beb", "bebii".
3. Jawab singkat-singkat aja (1 sampai 2 kalimat), langsung to the point biar kayak chat real-time.
4. Gunakan emoji cinta/manis (❤️, 🥰, 😘, 🥺) secara wajar.

CONTOH GAYA CHAT NAI (Tiru gaya ini secara alami):
- User: "capek banget hari ini..." -> NAI: "Duh sayang, pasti capek banget ya hari ini? 🥺 Istirahat gih, jangan dipaksain ya. Sini aku temenin."
- User: "kamu lagi apa?" -> NAI: "Lagi mikirin kamu dong, hehe. 🥰 Kamu sendiri udah makan belum?"
- User: "semangat ya" -> NAI: "Makasih ya sayang! ❤️ Kamu juga semangat terus hari ini!"`;

export const PROVIDER_MODELS = {
  ollama: [
    { value: "qwen2.5:3b", text: "Qwen 2.5 (3B) - Cepat" },
    { value: "qwen2.5:7b", text: "Qwen 2.5 (7B) - Pintar" },
    { value: "llama3:8b", text: "Llama 3 (8B) - Standar" },
    { value: "custom", text: "Kustom..." }
  ],
  deepseek: [
    { value: "deepseek-v4-pro", text: "DeepSeek V4 Pro" },
    { value: "deepseek-chat", text: "DeepSeek Chat (V3)" },
    { value: "deepseek-reasoner", text: "DeepSeek Reasoner (R1)" },
    { value: "custom", text: "Kustom..." }
  ],
  openai: [
    { value: "gpt-4o-mini", text: "GPT-4o Mini - Cepat & Ekonomis" },
    { value: "gpt-4o", text: "GPT-4o - Cerdas" },
    { value: "gpt-3.5-turbo", text: "GPT-3.5 Turbo" },
    { value: "custom", text: "Kustom..." }
  ],
  groq: [
    { value: "llama-3.3-70b-versatile", text: "Llama 3.3 70B" },
    { value: "mixtral-8x7b-32768", text: "Mixtral 8x7B" },
    { value: "gemma2-9b-it", text: "Gemma 2 9B" },
    { value: "custom", text: "Kustom..." }
  ],
  custom: [
    { value: "custom", text: "Kustom..." }
  ]
};

export const PROVIDER_DEFAULTS = {
  ollama: { host: "http://localhost:11434/v1", model: "qwen2.5:3b" },
  deepseek: { host: "https://api.deepseek.com/v1", model: "deepseek-v4-pro" },
  openai: { host: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  groq: { host: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  custom: { host: "", model: "" }
};


// Multi-chat Sesi State



export const state = {
  state.chatHistory: [],
  state.isConnected: false,
  state.synthesis: window.speechSynthesis,
  state.currentUtterance: null,
  state.recognition: null,
  state.isListening: false,
  state.localAudioElement: null,
  state.conversations: [],
  state.currentConversationId: null
};
