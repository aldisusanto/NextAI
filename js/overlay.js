// ==========================================================================
// SPOTLIGHT OVERLAY FRONTEND SCRIPT — NextAI
// ==========================================================================

const SERVER_URL = 'http://localhost:5500';

let capturedImageBase64 = null;
let currentAudio = null;

// DOM Elements
const spotlightInput = document.getElementById('spotlight-input');
const btnSnap = document.getElementById('btn-snap');
const btnVoice = document.getElementById('btn-voice');
const previewBox = document.getElementById('preview-box');
const previewImg = document.getElementById('preview-img');
const btnRemovePreview = document.getElementById('btn-remove-preview');
const actionPills = document.getElementById('action-pills');
const responseDrawer = document.getElementById('response-drawer');
const drawerContent = document.getElementById('drawer-content');
const drawerSpinner = document.getElementById('drawer-spinner');
const drawerTitleText = document.getElementById('drawer-title-text');
const statusIndicator = document.getElementById('status-indicator');
const btnCopyResponse = document.getElementById('btn-copy-response');
const btnSpeakResponse = document.getElementById('btn-speak-response');
const btnCloseDrawer = document.getElementById('btn-close-drawer');

// On load focus
window.addEventListener('DOMContentLoaded', () => {
  spotlightInput.focus();

  if (window.electronAPI && window.electronAPI.onOverlayShown) {
    window.electronAPI.onOverlayShown(() => {
      spotlightInput.focus();
      spotlightInput.select();
    });
  }
});

// Keyboard Navigation
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeOverlay();
  } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    handleSnapAndSubmit();
  } else if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSubmitQuery();
  }
});

// Snap Button Event
btnSnap.addEventListener('click', async () => {
  await captureCurrentScreen();
});

// Remove Preview
btnRemovePreview.addEventListener('click', () => {
  clearCapturedScreen();
});

// Close Drawer Button
btnCloseDrawer.addEventListener('click', () => {
  responseDrawer.classList.add('hidden');
});

// Copy Response Button
const SVG_COPY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const SVG_CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const SVG_SPEAKER = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;

btnCopyResponse.addEventListener('click', () => {
  const text = drawerContent.innerText;
  if (text) {
    navigator.clipboard.writeText(text);
    btnCopyResponse.innerHTML = SVG_CHECK;
    setTimeout(() => {
      btnCopyResponse.innerHTML = SVG_COPY;
    }, 1500);
  }
});

// Speak Response Button
btnSpeakResponse.addEventListener('click', async () => {
  const text = drawerContent.innerText;
  if (!text) return;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    btnSpeakResponse.innerHTML = SVG_SPEAKER;
    return;
  }

  btnSpeakResponse.innerText = '...';
  try {
    const res = await fetch(`${SERVER_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.substring(0, 500) })
    });
    if (res.ok) {
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(audioUrl);
      currentAudio.play();
      btnSpeakResponse.innerText = '⏹️';
      currentAudio.onended = () => {
        btnSpeakResponse.innerHTML = SVG_SPEAKER;
        currentAudio = null;
      };
    }
  } catch (err) {
    console.error('TTS error:', err);
    btnSpeakResponse.innerHTML = SVG_SPEAKER;
  }
});

// Action Pills Handlers
actionPills.addEventListener('click', async (e) => {
  const pill = e.target.closest('.pill');
  if (!pill) return;

  const action = pill.dataset.action;
  let presetPrompt = '';

  switch (action) {
    case 'fix-error':
      presetPrompt = 'Jelaskan pesan error/masalah di layar ini dan berikan langkah solusinya.';
      break;
    case 'summarize':
      presetPrompt = 'Rangkum poin-poin utama dari konten di layar ini.';
      break;
    case 'translate':
      presetPrompt = 'Terjemahkan teks di layar ini ke Bahasa Indonesia yang natural.';
      break;
    case 'save-rag':
      presetPrompt = 'Simpan teks dari layar ini ke dalam memori RAG NextAI.';
      break;
    case 'diagram-architecture':
      presetPrompt = 'Buatkan diagram arsitektur sistem dan flowchart komponen dari konten di layar ini dalam format Mermaid.js.';
      break;
  }

  spotlightInput.value = presetPrompt;

  // Auto snap screen if not already snapped
  if (!capturedImageBase64) {
    await captureCurrentScreen();
  }

  handleSubmitQuery();
});

// Capture Screen Logic
async function captureCurrentScreen() {
  if (window.electronAPI && window.electronAPI.captureScreen) {
    try {
      const base64Data = await window.electronAPI.captureScreen();
      if (base64Data) {
        capturedImageBase64 = base64Data;
        previewImg.src = base64Data;
        previewBox.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Screen capture error:', err);
    }
  } else {
    alert('Tangkapan layar hanya didukung saat berjalan di aplikasi Desktop Electron.');
  }
}

function clearCapturedScreen() {
  capturedImageBase64 = null;
  previewImg.src = '';
  previewBox.classList.add('hidden');
}

// Snap and Submit Shortcut Handler
async function handleSnapAndSubmit() {
  await captureCurrentScreen();
  if (!spotlightInput.value.trim()) {
    spotlightInput.value = 'Jelaskan dan analisis konten di layar ini.';
  }
  handleSubmitQuery();
}

// Submit Query Logic
async function handleSubmitQuery() {
  const query = spotlightInput.value.trim();
  if (!query && !capturedImageBase64) return;

  showDrawerLoading();

  try {
    const payload = {
      prompt: query || 'Jelaskan konten di layar ini.',
      image: capturedImageBase64 || null
    };

    const res = await fetch(`${SERVER_URL}/api/screen-analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      renderResponse(data.reply || data.answer || JSON.stringify(data));
    } else {
      const errText = await res.text();
      renderResponse(`⚠️ **Gagal memproses:** ${errText || 'Terjadi kesalahan pada server.'}`);
    }
  } catch (err) {
    console.error('API Error:', err);
    renderResponse(`⚠️ **Error Koneksi:** ${err.message}. Pastikan server.py berjalan.`);
  } finally {
    hideDrawerLoading();
  }
}

