import re

with open('app.js', 'r') as f:
    content = f.read()

# 1. Replace intervals
content = content.replace(
    'let unibaseAnalysisInterval = null;',
    'let tacAnalysisInterval = null;\nlet humanityAnalysisInterval = null;'
)

content = content.replace(
    'if (unibaseAnalysisInterval) clearInterval(unibaseAnalysisInterval);',
    'if (tacAnalysisInterval) clearInterval(tacAnalysisInterval);\n      if (humanityAnalysisInterval) clearInterval(humanityAnalysisInterval);'
)

content = content.replace(
    'unibaseAnalysisInterval = setInterval(() => {',
    '''tacAnalysisInterval = setInterval(() => {
        fetchCoinAnalysis("TAC-USDT", "tac");
      }, 3000);
      humanityAnalysisInterval = setInterval(() => {
        fetchCoinAnalysis("HUM-USDT", "humanity");
      }, 3000);
      // Removed old unibase logic: setInterval(() => {'''
)
content = content.replace('fetchCoinAnalysis("UB-USDT");\n      }, 3000);', '') # remove old closing if it exists

# 2. fetchCryptoData
fetch_crypto_old = """  const unibaseLoading = document.getElementById("unibase-loading");
  const unibaseContent = document.getElementById("unibase-content");
  const watchlistLoading = document.getElementById("watchlist-loading");
  const spotlightCard = document.getElementById("unibase-spotlight");
  const watchlistSection = document.querySelector(".crypto-watchlist-section");"""

fetch_crypto_new = """  const tacLoading = document.getElementById("tac-loading");
  const humanityLoading = document.getElementById("humanity-loading");
  const tacContent = document.getElementById("tac-content");
  const humanityContent = document.getElementById("humanity-content");
  const tacSpotlight = document.getElementById("tac-spotlight");
  const humanitySpotlight = document.getElementById("humanity-spotlight");
  const watchlistLoading = document.getElementById("watchlist-loading");
  const watchlistSection = document.querySelector(".crypto-watchlist-section");"""

content = content.replace(fetch_crypto_old, fetch_crypto_new)

display_old = """    if (errorState) errorState.classList.add("hidden");
    if (spotlightCard) spotlightCard.style.display = "";
    if (watchlistSection) watchlistSection.style.display = "";"""

display_new = """    if (errorState) errorState.classList.add("hidden");
    if (tacSpotlight) tacSpotlight.style.display = "";
    if (humanitySpotlight) humanitySpotlight.style.display = "";
    if (watchlistSection) watchlistSection.style.display = "";"""

content = content.replace(display_old, display_new)

logic_old = """    const unibase = data.coins.find((c) => c.id === "unibase");
    const watchlistCoins = data.coins.filter((c) => c.id !== "unibase");

    if (unibase) {
      renderUnibaseSpotlight(unibase);
      if (unibaseLoading) unibaseLoading.style.display = "none";
      if (unibaseContent) unibaseContent.classList.remove("hidden");
    }"""

logic_new = """    const tac = data.coins.find((c) => c.id === "tac");
    const humanity = data.coins.find((c) => c.id === "humanity");
    const watchlistCoins = data.coins.filter((c) => c.id !== "tac" && c.id !== "humanity");

    if (tac) {
      renderSpotlight(tac, "tac");
      if (tacLoading) tacLoading.style.display = "none";
      if (tacContent) tacContent.classList.remove("hidden");
    }
    if (humanity) {
      renderSpotlight(humanity, "humanity");
      if (humanityLoading) humanityLoading.style.display = "none";
      if (humanityContent) humanityContent.classList.remove("hidden");
    }"""

content = content.replace(logic_old, logic_new)

error_hide_old = """    if (!silent) {
      if (errorState) errorState.classList.remove("hidden");
      if (spotlightCard) spotlightCard.style.display = "none";
      if (watchlistSection) watchlistSection.style.display = "none";
    }"""

error_hide_new = """    if (!silent) {
      if (errorState) errorState.classList.remove("hidden");
      if (tacSpotlight) tacSpotlight.style.display = "none";
      if (humanitySpotlight) humanitySpotlight.style.display = "none";
      if (watchlistSection) watchlistSection.style.display = "none";
    }"""

content = content.replace(error_hide_old, error_hide_new)

# 3. renderUnibaseSpotlight -> renderSpotlight
spotlight_func_old = """function renderUnibaseSpotlight(coin) {
  const iconEl = document.getElementById("unibase-icon");
  const nameEl = document.getElementById("unibase-name");
  const symbolEl = document.getElementById("unibase-symbol");
  const rankEl = document.getElementById("unibase-rank");
  const priceEl = document.getElementById("unibase-price");
  const change24hEl = document.getElementById("unibase-change-24h");
  const volumeEl = document.getElementById("unibase-volume");
  const mcapEl = document.getElementById("unibase-mcap");
  const change7dEl = document.getElementById("unibase-change-7d");
  const athEl = document.getElementById("unibase-ath");
  const sparklineEl = document.getElementById("unibase-sparkline");"""

