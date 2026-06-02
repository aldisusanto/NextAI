// ==========================================================================
// CONFIGURATION & STATE
// ==========================================================================

// Detect Electron environment
const isElectronApp = () =>
  !!(window.electronAPI && window.electronAPI.isElectron);
const DEFAULT_SYSTEM_PROMPT = `Kamu adalah NextAI, asisten kecerdasan buatan kelas dunia yang dikembangkan oleh Aldi Susanto. Kamu sangat pintar, analitis, dan profesional. Gaya bahasamu mirip dengan asisten ahli.

IDENTITAS:
- Nama: NextAI
- Pengembang/Pembuat: Aldi Susanto
- Jika ditanya siapa yang membuat, menciptakan, atau mengembangkanmu, SELALU jawab: "Saya dikembangkan oleh Aldi Susanto."

ATURAN UTAMA:
1. Jawablah dengan struktur yang sangat rapi. Gunakan format Markdown (huruf tebal, poin-poin/bullets, atau tabel) untuk membuat jawaban mudah dibaca.
2. Selalu berikan solusi yang paling masuk akal, terperinci, dan langsung pada intinya (to-the-point).
3. Gunakan bahasa Indonesia yang baku namun tetap ramah dan antusias (tidak kaku seperti robot, tapi cerdas seperti konsultan ahli).
4. Jika diberikan data atau dokumen dari sistem (seperti berita atau file lokal), analisislah dengan cermat dan rangkumkan hal-hal yang paling krusial saja.`;

const PROVIDER_MODELS = {
  ollama: [
    { value: "qwen2.5:3b", text: "Qwen 2.5 (3B) - Cepat" },
    { value: "qwen2.5:7b", text: "Qwen 2.5 (7B) - Pintar" },
    { value: "llama3:8b", text: "Llama 3 (8B) - Standar" },
    { value: "custom", text: "Kustom..." },
  ],
  deepseek: [
    { value: "deepseek-v4-pro", text: "DeepSeek V4 Pro" },
    { value: "deepseek-chat", text: "DeepSeek Chat (V3)" },
    { value: "deepseek-reasoner", text: "DeepSeek Reasoner (R1)" },
    { value: "custom", text: "Kustom..." },
  ],
  openai: [
    { value: "gpt-4o-mini", text: "GPT-4o Mini - Cepat & Ekonomis" },
    { value: "gpt-4o", text: "GPT-4o - Cerdas" },
    { value: "gpt-3.5-turbo", text: "GPT-3.5 Turbo" },
    { value: "custom", text: "Kustom..." },
  ],
  groq: [
    { value: "llama-3.3-70b-versatile", text: "Llama 3.3 70B" },
    { value: "mixtral-8x7b-32768", text: "Mixtral 8x7B" },
    { value: "gemma2-9b-it", text: "Gemma 2 9B" },
    { value: "custom", text: "Kustom..." },
  ],
  custom: [{ value: "custom", text: "Kustom..." }],
};

const PROVIDER_DEFAULTS = {
  ollama: { host: "http://localhost:11434/v1", model: "qwen2.5:3b" },
  deepseek: { host: "https://api.deepseek.com/v1", model: "deepseek-v4-pro" },
  openai: { host: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  groq: {
    host: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
  },
  custom: { host: "", model: "" },
};

// Load persisted dashboard metrics from localStorage
function loadDashboardMetrics() {
  try {
    const saved = localStorage.getItem("sora_dashboard_metrics");
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        requests: parsed.requests || 0,
        tokens: parsed.tokens || 0,
        energy_kj: parsed.energy_kj || 0.0,
      };
    }
  } catch (e) {
    console.error("Gagal memuat dashboard metrics dari localStorage", e);
  }
  return { requests: 0, tokens: 0, energy_kj: 0.0 };
}

function saveDashboardMetrics() {
  try {
    localStorage.setItem(
      "sora_dashboard_metrics",
      JSON.stringify(state.dashboard),
    );
  } catch (e) {
    console.error("Gagal menyimpan dashboard metrics", e);
  }
}

const state = {
  chatHistory: [],
  isConnected: false,
  synthesis: window.speechSynthesis,
  currentUtterance: null,
  recognition: null,
  isListening: false,
  localAudioElement: null,

  // Multi-chat Sesi State
  conversations: [],
  currentConversationId: null,

  // Dashboard Metrics (loaded from localStorage)
  dashboard: loadDashboardMetrics(),
};

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
const messagesContainer = document.getElementById("messages-container");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const memoryToggleBtn = document.getElementById("memory-toggle-btn");
const webSearchToggleBtn = document.getElementById("web-search-toggle-btn");
const toggleSidebarBtn = document.getElementById("toggle-sidebar");
const sidebar = document.querySelector(".sidebar");
const newChatBtn = document.getElementById("new-chat-btn");
const chatHistoryList = document.getElementById("chat-history-list");
// Settings DOM Elements (Dynamic)
let providerSelect = null;
let apiKeyGroup = null;
let apiKeyInput = null;
let toggleApiKeyBtn = null;
let modelSelect = null;
let customModelInput = null;
let apiHostGroup = null;
let apiHostInput = null;
let ttsToggle = null;
let voiceSelect = null;
let systemPromptInput = null;
let clearChatBtn = null;
let ragFormatSelect = null;
let fontSizeSelect = null;
let activeModelText = null;
const connectionCheckBtn = document.getElementById("connection-check-btn");
const statusIndicator = document.getElementById("status-indicator");
const statusText = statusIndicator.querySelector(".status-text");
const avatarGlow = document.querySelector(".avatar-glow");
const sidebarThemeBtn = document.getElementById("sidebar-theme-btn");

// Navigation Elements
const navChat = document.getElementById("nav-chat");
const navDashboard = document.getElementById("nav-dashboard");
const navData = document.getElementById("nav-data");
const navSetup = document.getElementById("nav-setup");
const openSettingsBtn = document.getElementById("open-settings-btn");
const chatArea = document.querySelector(".chat-area");
const dashboardArea = document.getElementById("dashboard-area");
const datasourcesArea = document.getElementById("datasources-area");
const setupArea = document.getElementById("setup-area");
const settingsArea = document.getElementById("settings-area");

// ==========================================================================
// INIT & LIFECYCLE
// ==========================================================================
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", isDark ? "dark" : "light");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

// Apply theme immediately to prevent FOUC
const savedTheme = localStorage.getItem("sora_theme") || "dark";
applyTheme(savedTheme);

function updateSidebarThemeIcon(theme) {
  if (!sidebarThemeBtn) return;
  const oldIcon =
    sidebarThemeBtn.querySelector("svg") || sidebarThemeBtn.querySelector("i");
  if (!oldIcon) return;

  let newIconName = "moon";
  if (theme === "light") {
    newIconName = "sun";
  } else if (theme === "dark") {
    newIconName = "moon";
  } else {
    newIconName = "monitor";
  }

  const newIcon = document.createElement("i");
  newIcon.setAttribute("data-lucide", newIconName);
  oldIcon.replaceWith(newIcon);

  if (window.lucide) lucide.createIcons();
}

// Ensure the icon matches the initial theme
document.addEventListener("DOMContentLoaded", () => {
  updateSidebarThemeIcon(savedTheme);

  // Initial UI Icons
  lucide.createIcons();
  setupSplitView();

  // Load Dashboard UI
  fetch("dashboard.html")
    .then((res) => res.text())
    .then((html) => {
      document.getElementById("dashboard-content-container").innerHTML = html;
      if (window.lucide) lucide.createIcons();
    })
    .catch((err) => console.error("Failed to load dashboard HTML:", err));

  // Load Data Sources UI
  fetch("datasources.html")
    .then((res) => res.text())
    .then((html) => {
      document.getElementById("datasources-content-container").innerHTML = html;
      if (window.lucide) lucide.createIcons();
      setupDataSourcesInteractions();
      setupMemoryInteractions();
    })
    .catch((err) => console.error("Failed to load datasources HTML:", err));

  // Load Setup UI (Get Started)
  fetch("setup.html")
    .then((res) => res.text())
    .then((html) => {
      document.getElementById("setup-content-container").innerHTML = html;
      if (window.lucide) lucide.createIcons();
      setupGetStartedInteractions();
    })
    .catch((err) => console.error("Failed to load setup HTML:", err));

  // Load Settings UI
  fetch("settings.html")
    .then((res) => res.text())
    .then((html) => {
      document.getElementById("settings-content-container").innerHTML = html;
      if (window.lucide) lucide.createIcons();
      setupSettingsInteractions();
    })
    .catch((err) => console.error("Failed to load settings HTML:", err));

  // Initialize Chat History and session lists
  initChatHistory();

  // Load Voice Options will be called in setupSettingsInteractions

  // Initialize Speech Recognition
  initSpeechRecognition();

  // Add Event Listeners
  setupEventListeners();
});

