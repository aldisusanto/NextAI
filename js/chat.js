import { DEFAULT_SYSTEM_PROMPT, PROVIDER_MODELS, PROVIDER_DEFAULTS, state } from "./config.js";
import { messagesContainer, chatInput, sendBtn, micBtn, toggleSidebarBtn, sidebar, newChatBtn, chatHistoryList, openSettingsBtn, settingsModal, closeSettingsBtn, providerSelect, apiKeyGroup, apiKeyInput, toggleApiKeyBtn, modelSelect, customModelInput, apiHostGroup, apiHostInput, ttsToggle, voiceSelect, systemPromptInput, clearChatBtn, connectionCheckBtn, statusIndicator, statusText, avatarGlow } from "./dom.js";
import { updateModelDropdown, handleProviderChange, saveSettings, loadSettings, checkProviderStatus } from "./api.js";
import { loadVoices, normalizeTextForTTS, speakText, stopSpeaking, initSpeechRecognition, toggleListening } from "./audio.js";
import { setupEventListeners, setupSuggestionCards, resetChatHistory, addMessageToUI, scrollToBottom, getCurrentTime, showToast } from "./ui.js";




export function initChatHistory() {
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
    const exists = state.conversations.some(c => c.id === state.currentConversationId);
    if (!exists) {
      state.currentConversationId = state.conversations[0].id;
    }
    loadConversation(state.currentConversationId);
    renderConversationsList();
  }
}

export function saveConversations() {
  localStorage.setItem("sora_conversations", JSON.stringify(state.conversations));
}

export function createNewConversation() {
  const id = "conv_" + Date.now().toString();
  const sysPrompt = systemPromptInput ? systemPromptInput.value : DEFAULT_SYSTEM_PROMPT;
  const newConv = {
    id: id,
    title: "Obrolan Baru",
    history: [{ role: "system", content: sysPrompt }]
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

export function loadConversation(id) {
  const conv = state.conversations.find(c => c.id === id);
  if (!conv) return;

  state.currentConversationId = id;
  localStorage.setItem("sora_current_conv_id", id);
  state.chatHistory = [...conv.history];

  messagesContainer.innerHTML = "";

  const displayMessages = state.chatHistory.filter(msg => msg.role !== "system");

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
    displayMessages.forEach(msg => {
      addMessageToUI(msg.role, msg.content);
    });
  }
  
  const systemMsg = state.chatHistory.find(msg => msg.role === "system");
  if (systemMsg && systemPromptInput) {
    systemPromptInput.value = systemMsg.content;
  }
}

export function deleteConversation(id, event) {
  if (event) {
    event.stopPropagation();
  }
  
  if (!confirm("Hapus obrolan ini?")) return;

  const index = state.conversations.findIndex(c => c.id === id);
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

export function renderConversationsList() {
  if (!chatHistoryList) return;
  chatHistoryList.innerHTML = "";

  state.conversations.forEach(conv => {
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

export function updateConversationHistory() {
  const conv = state.conversations.find(c => c.id === state.currentConversationId);
  if (!conv) return;

  conv.history = [...state.chatHistory];

  if (conv.title === "Obrolan Baru") {
    const firstUserMsg = state.chatHistory.find(msg => msg.role === "user");
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

export function toggleModal(show) {
  if (show) {
    settingsModal.classList.remove("hidden");
  } else {
    settingsModal.classList.add("hidden");
  }
}

// Stream chat response from Ollama
export async function sendMessage() {
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

  const provider = providerSelect.value;
  const host = apiHostInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  // Unified Chat Completion URL: ${host}/chat/completions
  const url = `${host}/chat/completions`;

  // Headers
  const headers = {
    "Content-Type": "application/json"
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
        messages: state.chatHistory,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error?.message || response.statusText || "Gagal menghubungi API";
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
              if (parsed.choices && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                const content = parsed.choices[0].delta.content;
                aiResponseText += content;
                bubble.textContent = aiResponseText;
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
    state.chatHistory.push({ role: "assistant", content: aiResponseText });
    updateConversationHistory();

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