spotlight_func_new = """function renderSpotlight(coin, prefix) {
  const iconEl = document.getElementById(prefix + "-icon");
  const nameEl = document.getElementById(prefix + "-name");
  const symbolEl = document.getElementById(prefix + "-symbol");
  const rankEl = document.getElementById(prefix + "-rank");
  const priceEl = document.getElementById(prefix + "-price");
  const change24hEl = document.getElementById(prefix + "-change-24h");
  const volumeEl = document.getElementById(prefix + "-volume");
  const mcapEl = document.getElementById(prefix + "-mcap");
  const change7dEl = document.getElementById(prefix + "-change-7d");
  const athEl = document.getElementById(prefix + "-ath");
  const sparklineEl = document.getElementById(prefix + "-sparkline");"""

content = content.replace(spotlight_func_old, spotlight_func_new)
content = content.replace('nameEl.textContent = coin.name || "Unibase";', 'nameEl.textContent = coin.name || "Token";')
content = content.replace('symbolEl.textContent = coin.symbol?.toUpperCase() || "UB";', 'symbolEl.textContent = coin.symbol?.toUpperCase() || "";')


# 4. fetchCoinAnalysis
fetch_analysis_old = """function fetchCoinAnalysis(symbol = "UB-USDT") {
  const url = `http://127.0.0.1:5500/api/crypto/analysis?symbol=${symbol}`;
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error("API Error");
      return res.json();
    })
    .then((data) => {
      renderUnibaseAnalysis(data, symbol);
    })
    .catch((err) => {
      console.error(`[Crypto] Gagal memuat Market Analysis untuk ${symbol}:`, err);
    });
}"""

fetch_analysis_new = """function fetchCoinAnalysis(symbol, prefix) {
  if (!symbol) return;
  const url = `http://127.0.0.1:5500/api/crypto/analysis?symbol=${symbol}`;
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error("API Error");
      return res.json();
    })
    .then((data) => {
      renderAnalysis(data, prefix, symbol);
    })
    .catch((err) => {
      console.error(`[Crypto] Gagal memuat Market Analysis untuk ${symbol}:`, err);
    });
}"""

content = content.replace(fetch_analysis_old, fetch_analysis_new)

# 5. renderUnibaseAnalysis -> renderAnalysis
# We need to replace all document.getElementById("unibase-...") and similar hardcoded elements
content = content.replace('function renderUnibaseAnalysis(data, symbol = "UB-USDT") {', 'function renderAnalysis(data, prefix, symbol) {')
content = content.replace('document.getElementById("unibase-analysis-panel");', 'document.getElementById(prefix + "-analysis-panel");')
# Re-route the extension at the end of the file
extension_old = """// Extension for renderUnibaseAnalysis to update Spotlight Card
const originalRenderUnibaseAnalysis = renderUnibaseAnalysis;
renderUnibaseAnalysis = function(data, symbol = "UB-USDT") {
  originalRenderUnibaseAnalysis(data, symbol);
  
  if (!data || !data.cex || !data.dex) return;
  const cex = data.cex;
  
  const spotlightName = document.getElementById("unibase-name");
  const spotlightSymbol = document.getElementById("unibase-symbol");
  const spotlightPrice = document.getElementById("unibase-price");
  const spotlightVol = document.getElementById("unibase-volume");
  const spotlightIcon = document.getElementById("unibase-icon");
  const spotlightChange24h = document.getElementById("unibase-change-24h");
  const spotlightLoading = document.getElementById("unibase-loading");
  const spotlightContent = document.getElementById("unibase-content");"""

extension_new = """// Extension for renderAnalysis to update Spotlight Card
const originalRenderAnalysis = renderAnalysis;
renderAnalysis = function(data, prefix, symbol) {
  originalRenderAnalysis(data, prefix, symbol);
  
  if (!data || !data.cex || !data.dex) return;
  const cex = data.cex;
  
  const spotlightName = document.getElementById(prefix + "-name");
  const spotlightSymbol = document.getElementById(prefix + "-symbol");
  const spotlightPrice = document.getElementById(prefix + "-price");
  const spotlightVol = document.getElementById(prefix + "-volume");
  const spotlightIcon = document.getElementById(prefix + "-icon");
  const spotlightChange24h = document.getElementById(prefix + "-change-24h");
  const spotlightLoading = document.getElementById(prefix + "-loading");
  const spotlightContent = document.getElementById(prefix + "-content");"""

content = content.replace(extension_old, extension_new)

# Inside the rest of renderAnalysis there are a lot of getElementById("dex-...") etc.
# Wait, did we duplicate those IDs as well?
# Let's check crypto.html script.
# In duplicate_panels.py, we replaced `unibase` with `tac` and `humanity`. 
# Wait, IDs like `dex-price`, `cex-price` were NOT prefixed with `unibase-` in the original HTML!
# Ah! Let me review `crypto.html` original.

with open('app_new.js', 'w') as f:
    f.write(content)