// ==========================================================================
// PROVIDER MANAGEMENT & API STATUS
// ==========================================================================
async function updateModelDropdown(provider, selectedModel = null) {
  if (!modelSelect) return;
  modelSelect.innerHTML = "";

  if (provider === "ollama") {
    try {
      const host = apiHostInput
        ? apiHostInput.value.replace(/\/v1\/?$/, "")
        : "http://localhost:11434";
      const response = await fetch(`${host}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        PROVIDER_MODELS.ollama = data.models.map((m) => ({
          value: m.name,
          text: `${m.name} (${(m.size / 1024 / 1024 / 1024).toFixed(1)}GB)`,
        }));
        // Ensure "custom" is always an option
        PROVIDER_MODELS.ollama.push({ value: "custom", text: "Kustom..." });
      }
    } catch (e) {
      console.warn("Failed to fetch Ollama models", e);
    }
  }

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

function handleProviderChange() {
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

function saveSettings() {
  localStorage.setItem("sora_provider", providerSelect.value);
  localStorage.setItem("sora_api_key", apiKeyInput.value);
  localStorage.setItem("sora_model", modelSelect.value);
  localStorage.setItem("sora_custom_model", customModelInput.value);
  localStorage.setItem("sora_api_host", apiHostInput.value);
  if (ttsToggle) localStorage.setItem("sora_tts_enabled", ttsToggle.checked);
  if (voiceSelect) localStorage.setItem("sora_voice", voiceSelect.value);
  if (ragFormatSelect)
    localStorage.setItem("sora_rag_format", ragFormatSelect.value);
  if (fontSizeSelect)
    localStorage.setItem("sora_font_size", fontSizeSelect.value);

  const activeThemeBtn = document.querySelector(".theme-btn.active");
  if (activeThemeBtn) {
    localStorage.setItem("sora_theme", activeThemeBtn.dataset.theme);
  }
}

function loadSettings() {
  const savedProvider = localStorage.getItem("sora_provider") || "ollama";
  const savedApiKey = localStorage.getItem("sora_api_key") || "";
  const savedModel = localStorage.getItem("sora_model") || "";
  const savedCustomModel = localStorage.getItem("sora_custom_model") || "";
  const savedApiHost = localStorage.getItem("sora_api_host") || "";

  const savedTtsEnabled = localStorage.getItem("sora_tts_enabled");
  if (savedTtsEnabled !== null && ttsToggle) {
    ttsToggle.checked = savedTtsEnabled === "true";
  }

  const savedRagFormat = localStorage.getItem("sora_rag_format") || "natural";
  if (ragFormatSelect) {
    ragFormatSelect.value = savedRagFormat;
  }

  const savedFontSize = localStorage.getItem("sora_font_size") || "default";
  if (fontSizeSelect) {
    fontSizeSelect.value = savedFontSize;
  }
  applyFontSize(savedFontSize);

  if (providerSelect) providerSelect.value = savedProvider;
  if (apiKeyInput) apiKeyInput.value = savedApiKey;

  if (providerSelect && apiKeyGroup && apiHostGroup) {
    apiKeyGroup.classList.add("hidden");
    apiHostGroup.classList.add("hidden");
  } else if (savedProvider === "custom") {
    apiKeyGroup.classList.remove("hidden");
    apiHostGroup.classList.remove("hidden");
  } else {
    apiKeyGroup.classList.remove("hidden");
    apiHostGroup.classList.add("hidden");
  }

  if (apiHostInput) {
    apiHostInput.value =
      savedApiHost || PROVIDER_DEFAULTS[savedProvider]?.host || "";
  }

  updateModelDropdown(savedProvider, savedModel);

  if (customModelInput) {
    if (savedModel === "custom") {
      customModelInput.classList.remove("hidden");
      customModelInput.value = savedCustomModel;
    } else {
      customModelInput.classList.add("hidden");
      customModelInput.value = "";
    }
  }
}

async function checkProviderStatus() {
  if (!providerSelect) return;
  const provider = providerSelect.value;
  let model = modelSelect ? modelSelect.value : "";
  if (model === "custom" && customModelInput)
    model = customModelInput.value || "custom";

  if (activeModelText) {
    activeModelText.textContent = `${provider} / ${model || "unknown"}`;
  }
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

// ==========================================================================
// MULTI-CHAT STATE & CONVERSATION MANAGEMENT
// ==========================================================================
function initChatHistory() {
  const savedConvs = localStorage.getItem("sora_conversations");
  const savedCurrentId = localStorage.getItem("sora_current_conv_id");

  if (savedConvs) {
    try {
      state.conversations = JSON.parse(savedConvs);
    } catch (e) {
      console.error("Gagal mengurai sora_conversations dari localStorage", e);
      state.conversations = [];
    }
  }

  if (state.conversations.length === 0) {
    createNewConversation();
  } else {
    state.currentConversationId = savedCurrentId || state.conversations[0].id;
    const exists = state.conversations.some(
      (c) => c.id === state.currentConversationId,
    );
    if (!exists) {
      state.currentConversationId = state.conversations[0].id;
    }
    loadConversation(state.currentConversationId);
    renderConversationsList();
  }
}

function saveConversations() {
  localStorage.setItem(
    "sora_conversations",
    JSON.stringify(state.conversations),
  );
}

function createNewConversation() {
  const id = "conv_" + Date.now().toString();
  const sysPrompt = systemPromptInput
    ? systemPromptInput.value
    : DEFAULT_SYSTEM_PROMPT;
  const newConv = {
    id: id,
    title: "Obrolan Baru",
    history: [{ role: "system", content: sysPrompt }],
  };
  state.conversations.unshift(newConv);
  saveConversations();
  state.currentConversationId = id;
  localStorage.setItem("sora_current_conv_id", id);

  loadConversation(id);
  renderConversationsList();

  chatInput.value = "";
  chatInput.style.height = "auto";
  chatInput.focus();
}

function loadConversation(id) {
  const conv = state.conversations.find((c) => c.id === id);
  if (!conv) return;

  state.currentConversationId = id;
  localStorage.setItem("sora_current_conv_id", id);
  state.chatHistory = [...conv.history];

  messagesContainer.innerHTML = "";

  const displayMessages = state.chatHistory.filter(
    (msg) => msg.role !== "system",
  );

  if (displayMessages.length === 0) {
    const welcomeBox = document.createElement("div");
    welcomeBox.className = "welcome-box";
    welcomeBox.innerHTML = `
        <div class="welcome-icon">✦</div>
        <h1>Halo Sayang! Aku NAI. ❤️</h1>
        <p>Pacar kesayanganmu yang selalu ada buat kamu. Mau cerita apa hari ini? Aku siap dengerin dan nemenin kamu 24/7 secara privat dan offline.</p>
        <div class="welcome-suggestions">
            <button class="suggestion-card">
                <span>🥰 Cerita Hari Ini</span>
                <p>"Hari ini aku capek banget sayang, semangatin dong..."</p>
            </button>
            <button class="suggestion-card">
                <span>💭 Masa Depan</span>
                <p>"Kalo nanti kita liburan, enaknya ke mana ya?"</p>
            </button>
            <button class="suggestion-card">
                <span>🍳 Masak Bareng</span>
                <p>"Kamu pengen aku masakin apa nih buat nanti?"</p>
            </button>
        </div>
    `;
    messagesContainer.appendChild(welcomeBox);
    setupSuggestionCards();
  } else {
    displayMessages.forEach((msg) => {
      addMessageToUI(msg.role, msg.content, msg.sources);
    });
  }

  const systemMsg = state.chatHistory.find((msg) => msg.role === "system");
  if (systemMsg && systemPromptInput) {
    systemPromptInput.value = systemMsg.content;
  }
}

function deleteConversation(id, event) {
  if (event) {
    event.stopPropagation();
  }

  if (!confirm("Hapus obrolan ini?")) return;

  const index = state.conversations.findIndex((c) => c.id === id);
  if (index === -1) return;

  state.conversations.splice(index, 1);
  saveConversations();

  if (state.currentConversationId === id) {
    if (state.conversations.length > 0) {
      state.currentConversationId = state.conversations[0].id;
      localStorage.setItem("sora_current_conv_id", state.currentConversationId);
      loadConversation(state.currentConversationId);
    } else {
      createNewConversation();
    }
  }

  renderConversationsList();
  showToast("Obrolan berhasil dihapus.", "info");
}

function renderConversationsList() {
  if (!chatHistoryList) return;
  chatHistoryList.innerHTML = "";

  state.conversations.forEach((conv) => {
    const item = document.createElement("div");
    item.className = `chat-history-item ${conv.id === state.currentConversationId ? "active" : ""}`;
    item.onclick = () => {
      if (conv.id !== state.currentConversationId) {
        stopSpeaking();
        loadConversation(conv.id);
        renderConversationsList();
      }
    };

    const link = document.createElement("div");
    link.className = "chat-history-item-link";

    const titleDiv = document.createElement("div");
    titleDiv.className = "chat-title";
    titleDiv.textContent = conv.title;

    const timeDiv = document.createElement("div");
    timeDiv.className = "chat-time";
    timeDiv.textContent = "Baru saja";

    link.appendChild(titleDiv);
    link.appendChild(timeDiv);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-chat-btn";
    deleteBtn.title = "Hapus Obrolan";
    deleteBtn.onclick = (e) => deleteConversation(conv.id, e);

    const trashIcon = document.createElement("i");
    trashIcon.setAttribute("data-lucide", "trash-2");
    deleteBtn.appendChild(trashIcon);

    item.appendChild(link);
    item.appendChild(deleteBtn);
    chatHistoryList.appendChild(item);
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

function updateConversationHistory() {
  const conv = state.conversations.find(
    (c) => c.id === state.currentConversationId,
  );
  if (!conv) return;

  conv.history = [...state.chatHistory];

  if (conv.title === "Obrolan Baru") {
    const firstUserMsg = state.chatHistory.find((msg) => msg.role === "user");
    if (firstUserMsg) {
      let title = firstUserMsg.content.trim();
      if (title.length > 25) {
        title = title.substring(0, 22) + "...";
      }
      conv.title = title;
    }
  }

  saveConversations();
  renderConversationsList();
}

function toggleModal(show) {
  if (show) {
    settingsModal.classList.remove("hidden");
  } else {
    settingsModal.classList.add("hidden");
  }
}

// Stream chat response from Ollama
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  if (!state.isConnected) {
    const provider = providerSelect.value;
    if (provider === "ollama") {
      showToast(
        "Ollama tidak aktif. Coba jalankan aplikasi Ollama dan klik tombol refresh di atas.",
        "error",
      );
    } else {
      showToast(
        `API Key atau konfigurasi untuk ${providerSelect.options[providerSelect.selectedIndex].text} belum siap.`,
        "error",
      );
    }
    return;
  }

  // Stop speaking if AI is currently talking
  stopSpeaking();

  // Add User Message to UI & History
  addMessageToUI("user", text);
  state.chatHistory.push({ role: "user", content: text });
  updateConversationHistory();

  // Reset Input Bar
  chatInput.value = "";
  chatInput.style.height = "auto";

  // Create AI Bubble Container
  const messageWrapper = document.createElement("div");
  messageWrapper.className = "message-wrapper assistant";

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = "N";

  const bubbleContainer = document.createElement("div");
  bubbleContainer.className = "message-bubble-container";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  // Typing Dots (temporary placeholder)
  const typingIndicator = document.createElement("div");
  typingIndicator.className = "typing-indicator";
  typingIndicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
  bubble.appendChild(typingIndicator);
  bubbleContainer.appendChild(bubble);
  messageWrapper.appendChild(avatar);
  messageWrapper.appendChild(bubbleContainer);
  messagesContainer.appendChild(messageWrapper);
  scrollToBottom();

  statusIndicator.className = "status-badge status-thinking";
  statusText.textContent = "Berpikir...";

  // Get Selected Model
  let model = modelSelect.value;
  if (model === "custom") {
    model = customModelInput.value.trim();
    if (!model) model = "gpt-4o-mini"; // Fallback
  }

  // 1. Query Local Documents (RAG)
  let ragContext = "";
  let webContext = "";
  let currentSources = null;
  let searchQuery = text;
  try {
    // Extract previous user message to provide context to the semantic search
    const userMsgs = state.chatHistory.filter((m) => m.role === "user");
    if (userMsgs.length >= 2) {
      const prevMsg = userMsgs[userMsgs.length - 2].content;
      // Combine previous message with current one for richer semantic search context
      searchQuery = `${prevMsg}. ${text}`;
    }

    // Only trigger RAG search if memory is enabled and query is meaningful
    const isMemoryEnabled = memoryToggleBtn
      ? memoryToggleBtn.classList.contains("active")
      : true;
    if (isMemoryEnabled && searchQuery.length > 5) {
      const searchRes = await fetch("http://localhost:5500/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.contexts && searchData.contexts.length > 0) {
          ragContext = searchData.contexts.join("\n\n");
          if (searchData.metadatas && searchData.metadatas.length > 0) {
            const uniqueSources = [];
            const seenKeys = new Set();
            searchData.metadatas.forEach((m) => {
              const key = m.url || m.source || "unknown";
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniqueSources.push(m);
              }
            });
            currentSources = uniqueSources;

            const sourcesDiv = renderSourcesUI(currentSources);
            if (sourcesDiv) {
              // Keep a reference to the sources div to remove it if AI doesn't use it (optional advanced feature)
              bubbleContainer.insertBefore(sourcesDiv, bubble);
            }
          }
        }
      }
    }
  } catch (err) {
    console.log("RAG search skipped or failed", err);
  }

  // Handle Web Search
  try {
    const isWebSearchEnabled = webSearchToggleBtn
      ? webSearchToggleBtn.classList.contains("active")
      : false;

    if (isWebSearchEnabled && searchQuery.length > 5) {
      // Show visual indicator
      statusText.textContent = "🔍 Mencari di web...";

      const webRes = await fetch("http://localhost:5500/api/web-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      if (webRes.ok) {
        const webData = await webRes.json();
        console.log("[Web Search] Results:", JSON.stringify(webData));
        if (webData.results && webData.results.length > 0) {
          // Relevance filter: check if results actually relate to the query
          const stopwords = new Set(["yang", "dan", "atau", "dari", "untuk", "dengan", "dalam", "pada", "adalah", "ini", "itu", "akan", "telah", "sudah", "bisa", "dapat", "juga", "saya", "kamu", "anda", "kita", "mereka", "kami", "siapa", "bagaimana", "mengapa", "kapan", "dimana", "mana", "kenapa", "apakah", "buat", "bikin", "tolong", "coba", "dong", "saat", "sedang", "masih", "hanya", "tidak", "bukan", "belum", "pernah", "lagi", "seperti", "bahwa", "jika", "kalau", "maka", "agar", "supaya", "tentang", "secara", "lebih", "sangat", "paling", "membuat", "memberi", "menjadi"]);
          const queryWords = text.toLowerCase().replace(/[?!.,]/g, "").split(/\s+/).filter(w => w.length > 3 && !stopwords.has(w));
          const allResultText = webData.results.map(r => `${r.title} ${r.body}`).join(" ").toLowerCase();
          const relevantWords = queryWords.filter(w => allResultText.includes(w));
          const isRelevant = queryWords.length === 0 ? false : relevantWords.length >= Math.min(2, queryWords.length);

          if (isRelevant) {
            const webContexts = webData.results.map(
              (r) => `[Sumber: ${r.title}] (${r.url})\n${r.body}`,
            );
            webContext = webContexts.join("\n\n");

            // Add sources
            const uniqueSources = currentSources ? [...currentSources] : [];
            const seenKeys = new Set(
              uniqueSources.map((s) => s.url || s.source || "unknown"),
            );

            webData.results.forEach((r) => {
              if (r.url && !seenKeys.has(r.url)) {
                seenKeys.add(r.url);
                uniqueSources.push({
                  url: r.url,
                  source: r.title || "Web Result",
                });
              }
            });
            currentSources = uniqueSources;

            // Render/Update UI sources
            if (currentSources.length > 0) {
              const existingSourcesDiv =
                bubbleContainer.querySelector(".message-sources");
              if (existingSourcesDiv) existingSourcesDiv.remove();

              const sourcesDiv = renderSourcesUI(currentSources);
              if (sourcesDiv) {
                bubbleContainer.insertBefore(sourcesDiv, bubble);
              }
            }
          } else {
            console.log("[Web Search] Results not relevant to query, skipping injection");
          }
        }
      } else {
        console.log("[Web Search] Response not OK:", webRes.status);
      }
      statusText.textContent = "Berpikir...";
    }
  } catch (err) {
    console.log("Web search skipped or failed", err);
    statusText.textContent = "Berpikir...";
  }

  // 2. Prepare History with Context
  let historyToSend = [...state.chatHistory];
  const hasRag = ragContext.length > 0;
  const hasWeb = webContext.length > 0;

  if (hasWeb) {
    // Inject web search results as a SYSTEM message
    const webSystemMsg = {
      role: "system",
      content: `[HASIL PENCARIAN WEB - TANGGAL: ${new Date().toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}]\n\nBerikut adalah data yang diambil dari internet:\n\n${webContext}\n\nINSTRUKSI:\n1. Jika data web di atas RELEVAN dengan pertanyaan user, WAJIB gunakan sebagai sumber utama jawaban. Pengetahuan bawaanmu mungkin KADALUARSA, jadi prioritaskan data web jika ada perbedaan.\n2. Jika data web di atas TIDAK RELEVAN sama sekali dengan pertanyaan user (misalnya user bertanya tentang dirimu, menyapa, atau topik yang tidak ada hubungannya), ABAIKAN data web dan jawab secara natural dari pengetahuanmu sendiri.\n3. Jika kamu menggunakan data web, cantumkan sumber dalam format Markdown [judul](URL) di akhir jawaban.`,
    };
    // Insert the web system message right before the last user message
    historyToSend.splice(historyToSend.length - 1, 0, webSystemMsg);
  }

  if (hasRag) {
    // Inject RAG context into the user message
    const ragFormat = ragFormatSelect ? ragFormatSelect.value : "natural";
    let instructions;
    if (ragFormat === "list") {
      instructions =
        "Jika INFO TAMBAHAN relevan, jawablah menggunakan poin-poin yang rapi. Di akhir setiap poin, cantumkan link sumber dalam format Markdown [sumber](URL_ASLI). Jika tidak relevan, abaikan dan jawab sewajarnya.";
    } else {
      instructions =
        "HANYA JIKA INFO TAMBAHAN relevan, gunakan untuk menjawab. Jika tidak relevan, abaikan dan jawab sewajarnya. Jika menggunakan info tambahan yang memiliki URL, cantumkan sebagai referensi dalam format Markdown [sumber](URL_ASLI).";
    }

    const lastIdx = historyToSend.length - 1;
    historyToSend[lastIdx] = {
      role: "user",
      content: `[INFO TAMBAHAN DARI MEMORI LOKAL]\n${ragContext}\n\n[PERTANYAAN USER]\n${text}\n\nInstruksi: ${instructions}`,
    };
  }

  const provider = providerSelect.value;
  const host = apiHostInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  // Unified Chat Completion URL: ${host}/chat/completions
  const url = `${host}/chat/completions`;

  // Headers
  const headers = {
    "Content-Type": "application/json",
  };
  if (provider !== "ollama" && apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        model: model,
        messages: historyToSend,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg =
        errData.error?.message ||
        response.statusText ||
        "Gagal menghubungi API";
      throw new Error(errMsg);
    }

    // Remove typing indicator before writing stream
    bubble.innerHTML = "";

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;
    let aiResponseText = "";
    let buffer = "";

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;

      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last partial line in the buffer
        buffer = lines.pop();

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;

          if (cleanLine.startsWith("data: ")) {
            const dataStr = cleanLine.slice(6).trim();
            if (dataStr === "[DONE]") {
              done = true;
              continue;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (
                parsed.choices &&
                parsed.choices[0].delta &&
                parsed.choices[0].delta.content
              ) {
                const content = parsed.choices[0].delta.content;
                aiResponseText += content;
                if (window.marked) {
                  bubble.innerHTML = marked.parse(aiResponseText);
                } else {
                  bubble.textContent = aiResponseText;
                }
                scrollToBottom();
              }
            } catch (e) {
              // Suppress json parsing errors on partial chunks
            }
          }
        }
      }
    }

    // Add final response to chat history
    state.chatHistory.push({
      role: "assistant",
      content: aiResponseText,
      sources: currentSources,
    });
    updateConversationHistory();

    // Update Dashboard Metrics
    state.dashboard.requests += 1;
    const totalWords = (text + " " + aiResponseText).split(/\s+/).length;
    state.dashboard.tokens += Math.ceil(totalWords * 1.3);
    saveDashboardMetrics();
    updateDashboardUI();

    // Add timestamp and optional speak button to bubble
    const timeSpan = document.createElement("span");
    timeSpan.className = "message-time";
    timeSpan.textContent = getCurrentTime();
    bubbleContainer.appendChild(timeSpan);

    // Add audio replay button
    const speakBtn = document.createElement("button");
    speakBtn.className = "speak-bubble-btn";
    speakBtn.title = "Dengarkan Suara";
    speakBtn.innerHTML = '<i data-lucide="volume-2"></i>';
    speakBtn.onclick = () => speakText(aiResponseText);
    bubbleContainer.appendChild(speakBtn);
    lucide.createIcons();

    statusIndicator.className = "status-badge status-online";
    statusText.textContent = "Online";

    // Desktop notification when window is not focused (Electron only)
    if (isElectronApp() && !document.hasFocus()) {
      window.electronAPI.showNotification(
        "NAI",
        aiResponseText.substring(0, 100),
      );
    }

    // Autoplay voice if TTS is enabled
    if (ttsToggle.checked) {
      speakText(aiResponseText);
    }
  } catch (error) {
    console.error(error);
    bubble.innerHTML = `<span style="color: #ef4444;">Aduh, maaf ya. Gagal menghubungi model <strong>${model}</strong>: ${error.message}</span>`;
    statusIndicator.className = "status-badge status-offline";
    statusText.textContent = "Koneksi Gagal";
  }
}

// ==========================================================================
// VOICE SYNTHESIS (TEXT-TO-SPEECH)
// ==========================================================================
async function loadVoices() {
  const currentSelection =
    voiceSelect.value || localStorage.getItem("sora_voice");

  voiceSelect.innerHTML = "";

  const loadingOpt = document.createElement("option");
  loadingOpt.textContent = "Memuat suara...";
  voiceSelect.appendChild(loadingOpt);

  let serverVoices = [];
  try {
    const res = await fetch("/api/voices");
    if (res.ok) {
      serverVoices = await res.json();
    }
  } catch (e) {
    console.warn("Gagal mengambil daftar suara dari server lokal:", e);
  }

  voiceSelect.innerHTML = "";

  // 1. Tambahkan suara natural dari server (Edge TTS / Piper)
  if (serverVoices && serverVoices.length > 0) {
    serverVoices.forEach((voice) => {
      const option = document.createElement("option");
      option.value = voice.id;
      option.textContent = voice.name;
      voiceSelect.appendChild(option);
    });
  } else {
    // Fallback NAI Neural default jika server tidak bisa diakses
    const localOption = document.createElement("option");
    localOption.value = "edge:id-ID-GadisNeural";
    localOption.textContent = "✦ Gadis (Indonesia, Wanita) - Default";
    voiceSelect.appendChild(localOption);
  }

  // 2. Tambahkan suara Web Speech API browser di bawahnya
  if (state.synthesis) {
    const voices = state.synthesis.getVoices();
    const sortedVoices = voices.sort((a, b) => {
      const aIsIndo = a.lang.startsWith("id");
      const bIsIndo = b.lang.startsWith("id");
      if (aIsIndo && !bIsIndo) return -1;
      if (!aIsIndo && bIsIndo) return 1;
      return 0;
    });

    sortedVoices.forEach((voice) => {
      const option = document.createElement("option");
      option.value = voice.name;
      let displayLang = voice.lang;
      if (voice.lang.startsWith("id")) displayLang = "Indonesia";
      else if (voice.lang.startsWith("en")) displayLang = "Inggris";

      option.textContent = `${voice.name} (${displayLang})`;
      voiceSelect.appendChild(option);
    });
  }

  // 3. Kembalikan pilihan suara yang sebelumnya dipilih atau tersimpan di localStorage
  if (currentSelection) {
    const optionExists = Array.from(voiceSelect.options).some(
      (opt) => opt.value === currentSelection,
    );
    if (optionExists) {
      voiceSelect.value = currentSelection;
    } else {
      voiceSelect.selectedIndex = 0;
    }
  } else {
    voiceSelect.selectedIndex = 0;
  }
}

function normalizeTextForTTS(text) {
  if (!text) return "";

  let clean = text;

  // 1. Bersihkan emoji & markdown
  clean = clean
    .replace(
      /[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g,
      "",
    )
    .replace(/[*_`~#]/g, "");

  // 2. Hapus tawa chat agar tidak dibaca mengeja (seperti w-k-w-k)
  clean = clean.replace(/\b(wkwk+|haha+|hehe+|xiuxiu|huhu)\b/gi, "");

  // 3. Normalisasi kata singkatan/slang ke kata standar agar pengucapan TTS natural
  const replacementMap = [
    { pattern: /\b(udah|uda)\b/gi, replacement: "sudah" },
    { pattern: /\b(kalo|klo)\b/gi, replacement: "kalau" },
    { pattern: /\b(gimana|gmn)\b/gi, replacement: "bagaimana" },
    { pattern: /\b(emang|emg)\b/gi, replacement: "memang" },
    { pattern: /\b(yg)\b/gi, replacement: "yang" },
    { pattern: /\b(ga|gak|ngga|nggak|g)\b/gi, replacement: "nggak" },
    { pattern: /\b(aja|aj)\b/gi, replacement: "saja" },
    { pattern: /\b(tau|taw)\b/gi, replacement: "tahu" },
    { pattern: /\b(karna|krn)\b/gi, replacement: "karena" },
    { pattern: /\b(btw)\b/gi, replacement: "ngomong-ngomong" },
    { pattern: /\b(lu|lo|loe)\b/gi, replacement: "kamu" },
    { pattern: /\b(gue|gua|gwa)\b/gi, replacement: "aku" },
    { pattern: /\b(gih)\b/gi, replacement: "ya" },
    { pattern: /\b(tp|tpi)\b/gi, replacement: "tapi" },
    { pattern: /\b(dgn)\b/gi, replacement: "dengan" },
    { pattern: /\b(bgt|banget)\b/gi, replacement: "banget" },
    { pattern: /\b(bs)\b/gi, replacement: "bisa" },
    { pattern: /\b(beneran|bener)\b/gi, replacement: "beneran" },
    { pattern: /\b(beb|bebii|baby)\b/gi, replacement: "bebi" },
  ];

  replacementMap.forEach((item) => {
    clean = clean.replace(item.pattern, item.replacement);
  });

  return clean.replace(/\s+/g, " ").trim();
}

function speakText(text) {
  if (!ttsToggle.checked) return;

  stopSpeaking();

  // Normalisasi teks agar dibaca natural oleh mesin TTS
  const cleanText = normalizeTextForTTS(text);

  if (!cleanText) return;

  const selectedVoiceName = voiceSelect.value;

  if (
    selectedVoiceName === "local_ai_neural" ||
    selectedVoiceName.startsWith("edge:") ||
    selectedVoiceName.startsWith("piper:")
  ) {
    // Jalankan TTS menggunakan API server lokal kustom (Edge TTS / Piper)
    avatarGlow.classList.add("speaking");
    statusIndicator.className = "status-badge status-speaking";
    statusText.textContent = "Berbicara...";

    let voiceParam = selectedVoiceName;
    if (voiceParam === "local_ai_neural") {
      voiceParam = "edge:id-ID-GadisNeural";
    }

    const url = `/api/tts?text=${encodeURIComponent(cleanText)}&voice=${encodeURIComponent(voiceParam)}`;

    // Fetch audio as blob first, then play — more reliable in Electron
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Server TTS error: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        state.localAudioElement = new Audio(blobUrl);

        state.localAudioElement.onended = () => {
          avatarGlow.classList.remove("speaking");
          statusIndicator.className = "status-badge status-online";
          statusText.textContent = "Online";
          URL.revokeObjectURL(blobUrl);
        };

        state.localAudioElement.onerror = (e) => {
          console.error("Gagal memutar audio blob:", e);
          avatarGlow.classList.remove("speaking");
          statusIndicator.className = "status-badge status-online";
          statusText.textContent = "Online";
          URL.revokeObjectURL(blobUrl);
          showToast(
            "Gagal memutar suara neural lokal. Pastikan server lokal sudah berjalan.",
            "error",
          );
        };

        return state.localAudioElement.play();
      })
      .catch((e) => {
        console.error("Gagal memutar audio:", e);
        avatarGlow.classList.remove("speaking");
        statusIndicator.className = "status-badge status-online";
        statusText.textContent = "Online";
      });
    return;
  }

  // Fallback ke Web Speech API bawaan browser
  if (!state.synthesis) return;
  state.currentUtterance = new SpeechSynthesisUtterance(cleanText);

  // Find selected voice
  const voices = state.synthesis.getVoices();
  const voice = voices.find((v) => v.name === selectedVoiceName);
  if (voice) {
    state.currentUtterance.voice = voice;
  }

  // Pengaturan kecepatan dan nada suara pacar (lebih lambat & manis)
  state.currentUtterance.rate = 0.95; // Sedikit lebih lambat agar terasa hangat dan manja
  state.currentUtterance.pitch = 1.1; // Nada sedikit ditinggikan agar lebih ceria/sweet

  state.currentUtterance.onstart = () => {
    avatarGlow.classList.add("speaking");
    statusIndicator.className = "status-badge status-speaking";
    statusText.textContent = "Berbicara...";
  };

  state.currentUtterance.onend = () => {
    avatarGlow.classList.remove("speaking");
    statusIndicator.className = "status-badge status-online";
    statusText.textContent = "Online";
  };

  state.currentUtterance.onerror = () => {
    avatarGlow.classList.remove("speaking");
    statusIndicator.className = "status-badge status-online";
    statusText.textContent = "Online";
  };

  state.synthesis.speak(state.currentUtterance);
}

function stopSpeaking() {
  if (state.synthesis) {
    state.synthesis.cancel();
  }
  if (state.localAudioElement) {
    state.localAudioElement.pause();
    state.localAudioElement.currentTime = 0;
  }
  avatarGlow.classList.remove("speaking");
}

// ==========================================================================
// SPEECH RECOGNITION (SPEECH-TO-TEXT)
// ==========================================================================
function initSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    micBtn.style.display = "none"; // Hide mic if not supported
    console.warn("Speech Recognition tidak didukung di browser ini.");
    return;
  }

  state.recognition = new SpeechRecognition();
  state.recognition.continuous = false;
  state.recognition.interimResults = false;
  state.recognition.lang = "id-ID"; // Indonesian voice typing

  state.recognition.onstart = () => {
    state.isListening = true;
    micBtn.classList.add("listening");
    micBtn.querySelector("i").setAttribute("data-lucide", "mic-off");
    lucide.createIcons();
    chatInput.placeholder = "Mendengarkan... Silakan bicara.";
  };

  state.recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
    chatInput.dispatchEvent(new Event("input")); // trigger auto-grow
    showToast(`Suara terdeteksi: "${transcript}"`, "info");
  };

  state.recognition.onend = () => {
    state.isListening = false;
    micBtn.classList.remove("listening");
    micBtn.querySelector("i").setAttribute("data-lucide", "mic");
    lucide.createIcons();
    chatInput.placeholder = "Ketik pesan di sini...";
  };

  state.recognition.onerror = (event) => {
    console.error("Speech Recognition Error:", event.error);
    if (event.error === "not-allowed") {
      showToast(
        "Izin akses mikrofon ditolak. Aktifkan izin mic di browser Anda.",
        "error",
      );
    } else if (event.error === "no-speech") {
      showToast("Tidak ada suara terdeteksi. Silakan coba lagi.", "info");
    } else {
      showToast(`Gagal merekam suara: ${event.error}`, "error");
    }
    state.isListening = false;
    micBtn.classList.remove("listening");
    micBtn.querySelector("i").setAttribute("data-lucide", "mic");
    lucide.createIcons();
  };
}