function showDrawerLoading() {
  responseDrawer.classList.remove('hidden');
  drawerSpinner.classList.remove('hidden');
  drawerContent.innerHTML = '';
  drawerTitleText.innerText = 'Menganalisis Layar & Konteks...';
  statusIndicator.classList.add('loading');
}

function hideDrawerLoading() {
  drawerSpinner.classList.add('hidden');
  statusIndicator.classList.remove('loading');
  drawerTitleText.innerText = 'Jawaban NextAI';
}

// Initialize Mermaid.js
if (window.mermaid) {
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose'
    });
  } catch (e) {}
}

function renderResponse(text) {
  // Check for ```mermaid blocks
  const mermaidRegex = /```mermaid([\s\S]*?)```/g;
  let mermaidCode = null;
  let match = mermaidRegex.exec(text);
  if (match) {
    mermaidCode = match[1].trim();
  }

  // Parse markdown
  let formatted = text
    .replace(/```mermaid([\s\S]*?)```/g, '<div class="diagram-canvas-card"><div class="diagram-toolbar"><span class="diagram-badge">📐 Diagram Arsitektur Interaktif</span><div class="diagram-btn-group"><button class="diagram-btn btn-copy-png">📋 Copy PNG</button><button class="diagram-btn btn-dl-svg">💾 Download SVG</button></div></div><div class="diagram-viewport" id="mermaid-container"></div></div>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');

  drawerContent.innerHTML = formatted;

  if (mermaidCode && window.mermaid) {
    const container = document.getElementById('mermaid-container');
    if (container) {
      const uniqueId = 'mermaid-svg-' + Date.now();
      try {
        mermaid.render(uniqueId, mermaidCode).then(({ svg }) => {
          container.innerHTML = svg;
          setupDiagramInteractions(container, svg);
        }).catch(err => {
          console.error('Mermaid render error:', err);
          container.innerHTML = `<pre><code>${mermaidCode}</code></pre>`;
        });
      } catch (e) {
        container.innerHTML = `<pre><code>${mermaidCode}</code></pre>`;
      }
    }
  }
}

function setupDiagramInteractions(container, svgContent) {
  const card = container.closest('.diagram-canvas-card');
  if (!card) return;

  const btnCopyPng = card.querySelector('.btn-copy-png');
  const btnDlSvg = card.querySelector('.btn-dl-svg');

  if (btnDlSvg) {
    btnDlSvg.addEventListener('click', () => {
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nextai_diagram_${Date.now()}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (btnCopyPng) {
    btnCopyPng.addEventListener('click', () => {
      const svgElement = container.querySelector('svg');
      if (!svgElement) return;

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        canvas.width = (img.width || 800) * 2;
        canvas.height = (img.height || 600) * 2;
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
          if (blob && navigator.clipboard && window.ClipboardItem) {
            navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            btnCopyPng.innerText = '✅ Copied!';
            setTimeout(() => { btnCopyPng.innerText = '📋 Copy PNG'; }, 1500);
          }
        });
      };
      img.src = url;
    });
  }
}

function closeOverlay() {
  if (window.electronAPI && window.electronAPI.hideOverlay) {
    window.electronAPI.hideOverlay();
  }
}
