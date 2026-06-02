import { DEFAULT_SYSTEM_PROMPT, PROVIDER_MODELS, PROVIDER_DEFAULTS, state } from "./config.js";
import { messagesContainer, chatInput, sendBtn, micBtn, toggleSidebarBtn, sidebar, newChatBtn, chatHistoryList, openSettingsBtn, settingsModal, closeSettingsBtn, providerSelect, apiKeyGroup, apiKeyInput, toggleApiKeyBtn, modelSelect, customModelInput, apiHostGroup, apiHostInput, ttsToggle, voiceSelect, systemPromptInput, clearChatBtn, connectionCheckBtn, statusIndicator, statusText, avatarGlow } from "./dom.js";
import { updateModelDropdown, handleProviderChange, saveSettings, loadSettings, checkProviderStatus } from "./api.js";
import { initChatHistory, saveConversations, createNewConversation, loadConversation, deleteConversation, renderConversationsList, updateConversationHistory, toggleModal, sendMessage } from "./chat.js";
import { setupEventListeners, setupSuggestionCards, resetChatHistory, addMessageToUI, scrollToBottom, getCurrentTime, showToast } from "./ui.js";




export async function loadVoices() {
  const currentSelection = voiceSelect.value || localStorage.getItem("sora_voice");

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
    const optionExists = Array.from(voiceSelect.options).some(opt => opt.value === currentSelection);
    if (optionExists) {
      voiceSelect.value = currentSelection;
    } else {
      voiceSelect.selectedIndex = 0;
    }
  } else {
    voiceSelect.selectedIndex = 0;
  }
}

export function normalizeTextForTTS(text) {
  if (!text) return "";
  
  let clean = text;
  
  // 1. Bersihkan emoji & markdown
  clean = clean
    .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, "")
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
    { pattern: /\b(beb|bebii|baby)\b/gi, replacement: "bebi" }
  ];
  
  replacementMap.forEach(item => {
    clean = clean.replace(item.pattern, item.replacement);
  });
  
  return clean.replace(/\s+/g, " ").trim();
}

export function speakText(text) {
  if (!ttsToggle.checked) return;

  stopSpeaking();

  // Normalisasi teks agar dibaca natural oleh mesin TTS
  const cleanText = normalizeTextForTTS(text);

  if (!cleanText) return;

  const selectedVoiceName = voiceSelect.value;

  if (selectedVoiceName === "local_ai_neural" || selectedVoiceName.startsWith("edge:") || selectedVoiceName.startsWith("piper:")) {
    // Jalankan TTS menggunakan API server lokal kustom (Edge TTS / Piper)
    avatarGlow.classList.add("speaking");
    statusIndicator.className = "status-badge status-speaking";
    statusText.textContent = "Berbicara...";

    let voiceParam = selectedVoiceName;
    if (voiceParam === "local_ai_neural") {
      voiceParam = "edge:id-ID-GadisNeural";
    }

    const url = `/api/tts?text=${encodeURIComponent(cleanText)}&voice=${encodeURIComponent(voiceParam)}`;
    state.localAudioElement = new Audio(url);

    state.localAudioElement.onended = () => {
      avatarGlow.classList.remove("speaking");
      statusIndicator.className = "status-badge status-online";
      statusText.textContent = "Online";
    };

    state.localAudioElement.onerror = (e) => {
      console.error("Gagal memutar audio dari server lokal:", e);
      avatarGlow.classList.remove("speaking");
      statusIndicator.className = "status-badge status-online";
      statusText.textContent = "Online";
      showToast("Gagal memutar suara neural lokal. Pastikan server lokal sudah berjalan.", "error");
    };

    state.localAudioElement.play().catch((e) => {
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

export function stopSpeaking() {
  if (state.synthesis) {
    state.synthesis.cancel();
  }
  if (state.localAudioElement) {
    state.localAudioElement.pause();
    state.localAudioElement.currentTime = 0;
  }
  avatarGlow.classList.remove("speaking");
}


export function initSpeechRecognition() {
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

export function toggleListening() {
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