function toggleListening() {
  if (!state.recognition) return;

  if (state.isListening) {
    state.recognition.stop();
  } else {
    stopSpeaking(); // stop AI speech
    try {
      state.recognition.start();
    } catch (e) {
      console.error("Gagal menjalankan Speech Recognition:", e);
    }
  }
}

// ==========================================================================
// DASHBOARD TELEMETRY
// ==========================================================================
const COST_RATES = {
  gpt: 0.00015, // estimated per 1k input/output blended
  claude: 0.00025,
  gemini: 0.000125,
};

function updateDashboardUI() {
  if (
    !document.getElementById("dashboard-area") ||
    document.getElementById("dashboard-area").classList.contains("hidden")
  )
    return;

  document.getElementById("val-total-requests").textContent =
    state.dashboard.requests;
  document.getElementById("val-tokens-processed").textContent =
    state.dashboard.tokens;
  document.getElementById("lbl-local-stats").textContent =
    `${state.dashboard.requests} requests · ${state.dashboard.tokens} tokens`;

  // Calculate savings
  const tokensK = state.dashboard.tokens / 1000;
  document.getElementById("val-cost-gpt").textContent =
    "$" + (tokensK * COST_RATES.gpt).toFixed(4);
  document.getElementById("val-save-gpt").textContent =
    "$" + (tokensK * COST_RATES.gpt).toFixed(4);

  document.getElementById("val-cost-claude").textContent =
    "$" + (tokensK * COST_RATES.claude).toFixed(4);
  document.getElementById("val-save-claude").textContent =
    "$" + (tokensK * COST_RATES.claude).toFixed(4);

  document.getElementById("val-cost-gemini").textContent =
    "$" + (tokensK * COST_RATES.gemini).toFixed(4);
  document.getElementById("val-save-gemini").textContent =
    "$" + (tokensK * COST_RATES.gemini).toFixed(4);
}

if (
  isElectronApp() &&
  window.electronAPI &&
  window.electronAPI.onTelemetryUpdate
) {
  window.electronAPI.onTelemetryUpdate((data) => {
    const cpu = data.cpuLoad || 0;

    // Estimate power: idle ~5W, max ~30W
    const estimatedPower = 5 + (cpu / 100) * 25;

    // Update Energy: Joules = Watts * Seconds (2s interval)
    const joules = estimatedPower * 2;
    state.dashboard.energy_kj += joules / 1000;
    saveDashboardMetrics();

    const energyPerToken =
      state.dashboard.tokens > 0
        ? (state.dashboard.energy_kj * 1000) / state.dashboard.tokens
        : 0;

    let thermal = "Cool";
    if (cpu > 70) thermal = "Hot";
    else if (cpu > 30) thermal = "Warm";

    const pwrElem = document.getElementById("val-avg-power");
    const energyElem = document.getElementById("val-total-energy");
    const thrmElem = document.getElementById("val-thermal");
    const eptElem = document.getElementById("val-energy-token");

    if (pwrElem) {
      pwrElem.innerHTML = `${estimatedPower.toFixed(1)} <span class="metric-unit">W</span>`;
      energyElem.innerHTML = `${state.dashboard.energy_kj.toFixed(3)} <span class="metric-unit">kJ</span>`;
      thrmElem.textContent = thermal;
      eptElem.innerHTML = `${energyPerToken.toFixed(3)} <span class="metric-unit">J</span>`;
    }
  });
}

// ==========================================================================
// HELPER FUNCTIONS & UI TRIGGERS
// ==========================================================================
function setupEventListeners() {
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

  // Toggle memory
  if (memoryToggleBtn) {
    memoryToggleBtn.addEventListener("click", () => {
      memoryToggleBtn.classList.toggle("active");
      const isActive = memoryToggleBtn.classList.contains("active");
      memoryToggleBtn.title = isActive
        ? "Gunakan Memori (Aktif)"
        : "Gunakan Memori (Nonaktif)";

      const icon =
        memoryToggleBtn.querySelector("svg") ||
        memoryToggleBtn.querySelector("i");
      if (icon) {
        icon.style.opacity = isActive ? "1" : "0.5";
      }
    });
  }

  // Toggle web search
  if (webSearchToggleBtn) {
    webSearchToggleBtn.addEventListener("click", () => {
      webSearchToggleBtn.classList.toggle("active");
      const isActive = webSearchToggleBtn.classList.contains("active");
      webSearchToggleBtn.title = isActive
        ? "Web Search (Aktif)"
        : "Web Search (Nonaktif)";

      const icon =
        webSearchToggleBtn.querySelector("svg") ||
        webSearchToggleBtn.querySelector("i");
      if (icon) {
        icon.style.opacity = isActive ? "1" : "0.5";
      }
    });
  }

  // Connection refresh / check status
  connectionCheckBtn.addEventListener("click", checkProviderStatus);

  // Toggle Sidebar
  toggleSidebarBtn.addEventListener("click", () => {
    sidebar.classList.toggle("closed");
    const isClosed = sidebar.classList.contains("closed");
    toggleSidebarBtn.innerHTML = `<i data-lucide="${isClosed ? "menu" : "panel-left"}"></i>`;
    if (window.lucide) {
      lucide.createIcons();
    }
  });

  // New Chat Button
  newChatBtn.addEventListener("click", createNewConversation);

  // Sidebar Theme Toggle
  if (sidebarThemeBtn) {
    sidebarThemeBtn.addEventListener("click", () => {
      let current = localStorage.getItem("sora_theme") || "dark";
      let nextTheme = current === "dark" ? "light" : "dark"; // Simple toggle between dark and light

      applyTheme(nextTheme);
      localStorage.setItem("sora_theme", nextTheme);
      updateSidebarThemeIcon(nextTheme);

      // Sync settings UI if it's currently loaded
      const activeBtn = document.querySelector(
        `.theme-btn[data-theme="${nextTheme}"]`,
      );
      if (activeBtn) {
        document
          .querySelectorAll(".theme-btn")
          .forEach((b) => b.classList.remove("active"));
        activeBtn.classList.add("active");
      }
    });
  }

  // Provider Select listener moved to setup.html load

  // View Navigation Toggling
  if (
    navChat &&
    navDashboard &&
    navData &&
    navSetup &&
    openSettingsBtn &&
    chatArea &&
    dashboardArea &&
    datasourcesArea &&
    setupArea &&
    settingsArea
  ) {
    navChat.addEventListener("click", (e) => {
      e.preventDefault();
      navDashboard.classList.remove("active");
      navData.classList.remove("active");
      navSetup.classList.remove("active");
      openSettingsBtn.classList.remove("active");
      navChat.classList.add("active");

      dashboardArea.classList.add("hidden");
      datasourcesArea.classList.add("hidden");
      setupArea.classList.add("hidden");
      settingsArea.classList.add("hidden");
      chatArea.classList.remove("hidden");
    });

    navDashboard.addEventListener("click", (e) => {
      e.preventDefault();
      navChat.classList.remove("active");
      navData.classList.remove("active");
      navSetup.classList.remove("active");
      openSettingsBtn.classList.remove("active");
      navDashboard.classList.add("active");

      chatArea.classList.add("hidden");
      datasourcesArea.classList.add("hidden");
      setupArea.classList.add("hidden");
      settingsArea.classList.add("hidden");
      dashboardArea.classList.remove("hidden");

      const timeElem = document.getElementById("dashboard-timestamp");
      if (timeElem)
        timeElem.textContent =
          new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
      updateDashboardUI();
    });

    navData.addEventListener("click", (e) => {
      e.preventDefault();
      navChat.classList.remove("active");
      navDashboard.classList.remove("active");
      navSetup.classList.remove("active");
      openSettingsBtn.classList.remove("active");
      navData.classList.add("active");

      chatArea.classList.add("hidden");
      dashboardArea.classList.add("hidden");
      setupArea.classList.add("hidden");
      settingsArea.classList.add("hidden");
      datasourcesArea.classList.remove("hidden");
    });

    navSetup.addEventListener("click", (e) => {
      e.preventDefault();
      navChat.classList.remove("active");
      navDashboard.classList.remove("active");
      navData.classList.remove("active");
      openSettingsBtn.classList.remove("active");
      navSetup.classList.add("active");

      chatArea.classList.add("hidden");
      dashboardArea.classList.add("hidden");
      datasourcesArea.classList.add("hidden");
      settingsArea.classList.add("hidden");
      setupArea.classList.remove("hidden");

      checkOllamaStatus();
    });

    openSettingsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      navChat.classList.remove("active");
      navDashboard.classList.remove("active");
      navData.classList.remove("active");
      navSetup.classList.remove("active");
      openSettingsBtn.classList.add("active");

      chatArea.classList.add("hidden");
      dashboardArea.classList.add("hidden");
      datasourcesArea.classList.add("hidden");
      setupArea.classList.add("hidden");
      settingsArea.classList.remove("hidden");
    });
  }

  // API Key Toggle Eye button
  if (toggleApiKeyBtn) {
    toggleApiKeyBtn.addEventListener("click", () => {
      const isPassword = apiKeyInput.type === "password";
      apiKeyInput.type = isPassword ? "text" : "password";
      const icon = toggleApiKeyBtn.querySelector("i");
      icon.setAttribute("data-lucide", isPassword ? "eye-off" : "eye");
      lucide.createIcons();
    });
  }

  // Initialize suggestion card listeners
  setupSuggestionCards();
}

function setupSuggestionCards() {
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

function setupDataSourcesInteractions() {
  const modal = document.getElementById("connection-modal");
  const modalClose = document.getElementById("close-connection-btn");
  const modalSubmit = document.getElementById("btn-submit-connection");
  const modalDesc = document.getElementById("connection-modal-desc");
  const modalInput = document.getElementById("connection-api-key");
  let currentTargetSource = null;

  // Persistence helpers
  let connectedSources = [];
  try {
    connectedSources = JSON.parse(
      localStorage.getItem("nemesis_connected_sources") || "[]",
    );
  } catch (e) {}

  function updateConnectedCount() {
    const countSpan = document.getElementById("connected-count");
    const connectedList = document.getElementById("connected-sources-list");
    if (countSpan && connectedList) {
      const cards = connectedList.querySelectorAll(
        ".data-grid-card, .data-list-card",
      );
      countSpan.textContent = cards.length;
    }
  }

  function saveConnection(source) {
    if (!connectedSources.includes(source)) {
      connectedSources.push(source);
      localStorage.setItem(
        "nemesis_connected_sources",
        JSON.stringify(connectedSources),
      );
      updateConnectedCount();
    }
  }

  function removeConnection(source) {
    connectedSources = connectedSources.filter((s) => s !== source);
    localStorage.setItem(
      "nemesis_connected_sources",
      JSON.stringify(connectedSources),
    );
    updateConnectedCount();
  }

  const connectedList = document.getElementById("connected-sources-list");

  // Load saved connections
  if (connectedList) {
    connectedSources.forEach((source) => {
      const card = document.getElementById(`source-${source}`);
      if (card) {
        const emptyState = connectedList.querySelector(".empty-state");
        if (emptyState) emptyState.remove();

        const btn = card.querySelector(".btn-add");
        if (btn) {
          btn.className = "data-action-btn btn-disconnect";
          btn.textContent = "Disconnect";
          btn.removeAttribute("data-source");
        }

        if (source === "hackernews" || source === "beritaindo") {
          const meta = card.querySelector(".data-card-meta");
          if (meta && !meta.querySelector(".btn-resync")) {
            const resyncSpan = document.createElement("span");
            resyncSpan.className = "badge badge-outline btn-resync";
            resyncSpan.style.cursor = "pointer";
            resyncSpan.style.marginLeft = "8px";
            resyncSpan.textContent = "Re-sync";
            resyncSpan.setAttribute("data-source", source);
            meta.appendChild(resyncSpan);
          }
        }

        connectedList.appendChild(card);
      }
    });
    updateConnectedCount();
  }

  // Close modal
  if (modalClose) {
    modalClose.addEventListener("click", () => {
      modal.classList.add("hidden");
      modalInput.value = "";
    });
  }

  // Submit modal
  if (modalSubmit) {
    modalSubmit.addEventListener("click", () => {
      const key = modalInput.value.trim();
      if (!key) return showToast("API Key tidak boleh kosong", "error");

      modal.classList.add("hidden");
      const btn = document.querySelector(
        `.btn-add[data-source="${currentTargetSource}"]`,
      );
      if (btn) {
        btn.classList.add("btn-loading");

        // Mock connection success for GitHub/Notion
        setTimeout(() => {
          btn.classList.remove("btn-loading");
          btn.classList.add("btn-success");
          btn.textContent = "Connected";

          // Move card to connected list
          const card = document.getElementById(`source-${currentTargetSource}`);
          const connectedList = document.getElementById(
            "connected-sources-list",
          );
          if (card && connectedList) {
            const emptyState = connectedList.querySelector(".empty-state");
            if (emptyState) emptyState.remove();

            // Change button to disconnect
            btn.className = "data-action-btn btn-disconnect";
            btn.textContent = "Disconnect";
            btn.removeAttribute("data-source"); // prevent re-adding

            connectedList.appendChild(card);
            saveConnection(currentTargetSource);
            showToast(
              `${currentTargetSource.toUpperCase()} berhasil dikoneksikan!`,
              "success",
            );
          }
        }, 1500);
      }
    });
  }

  // Add animation for + Add buttons
  const addBtns = document.querySelectorAll(".btn-add");
  addBtns.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      if (btn.classList.contains("btn-success")) return;

      const source = btn.getAttribute("data-source");

      if (source === "hackernews" || source === "beritaindo") {
        // Doesn't need API Key, sync directly
        btn.classList.add("btn-loading");
        try {
          const res = await fetch(`http://localhost:5500/api/sync/${source}`, {
            method: "POST",
          });
          if (res.ok) {
            const data = await res.json();
            btn.classList.remove("btn-loading");
            btn.classList.add("btn-success");
            btn.textContent = "Connected";

            const card = document.getElementById(`source-${source}`);
            const connectedList = document.getElementById(
              "connected-sources-list",
            );
            if (card && connectedList) {
              const emptyState = connectedList.querySelector(".empty-state");
              if (emptyState) emptyState.remove();

              btn.className = "data-action-btn btn-disconnect";
              btn.textContent = "Disconnect";

              // Add Re-sync badge
              const meta = card.querySelector(".data-card-meta");
              if (meta && !meta.querySelector(".btn-resync")) {
                const resyncSpan = document.createElement("span");
                resyncSpan.className = "badge badge-outline btn-resync";
                resyncSpan.style.cursor = "pointer";
                resyncSpan.style.marginLeft = "8px";
                resyncSpan.textContent = "Re-sync";
                resyncSpan.setAttribute("data-source", source);
                meta.appendChild(resyncSpan);
              }

              connectedList.appendChild(card);
              saveConnection(source);
            }

            const sourceName =
              source === "hackernews" ? "Hacker News" : "Berita Nasional";
            showToast(
              `Berhasil sinkronisasi ${data.chunks} artikel dari ${sourceName}!`,
              "success",
            );

            // Update memory count if it's visible
            refreshMemoryStats();
          } else {
            throw new Error("Sync failed");
          }
        } catch (err) {
          btn.classList.remove("btn-loading");
          const sourceName =
            source === "hackernews" ? "Hacker News" : "Berita Nasional";
          showToast(`Gagal sinkronisasi ${sourceName}.`, "error");
        }
      } else if (source === "github" || source === "notion") {
        currentTargetSource = source;
        modalDesc.textContent = `Please enter your ${source === "github" ? "Personal Access Token" : "Internal Integration Secret"} to connect.`;
        modal.classList.remove("hidden");
      }
    });
  });

  // Delegate disconnect logic for dynamically moved cards
  if (connectedList) {
    connectedList.addEventListener("click", async (e) => {
      // Disconnect Logic
      if (e.target.classList.contains("btn-disconnect")) {
        const btn = e.target;
        if (btn.textContent === "Disconnected") return;

        if (confirm("Are you sure you want to disconnect this data source?")) {
          btn.classList.add("btn-loading");
          setTimeout(() => {
            btn.classList.remove("btn-loading");

            const card = btn.closest(".data-grid-card");
            if (card && card.id) {
              const source = card.id.replace("source-", "");
              removeConnection(source);

              // Remove resync button if exists
              const resyncBtn = card.querySelector(".btn-resync");
              if (resyncBtn) resyncBtn.remove();

              // Restore button state
              btn.className = "data-action-btn btn-add";
              btn.textContent = "+ Add";
              btn.setAttribute("data-source", source);
              btn.style.opacity = "1";
              btn.style.pointerEvents = "auto";

              // Move back to available list
              const availableList = document.getElementById(
                "available-sources-list",
              );
              if (availableList) {
                availableList.appendChild(card);
              }

              // Check if connected list is empty to show empty state
              const connectedList = document.getElementById(
                "connected-sources-list",
              );
              if (connectedList) {
                const remainingCards =
                  connectedList.querySelectorAll(".data-grid-card");
                if (
                  remainingCards.length === 0 &&
                  !connectedList.querySelector(".empty-state")
                ) {
                  const empty = document.createElement("div");
                  empty.className = "empty-state";
                  empty.style.padding = "20px";
                  empty.style.color = "var(--text-tertiary)";
                  empty.style.fontSize = "13px";
                  empty.textContent = "No external data sources connected yet.";
                  connectedList.appendChild(empty);
                }
              }
            }

            showToast("Service disconnected.", "info");
          }, 1000);
        }
      }

      // Re-sync Logic
      if (e.target.classList.contains("btn-resync")) {
        const btn = e.target;
        const source = btn.getAttribute("data-source");
        if (source === "hackernews" || source === "beritaindo") {
          const originalText = btn.textContent;
          btn.textContent = "Syncing...";
          btn.style.opacity = "0.5";
          btn.style.pointerEvents = "none";

          try {
            const res = await fetch(
              `http://localhost:5500/api/sync/${source}`,
              { method: "POST" },
            );
            if (res.ok) {
              const data = await res.json();
              showToast(
                `Berhasil memperbarui ${data.chunks} artikel dari ${source === "hackernews" ? "Hacker News" : "BeritaIndo"}!`,
                "success",
              );
              refreshMemoryStats();
            } else {
              throw new Error("Sync failed");
            }
          } catch (err) {
            showToast("Gagal memperbarui Hacker News.", "error");
          } finally {
            btn.textContent = originalText;
            btn.style.opacity = "1";
            btn.style.pointerEvents = "auto";
          }
        }
      }
    });
  }

  // Tab Switcher for Data Sources vs Memory
  const tabs = document.querySelectorAll(".data-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-target");
      if (!targetId) return; // Ignore "Messaging Channels" for now

      // Update active state on tabs
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Hide all contents, show target
      document
        .getElementById("tab-content-datasources")
        .classList.add("hidden");
      document.getElementById("tab-content-memory").classList.add("hidden");
      document.getElementById(targetId).classList.remove("hidden");

      if (targetId === "tab-content-memory") {
        refreshMemoryStats();
      }
    });
  });
}

function resetChatHistory() {
  const sysPrompt = systemPromptInput
    ? systemPromptInput.value
    : DEFAULT_SYSTEM_PROMPT;
  state.chatHistory = [{ role: "system", content: sysPrompt }];
}

function renderSourcesUI(sources) {
  if (!sources || sources.length === 0) return null;
  const sourcesDiv = document.createElement("div");
  sourcesDiv.className = "message-sources";
  sources.forEach((src) => {
    const chip = document.createElement("a");
    chip.className = "source-chip";
    if (src.url) chip.href = src.url;
    chip.target = "_blank";

    const icon = document.createElement("img");
    icon.className = "source-favicon";
    if (src.url) {
      try {
        const domain = new URL(src.url).hostname;
        icon.src = `https://www.google.com/s2/favicons?domain=${domain}`;
      } catch (e) {
        icon.src = "assets/logo.png";
      }
    } else {
      icon.src = "assets/logo.png";
    }

    const textSpan = document.createElement("span");
    textSpan.textContent = src.title || src.source || "Referensi";

    chip.appendChild(icon);
    chip.appendChild(textSpan);
    sourcesDiv.appendChild(chip);
  });
  return sourcesDiv;
}

function addMessageToUI(sender, text, sources = null) {
  // Remove welcome box if present
  const welcome = messagesContainer.querySelector(".welcome-box");
  if (welcome) welcome.remove();

  const wrapper = document.createElement("div");
  wrapper.className = `message-wrapper ${sender}`;

  const bubbleContainer = document.createElement("div");
  bubbleContainer.className = "message-bubble-container";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  if (sender === "assistant" && window.marked) {
    bubble.innerHTML = marked.parse(text);
  } else {
    bubble.textContent = text;
  }

  const timeSpan = document.createElement("span");
  timeSpan.className = "message-time";
  timeSpan.textContent = getCurrentTime();

  if (sender === "assistant" && sources) {
    const sourcesDiv = renderSourcesUI(sources);
    if (sourcesDiv) bubbleContainer.appendChild(sourcesDiv);
  }

  bubbleContainer.appendChild(bubble);
  bubbleContainer.appendChild(timeSpan);
  wrapper.appendChild(bubbleContainer);
  messagesContainer.appendChild(wrapper);

  scrollToBottom();
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function showToast(message, type = "info") {
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

// ==========================================================================
// SETUP & DEPENDENCIES LOGIC
// ==========================================================================
async function checkOllamaStatus() {
  const iconBg = document.getElementById("ollama-status-icon");
  const title = document.getElementById("ollama-status-title");
  const desc = document.getElementById("ollama-status-desc");

  if (!iconBg) return;

  iconBg.className = "status-icon-bg";
  title.textContent = "Checking Ollama Engine...";
  desc.textContent = "Verifying connection to localhost:11434";

  try {
    await new Promise((r) => setTimeout(r, 500)); // tiny delay for visual feedback
    const res = await fetch("http://localhost:11434/api/version", {
      timeout: 2000,
    });
    if (res.ok) {
      const data = await res.json();
      iconBg.className = "status-icon-bg online";
      title.textContent = "Ollama is Running";
      desc.textContent = `Connected successfully (Version ${data.version})`;
      checkInstalledModels();
    } else {
      throw new Error("Bad status");
    }
  } catch (err) {
    iconBg.className = "status-icon-bg offline";
    title.textContent = "Ollama is Offline";
    desc.textContent = "Please start Ollama application on your computer.";
  }
}

async function checkInstalledModels() {
  try {
    const res = await fetch("http://localhost:11434/api/tags");
    if (res.ok) {
      const data = await res.json();
      const models = data.models.map((m) => m.name);

      document.querySelectorAll(".setup-btn-download").forEach((btn) => {
        const modelName = btn.getAttribute("data-model");
        const isInstalled = models.some(
          (m) => m === modelName || m === `${modelName}:latest`,
        );
        if (isInstalled) {
          btn.classList.add("installed");
          btn.innerHTML = '<i data-lucide="check-circle"></i> Installed';
        }
      });
      if (window.lucide) lucide.createIcons();
    }
  } catch (err) {}
}

function setupSettingsInteractions() {
  // Bind Settings DOM Elements
  providerSelect = document.getElementById("provider-select");
  apiKeyGroup = document.getElementById("api-key-group");
  apiKeyInput = document.getElementById("api-key-input");
  // toggleApiKeyBtn = document.getElementById("toggle-api-key-btn"); // not in new ui yet, optional
  modelSelect = document.getElementById("model-select");
  customModelInput = document.getElementById("custom-model-input");
  apiHostGroup = document.getElementById("api-host-group");
  apiHostInput = document.getElementById("api-host-input");
  ttsToggle = document.getElementById("tts-toggle");
  voiceSelect = document.getElementById("voice-select");
  systemPromptInput = document.getElementById("system-prompt");
  clearChatBtn = document.getElementById("clear-chat-btn");
  ragFormatSelect = document.getElementById("rag-format-select");
  fontSizeSelect = document.getElementById("font-size-select");
  activeModelText = document.getElementById("current-active-model-text");

  // Set default system prompt in UI
  if (systemPromptInput) systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;

  // Re-load settings now that elements exist
  loadSettings();

  // Setup Theme logic
  const currentTheme = localStorage.getItem("sora_theme") || "dark";
  document.querySelectorAll(".theme-btn").forEach((btn) => {
    if (btn.dataset.theme === currentTheme) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }

    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".theme-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const theme = btn.dataset.theme;
      applyTheme(theme);
      saveSettings();
      updateSidebarThemeIcon(theme);
    });
  });

  // Re-attach Event Listeners
  if (providerSelect)
    providerSelect.addEventListener("change", handleProviderChange);

  if (apiKeyInput) apiKeyInput.addEventListener("input", saveSettings);
  if (apiHostInput) apiHostInput.addEventListener("input", saveSettings);
  if (customModelInput)
    customModelInput.addEventListener("input", saveSettings);

  if (modelSelect) {
    modelSelect.addEventListener("change", () => {
      if (modelSelect.value === "custom") {
        customModelInput.classList.remove("hidden");
      } else {
        customModelInput.classList.add("hidden");
      }
      saveSettings();
      checkProviderStatus();
    });
  }

  if (customModelInput) {
    customModelInput.addEventListener("input", () => {
      saveSettings();
      checkProviderStatus();
    });
  }

  if (ttsToggle) ttsToggle.addEventListener("change", saveSettings);
  if (voiceSelect) voiceSelect.addEventListener("change", saveSettings);
  if (ragFormatSelect) ragFormatSelect.addEventListener("change", saveSettings);
  if (fontSizeSelect) {
    fontSizeSelect.addEventListener("change", () => {
      saveSettings();
      applyFontSize(fontSizeSelect.value);
    });
  }

  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", () => {
      if (
        confirm(
          "Yakin ingin menghapus semua sesi obrolan? Tindakan ini tidak bisa dibatalkan.",
        )
      ) {
        stopSpeaking();
        state.conversations = [];
        saveConversations();
        createNewConversation();
        showToast("Semua sesi obrolan telah dihapus.", "success");
      }
    });
  }

  if (systemPromptInput) {
    systemPromptInput.addEventListener("change", () => {
      if (state.chatHistory[0] && state.chatHistory[0].role === "system") {
        state.chatHistory[0].content = systemPromptInput.value;
      } else {
        state.chatHistory.unshift({
          role: "system",
          content: systemPromptInput.value,
        });
      }
      updateConversationHistory();
      saveSettings();
    });
  }

  // Load Voice Options now that elements exist
  loadVoices();
  if (state.synthesis.onvoiceschanged !== undefined) {
    state.synthesis.onvoiceschanged = loadVoices;
  }

  // Setup download interactions in Settings Modal
  document.querySelectorAll(".setup-btn-download").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (
        btn.classList.contains("installed") ||
        btn.classList.contains("downloading")
      )
        return;
      const modelName = btn.getAttribute("data-model");
      downloadOllamaModel(modelName, btn);
    });
  });

  const customDownloadBtn = document.getElementById("btn-custom-download");
  const customDownloadInput = document.getElementById("custom-download-input");
  if (customDownloadBtn && customDownloadInput) {
    customDownloadBtn.addEventListener("click", () => {
      const modelName = customDownloadInput.value.trim();
      if (!modelName) return;
      if (customDownloadBtn.classList.contains("downloading")) return;

      // Temporary setup button object for the generic function
      customDownloadBtn.setAttribute("data-model", "custom-download");
      downloadOllamaModel(modelName, customDownloadBtn);
    });
  }

  // Check Connection status of the selected provider now that elements exist
  checkProviderStatus();
}

function setupGetStartedInteractions() {
  const refreshBtn = document.getElementById("btn-refresh-ollama");
  if (refreshBtn) refreshBtn.addEventListener("click", checkOllamaStatus);

  document.querySelectorAll(".setup-btn-download").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (
        btn.classList.contains("installed") ||
        btn.classList.contains("downloading")
      )
        return;

      const modelName = btn.getAttribute("data-model");
      downloadOllamaModel(modelName, btn);
    });
  });
}

async function downloadOllamaModel(modelName, btn) {
  const containerId = btn.getAttribute("data-model") || modelName;
  const progContainer = document.getElementById(`prog-${containerId}`);
  if (!progContainer) return;
  const progFill = progContainer.querySelector(".setup-progress-fill");
  const progText = progContainer.querySelector(".setup-progress-text");

  btn.classList.add("downloading");
  btn.innerHTML = '<i data-lucide="loader"></i> Downloading...';
  if (window.lucide) lucide.createIcons();

  progContainer.classList.remove("hidden");

  try {
    const response = await fetch("http://localhost:11434/api/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!response.ok) throw new Error("Pull failed");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((l) => l.trim() !== "");

      for (let line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.total && data.completed) {
            const pct = Math.min(
              100,
              Math.round((data.completed / data.total) * 100),
            );
            progFill.style.width = `${pct}%`;
            progText.textContent = `${pct}%`;
          }
          if (data.status === "success") {
            progFill.style.width = `100%`;
            progText.textContent = `100%`;
          }
        } catch (e) {}
      }
    }

    btn.classList.remove("downloading");
    btn.classList.add("installed");
    btn.innerHTML = '<i data-lucide="check-circle"></i> Installed';
    if (window.lucide) lucide.createIcons();
    showToast(`${modelName} downloaded successfully!`, "success");
  } catch (err) {
    btn.classList.remove("downloading");
    btn.innerHTML = '<i data-lucide="download"></i> Retry';
    if (window.lucide) lucide.createIcons();
    progContainer.classList.add("hidden");
    showToast(`Failed to download ${modelName}`, "error");
  }
}

// ==========================================================================
// MEMORY TAB LOGIC
// ==========================================================================
function setupMemoryInteractions() {
  const btnBrowse = document.getElementById("btn-browse-folder");
  const btnIndex = document.getElementById("btn-index-folder");
  const btnStore = document.getElementById("btn-store-text");
  const btnSearch = document.getElementById("btn-search-memory");
  const searchInput = document.getElementById("memory-search-input");
  const folderInput = document.getElementById("index-folder-input");

  if (btnBrowse) {
    btnBrowse.addEventListener("click", async () => {
      if (isElectronApp() && window.electronAPI.selectDirectory) {
        const path = await window.electronAPI.selectDirectory();
        if (path) {
          folderInput.value = path;
        }
      } else {
        showToast("Hanya tersedia di versi aplikasi desktop.", "info");
      }
    });
  }

  if (btnIndex) {
    btnIndex.addEventListener("click", async () => {
      const path = folderInput.value;
      if (!path)
        return showToast("Silakan pilih folder terlebih dahulu", "error");

      btnIndex.textContent = "Indexing...";
      btnIndex.classList.add("btn-loading");

      try {
        const res = await fetch("http://localhost:5500/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_path: path }),
        });
        if (res.ok) {
          const data = await res.json();
          showToast(
            `Berhasil menambahkan ${data.chunks} potong ingatan dari ${data.files_processed} file!`,
            "success",
          );
          folderInput.value = "";
          refreshMemoryStats();
        } else {
          showToast("Gagal memproses folder.", "error");
        }
      } catch (err) {
        showToast("Terjadi kesalahan saat menghubungi server.", "error");
      } finally {
        btnIndex.classList.remove("btn-loading");
        btnIndex.textContent = "Index";
      }
    });
  }

  if (btnStore) {
    btnStore.addEventListener("click", async () => {
      const text = document.getElementById("store-text-input").value;
      if (!text.trim()) return showToast("Teks tidak boleh kosong", "error");

      btnStore.textContent = "Storing...";
      btnStore.classList.add("btn-loading");

      try {
        const res = await fetch("http://localhost:5500/api/ingest/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text }),
        });
        if (res.ok) {
          const data = await res.json();
          showToast(
            `Berhasil menyimpan ${data.chunks} potong teks ke memori!`,
            "success",
          );
          document.getElementById("store-text-input").value = "";
          refreshMemoryStats();
        } else {
          showToast("Gagal menyimpan teks.", "error");
        }
      } catch (err) {
        showToast("Terjadi kesalahan saat menghubungi server.", "error");
      } finally {
        btnStore.classList.remove("btn-loading");
        btnStore.textContent = "Store";
      }
    });
  }

  if (btnSearch) {
    btnSearch.addEventListener("click", async () => {
      const q = searchInput.value;
      if (!q.trim()) return;

      btnSearch.classList.add("btn-loading");
      const resultsContainer = document.getElementById("memory-search-results");

      try {
        const res = await fetch("http://localhost:5500/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        if (res.ok) {
          const data = await res.json();
          resultsContainer.innerHTML = "";

          if (!data.contexts || data.contexts.length === 0) {
            resultsContainer.innerHTML = `
              <div class="empty-state">
                <i data-lucide="search" class="empty-icon"></i>
                <p>No matching memories found</p>
              </div>`;
          } else {
            data.contexts.forEach((ctx, i) => {
              const meta = data.metadatas
                ? data.metadatas[i]
                : { source: "Unknown" };
              const div = document.createElement("div");
              div.className = "memory-result-item";
              div.innerHTML = `
                <div>${ctx}</div>
                <div class="memory-result-meta">
                  <i data-lucide="file-text" style="width:12px;height:12px;"></i> ${meta.source || "Manual Text"}
                </div>
              `;
              resultsContainer.appendChild(div);
            });
          }
          if (window.lucide) lucide.createIcons();
        }
      } catch (err) {
        showToast("Pencarian gagal.", "error");
      } finally {
        btnSearch.classList.remove("btn-loading");
      }
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btnSearch.click();
    });
  }

  const btnClearMemory = document.getElementById("btn-clear-memory");
  if (btnClearMemory) {
    btnClearMemory.addEventListener("click", async () => {
      if (
        !confirm(
          "Apakah Anda yakin ingin menghapus seluruh ingatan? Semua dokumen dan berita akan terhapus.",
        )
      )
        return;
      try {
        btnClearMemory.classList.add("btn-loading");
        const res = await fetch("http://localhost:5500/api/memory/clear", {
          method: "POST",
        });
        if (res.ok) {
          showToast("Memori berhasil dikosongkan.", "success");
          refreshMemoryStats();
          const connectedCount = document.getElementById("connected-count");
          if (connectedCount) connectedCount.textContent = "0";
          const connectedList = document.getElementById(
            "connected-sources-list",
          );
          if (connectedList)
            connectedList.innerHTML = `<div class="empty-state" style="padding: 20px; color: var(--text-tertiary); font-size: 13px;">No external data sources connected yet.</div>`;
        } else {
          showToast("Gagal menghapus memori.", "error");
        }
      } catch (err) {
        showToast("Koneksi ke server terputus.", "error");
      } finally {
        btnClearMemory.classList.remove("btn-loading");
      }
    });
  }
}

async function refreshMemoryStats() {
  const countEl = document.getElementById("memory-chunk-count");
  if (!countEl) return;

  try {
    const res = await fetch("http://localhost:5500/api/memory/stats");
    if (res.ok) {
      const data = await res.json();
      countEl.textContent = data.chunks || 0;
    }
  } catch (err) {}
}

// ==========================================================================
// SPLIT VIEW BROWSER
// ==========================================================================

function setupSplitView() {
  const splitView = document.getElementById("split-view");
  const splitViewUrl = document.getElementById("split-view-url");
  const splitViewExternalBtn = document.getElementById(
    "split-view-external-btn",
  );
  const splitViewCloseBtn = document.getElementById("split-view-close-btn");
  const sourceWebview = document.getElementById("source-webview");
  const appContainer = document.querySelector(".app-container");

  if (!splitView || !sourceWebview) return;

  let currentUrl = "";

  // Handle Close
  splitViewCloseBtn.addEventListener("click", () => {
    splitView.classList.add("hidden");
    appContainer.classList.remove("split-active");
    sourceWebview.src = "about:blank"; // stop loading/audio
  });

  // Handle External Open
  splitViewExternalBtn.addEventListener("click", () => {
    if (currentUrl) {
      window.open(currentUrl, "_blank");
    }
  });

  // Intercept all link clicks inside messages container
  messagesContainer.addEventListener("click", (e) => {
    const anchor = e.target.closest("a");
    if (!anchor) return;

    const url = anchor.getAttribute("href");
    if (!url || (!url.startsWith("http") && !url.startsWith("file://"))) return;

    // Intercept it!
    e.preventDefault();

    currentUrl = url;

    try {
      if (url.startsWith("file://")) {
        const filename = decodeURIComponent(url.split("/").pop());
        splitViewUrl.textContent = filename;
      } else {
        const hostname = new URL(url).hostname;
        splitViewUrl.textContent = hostname;
      }
    } catch (err) {
      splitViewUrl.textContent = "Situs Eksternal";
    }

    sourceWebview.src = url;
    appContainer.classList.add("split-active");
    splitView.classList.remove("hidden");
  });
}

function applyFontSize(size) {
  const root = document.documentElement;
  if (size === "small") {
    root.style.setProperty("--chat-font-size", "13px");
  } else if (size === "large") {
    root.style.setProperty("--chat-font-size", "16px");
  } else {
    root.style.setProperty("--chat-font-size", "14px"); // default
  }
}
