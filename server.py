import os
import sys
import asyncio
import subprocess
import tempfile
try:
    from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer as HTTPServer
except ImportError:
    from http.server import SimpleHTTPRequestHandler, HTTPServer
import base64
import urllib.parse
import json
import uuid
import requests
import xml.etree.ElementTree as ET
import re
import chromadb

def extract_screen_ocr(clean_b64):
    if not clean_b64:
        return ""
    mac_ocr_bin = os.path.join(os.path.dirname(__file__), "mac_ocr")
    if not os.path.exists(mac_ocr_bin):
        return ""
    
    tmp_path = os.path.join(tempfile.gettempdir(), f"ocr_input_{uuid.uuid4().hex[:6]}.png")
    try:
        with open(tmp_path, "wb") as f:
            f.write(base64.b64decode(clean_b64))
        
        res = subprocess.run([mac_ocr_bin, tmp_path], capture_output=True, text=True, timeout=6)
        if os.path.exists(tmp_path):
            try: os.remove(tmp_path)
            except: pass
        if res.returncode == 0 and res.stdout.strip():
            return res.stdout.strip()
    except Exception as e:
        print(f"[WARN] OCR extraction error: {e}")
        if os.path.exists(tmp_path):
            try: os.remove(tmp_path)
            except: pass
    return ""
try:
    import fitz # PyMuPDF
except ImportError:
    fitz = None

PORT = 5500

# Setup ChromaDB
chroma_client = chromadb.PersistentClient(path=".chroma_db")
collection = chroma_client.get_or_create_collection(name="nemesis_docs")

def get_ollama_embedding(text):
    try:
        response = requests.post('http://localhost:11434/api/embeddings', json={
            "model": "nomic-embed-text",
            "prompt": text
        }, timeout=10)
        if response.status_code == 200:
            return response.json()['embedding']
        elif response.status_code == 404:
            print("[INFO] Model nomic-embed-text not found. Pulling now (this may take a minute)...")
            pull_res = requests.post('http://localhost:11434/api/pull', json={"name": "nomic-embed-text", "stream": False})
            if pull_res.status_code == 200:
                print("[INFO] Pull complete. Retrying embedding.")
                retry = requests.post('http://localhost:11434/api/embeddings', json={
                    "model": "nomic-embed-text",
                    "prompt": text
                }, timeout=10)
                if retry.status_code == 200:
                    return retry.json()['embedding']
    except Exception as e:
        print(f"[ERROR] Ollama embedding failed: {e}")
    return None

# Edge TTS voice options - natural neural voices
EDGE_VOICES = {
    "id-ID-GadisNeural": "Gadis (Indonesia, Wanita)",
    "id-ID-ArdiNeural": "Ardi (Indonesia, Pria)",
    "en-US-JennyNeural": "Jenny (English, Female)",
    "en-US-GuyNeural": "Guy (English, Male)",
    "en-US-AriaNeural": "Aria (English, Female)",
    "en-GB-SoniaNeural": "Sonia (British, Female)",
    "ja-JP-NanamiNeural": "Nanami (Japanese, Female)",
    "ko-KR-SunHiNeural": "SunHi (Korean, Female)",
}

DEFAULT_VOICE = "id-ID-GadisNeural"

# Piper fallback (offline)
PIPER_MODEL_PATH = os.path.join(os.path.dirname(__file__), "id_ID-news_tts-medium.onnx")
PIPER_MODEL_JSON = os.path.join(os.path.dirname(__file__), "id_ID-news_tts-medium.onnx.json")
PIPER_ONNX_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/id/id_ID/news_tts/medium/id_ID-news_tts-medium.onnx"
PIPER_JSON_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/id/id_ID/news_tts/medium/id_ID-news_tts-medium.onnx.json"

def download_file(url, dest):
    import urllib.request
    print(f"[INFO] Mengunduh {url} ke {dest}...")
    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
        )
        with urllib.request.urlopen(req) as response, open(dest, 'wb') as out_file:
            data = response.read()
            out_file.write(data)
        print("[INFO] Selesai unduh.")
    except Exception as e:
        print(f"[ERROR] Gagal mengunduh file: {e}")
        if os.path.exists(dest):
            os.remove(dest)
        raise e

def setup_edge_tts():
    """Install edge-tts jika belum ada."""
    try:
        import edge_tts
        print("[INFO] Library 'edge-tts' sudah terinstal.")
        return True
    except ImportError:
        print("[INFO] Menginstal 'edge-tts' untuk suara neural natural...")
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "edge-tts"], check=True,
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            print("[INFO] 'edge-tts' berhasil diinstal.")
            return True
        except Exception as e:
            print(f"[WARN] Gagal menginstal 'edge-tts': {e}")
            return False

def setup_piper():
    """Setup Piper TTS sebagai fallback offline."""
    try:
        import piper
        print("[INFO] Library 'piper-tts' (fallback offline) tersedia.")
    except ImportError:
        print("[INFO] Menginstal 'piper-tts' sebagai fallback offline...")
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "piper-tts"], check=True,
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            print("[INFO] 'piper-tts' berhasil diinstal.")
        except Exception as e:
            print(f"[WARN] Gagal menginstal 'piper-tts': {e}")
            return

    if not os.path.exists(PIPER_MODEL_PATH):
        download_file(PIPER_ONNX_URL, PIPER_MODEL_PATH)
    if not os.path.exists(PIPER_MODEL_JSON):
        download_file(PIPER_JSON_URL, PIPER_MODEL_JSON)

async def generate_edge_tts(text, voice, output_path):
    """Generate audio menggunakan Edge TTS (Microsoft Neural)."""
    import edge_tts
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)

def generate_piper_tts(text, output_path):
    """Generate audio menggunakan Piper (offline fallback)."""
    cmd = [
        sys.executable,
        "-m", "piper",
        "--model", PIPER_MODEL_PATH,
        "--output_file", output_path
    ]
    process = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    stdout, stderr = process.communicate(input=text.encode("utf-8"))
    if process.returncode != 0:
        raise RuntimeError(f"Piper error: {stderr.decode()}")

class NemesisHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        """Suppress default access logs to keep console clean."""
        pass

    def end_headers(self):
        """Disable caching for all files to ensure Electron always loads the latest CSS/JS."""
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)

        if parsed_url.path == "/api/tts":
            self._handle_tts(parsed_url)
        elif parsed_url.path == "/api/voices":
            self._handle_voices()
        elif parsed_url.path == "/api/memory/stats":
            self._handle_memory_stats()
        else:
            super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b""
        
        if parsed_url.path == "/api/screen-analyze":
            self._handle_screen_analyze(post_data)
        elif parsed_url.path == "/api/tts":
            self._handle_tts_post(post_data)
        elif parsed_url.path == "/api/ingest":
            self._handle_ingest(post_data)
        elif parsed_url.path == "/api/ingest/text":
            self._handle_ingest_text(post_data)
        elif parsed_url.path == "/api/search":
            self._handle_search(post_data)
        elif parsed_url.path == "/api/sync/hackernews":
            self._handle_sync_hackernews()
        elif parsed_url.path == "/api/sync/beritaindo":
            self._handle_sync_beritaindo()
        elif parsed_url.path == "/api/web-search":
            self._handle_web_search(post_data)
        elif parsed_url.path == "/api/memory/clear":
            self._handle_memory_clear()
        else:
            self.send_error(404, "Not Found")
            
    def _handle_ingest(self, post_data):
        try:
            data = json.loads(post_data.decode('utf-8'))
            file_path = data.get("file_path")
            if not file_path or not os.path.exists(file_path):
                self.send_error(400, "Path not found")
                return
                
            files_to_process = []
            if os.path.isdir(file_path):
                for root, _, files in os.walk(file_path):
                    for file in files:
                        if file.endswith('.txt') or file.endswith('.md') or file.endswith('.pdf'):
                            files_to_process.append(os.path.join(root, file))
            else:
                files_to_process.append(file_path)
                
            if not files_to_process:
                self.send_error(400, "No supported files found")
                return
                
            total_chunks = 0
            for target_file in files_to_process:
                text = ""
                if target_file.endswith('.pdf') and fitz is not None:
                    try:
                        doc = fitz.open(target_file)
                        for page in doc:
                            text += page.get_text()
                    except: pass
                elif target_file.endswith('.txt') or target_file.endswith('.md'):
                    try:
                        with open(target_file, 'r', encoding='utf-8') as f:
                            text = f.read()
                    except: pass
                        
                if not text.strip():
                    continue
                    
                chunks = [p.strip() for p in text.split('\n\n') if len(p.strip()) > 50]
                
                for chunk in chunks:
                    emb = get_ollama_embedding(chunk)
                    if emb:
                        doc_id = str(uuid.uuid4())
                        collection.add(
                            ids=[doc_id],
                            embeddings=[emb],
                            documents=[chunk],
                            metadatas=[{"source": os.path.basename(target_file), "url": f"file://{os.path.abspath(target_file)}", "title": os.path.basename(target_file)}]
                        )
                        total_chunks += 1
                        
            if total_chunks == 0:
                self.send_error(500, "Gagal membuat embeddings. Pastikan Ollama menyala dan model nomic-embed-text terinstal.")
                return
                
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "chunks": total_chunks, "files_processed": len(files_to_process)}).encode())
        except Exception as e:
            self.send_error(500, str(e))
            
    def _handle_search(self, post_data):
        try:
            data = json.loads(post_data.decode('utf-8'))
            query = data.get("query")
            if not query:
                self.send_error(400, "Query required")
                return
                
            emb = get_ollama_embedding(query)
            if not emb:
                self.send_error(500, "Embedding failed")
                return
                
            query_lower = query.lower()
            sources_to_check = []
            if "hacker news" in query_lower or "tech" in query_lower:
                sources_to_check.append("Hacker News")
            if "berita" in query_lower or "indonesia" in query_lower or "nasional" in query_lower or "lokal" in query_lower:
                sources_to_check.append("Berita Nasional")
            if "github" in query_lower:
                sources_to_check.append("GitHub")
            if "notion" in query_lower:
                sources_to_check.append("Notion")
                
            combined_docs = []
            combined_metas = []

            if sources_to_check:
                # Jika ada kata kunci sumber spesifik, hanya cari di sumber tersebut (jangan campur aduk)
                for src in sources_to_check:
                    try:
                        src_res = collection.query(query_embeddings=[emb], n_results=5, where={"source": src})
                        if src_res['documents'] and src_res['documents'][0]:
                            for i, doc in enumerate(src_res['documents'][0]):
                                if doc not in combined_docs:
                                    combined_docs.append(doc)
                                    combined_metas.append(src_res['metadatas'][0][i])
                    except Exception as e:
                        pass
            else:
                # Jika tidak ada kata kunci spesifik, cari di seluruh memori (global)
                results = collection.query(
                    query_embeddings=[emb],
                    n_results=4
                )
                if results['documents']:
                    combined_docs = list(results['documents'][0])
                if results['metadatas']:
                    combined_metas = list(results['metadatas'][0])
            
            contexts = combined_docs
            metadatas = combined_metas
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"contexts": contexts, "metadatas": metadatas}).encode())
        except Exception as e:
            self.send_error(500, str(e))

    def _handle_ingest_text(self, post_data):
        try:
            data = json.loads(post_data.decode('utf-8'))
            text = data.get("text", "")
            if not text.strip():
                self.send_error(400, "Empty text")
                return
                
            chunks = [p.strip() for p in text.split('\n\n') if len(p.strip()) > 50]
            if not chunks:
                chunks = [text.strip()]
                
            successful_chunks = 0
            for chunk in chunks:
                emb = get_ollama_embedding(chunk)
                if emb:
                    doc_id = str(uuid.uuid4())
                    collection.add(
                        ids=[doc_id],
                        embeddings=[emb],
                        documents=[chunk],
                        metadatas=[{"source": "Manual Text Entry"}]
                    )
                    successful_chunks += 1
            
            if successful_chunks == 0:
                self.send_error(500, "Embedding failed")
                return
                
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "chunks": successful_chunks}).encode())
        except Exception as e:
            self.send_error(500, str(e))

    def _handle_memory_stats(self):
        try:
            count = collection.count()
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "chunks": count}).encode('utf-8'))
        except Exception as e:
            self.send_error(500, str(e))

    def _handle_web_search(self, post_data):
        try:
            data = json.loads(post_data.decode('utf-8'))
            query = data.get("query")
            if not query:
                self.send_error(400, "Query is required")
                return
            
            import urllib.request, urllib.parse, re
            from datetime import datetime
            
            # Only append current year if query seems to ask about current/recent info
            current_year = datetime.now().year
            time_keywords = ['saat ini', 'sekarang', 'terbaru', 'hari ini', 'tahun ini', 'currently', 'current', 'latest', 'today', 'now', 'harga', 'berita', 'presiden', 'gubernur', 'menteri']
            needs_year = any(kw in query.lower() for kw in time_keywords)
            enhanced_query = f"{query} {current_year}" if needs_year else query
            
            # HYBRID SEARCH: Wikipedia API (for facts) + Google News RSS (for latest info)
            # This bypasses ISP blocks and anti-bot protections since both are official/open endpoints
            import xml.etree.ElementTree as ET
            
            formatted_results = []
            
            # 1. Search Wikipedia (for factual information)
            wiki_url = f"https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(query)}&utf8=&format=json"
            try:
                wiki_req = urllib.request.Request(wiki_url, headers={'User-Agent': 'Mozilla/5.0'})
                wiki_data = json.loads(urllib.request.urlopen(wiki_req, timeout=5).read().decode('utf-8'))
                for res in wiki_data.get('query', {}).get('search', [])[:3]:
                    title = res.get('title', '')
                    snippet = re.sub(r'<[^>]+>', '', res.get('snippet', '')).strip()
                    url = f"https://id.wikipedia.org/wiki/{urllib.parse.quote(title)}"
                    if title and snippet:
                        formatted_results.append({"title": f"Wikipedia: {title}", "url": url, "body": snippet})
            except Exception as e:
                print("[Web Search] Wikipedia error:", e)
                
            # 2. Search Google News RSS (for current events and latest info)
            # Only use enhanced_query (with year) for news to get relevant current info
            news_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(enhanced_query)}&hl=id&gl=ID&ceid=ID:id"
            try:
                news_req = urllib.request.Request(news_url, headers={'User-Agent': 'Mozilla/5.0'})
                xml_data = urllib.request.urlopen(news_req, timeout=5).read()
                root = ET.fromstring(xml_data)
                for item in root.findall('.//item')[:3]:
                    title = item.find('title').text if item.find('title') is not None else ''
                    link = item.find('link').text if item.find('link') is not None else ''
                    pubDate = item.find('pubDate').text if item.find('pubDate') is not None else ''
                    if title and link:
                        formatted_results.append({"title": f"Berita: {title}", "url": link, "body": f"Tanggal: {pubDate}. Berita terkait pencarian."})
            except Exception as e:
                print("[Web Search] Google News error:", e)
            
            # For the top 2 results, try to fetch actual page content for richer context
            for i, result in enumerate(formatted_results[:2]):
                try:
                    page_req = urllib.request.Request(result["url"], headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    })
                    page_html = urllib.request.urlopen(page_req, timeout=5).read().decode('utf-8', errors='ignore')
                    
                    # Remove script, style, nav, header, footer tags
                    page_html = re.sub(r'<(script|style|nav|header|footer|aside)[^>]*>.*?</\1>', '', page_html, flags=re.DOTALL | re.IGNORECASE)
                    # Remove all HTML tags
                    page_text = re.sub(r'<[^>]+>', ' ', page_html)
                    # Clean up whitespace
                    page_text = re.sub(r'\s+', ' ', page_text).strip()
                    
                    # Take first 800 characters of meaningful text
                    if len(page_text) > 200:
                        formatted_results[i]["body"] = page_text[:800]
                except:
                    pass  # Keep the original DDG snippet if page fetch fails
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"results": formatted_results}).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))

    def _handle_memory_clear(self):
        try:
            global collection
            # Delete and recreate the collection to wipe it completely
            chroma_client.delete_collection(name="nemesis_docs")
            collection = chroma_client.create_collection(name="nemesis_docs", metadata={"hnsw:space": "cosine"})
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success"}).encode())
        except Exception as e:
            self.send_error(500, str(e))

    def _handle_sync_hackernews(self):
        try:
            # Clear old news so it doesn't mix with new ones
            try:
                collection.delete(where={"source": "Hacker News"})
            except Exception:
                pass
                
            # Fetch RSS feed from The Hacker News (Cybersecurity)
            resp = requests.get('https://feeds.feedburner.com/TheHackersNews', timeout=10)
            if not resp.ok:
                self.send_error(500, "Failed to fetch from The Hacker News RSS")
                return
                
            root = ET.fromstring(resp.content)
            items = root.findall('.//item')[:10] # Get top 10
            
            cleanr = re.compile('<.*?>')
            successful_chunks = 0
            
            for item in items:
                title = item.find('title').text if item.find('title') is not None else ''
                link = item.find('link').text if item.find('link') is not None else ''
                desc_raw = item.find('description').text if item.find('description') is not None else ''
                desc = re.sub(cleanr, '', desc_raw).strip()
                
                if title:
                    item_id = str(uuid.uuid5(uuid.NAMESPACE_URL, link))
                    text = f"Cybersecurity News (The Hacker News):\nTitle: {title}\nURL: {link}\nSummary: {desc}"
                    emb = get_ollama_embedding(text)
                    if emb:
                        try:
                            collection.upsert(
                                ids=[f"thn_{item_id}"],
                                embeddings=[emb],
                                documents=[text],
                                metadatas=[{"source": "Hacker News", "url": link, "title": title}]
                            )
                            successful_chunks += 1
                        except Exception as e:
                            print(f"[WARN] Failed to upsert thn_{item_id}: {e}")
                            
            if successful_chunks == 0:
                self.send_error(500, "Embedding failed or no news found")
                return
                
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "chunks": successful_chunks}).encode())
            
        except Exception as e:
            self.send_error(500, str(e))

    def _handle_sync_beritaindo(self):
        try:
            try:
                collection.delete(where={"source": "Berita Nasional"})
            except Exception:
                pass
                
            resp = requests.get('https://www.cnnindonesia.com/nasional/rss', timeout=10, headers={"User-Agent": "Mozilla/5.0"})
            if not resp.ok:
                self.send_error(500, "Failed to fetch from CNN Indonesia RSS")
                return
                
            root = ET.fromstring(resp.content)
            items = root.findall('.//item')[:15] # Top 15 berita
            
            cleanr = re.compile('<.*?>')
            successful_chunks = 0
            
            for item in items:
                title = item.find('title').text if item.find('title') is not None else ''
                link = item.find('link').text if item.find('link') is not None else ''
                desc_raw = item.find('description').text if item.find('description') is not None else ''
                desc = re.sub(cleanr, '', desc_raw).strip()
                
                if title:
                    item_id = str(uuid.uuid5(uuid.NAMESPACE_URL, link))
                    text = f"Berita Nasional (CNN Indonesia):\nJudul: {title}\nURL: {link}\nRingkasan: {desc}"
                    emb = get_ollama_embedding(text)
                    if emb:
                        try:
                            collection.upsert(
                                ids=[f"cnn_{item_id}"],
                                embeddings=[emb],
                                documents=[text],
                                metadatas=[{"source": "Berita Nasional", "url": link, "title": title}]
                            )
                            successful_chunks += 1
                        except Exception as e:
                            print(f"[WARN] Failed to upsert cnn_{item_id}: {e}")
                            
            if successful_chunks == 0:
                self.send_error(500, "Embedding failed or no news found")
                return
                
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "chunks": successful_chunks}).encode())
            
        except Exception as e:
            self.send_error(500, str(e))

    def _handle_voices(self):
        """Return daftar suara yang tersedia."""
        voices_list = []

        # Edge TTS voices
        for voice_id, label in EDGE_VOICES.items():
            voices_list.append({
                "id": f"edge:{voice_id}",
                "name": f"✦ {label}",
                "engine": "edge",
                "natural": True
            })

        # Piper fallback
        if os.path.exists(PIPER_MODEL_PATH):
            voices_list.append({
                "id": "piper:local",
                "name": "Piper Offline (Indonesia)",
                "engine": "piper",
                "natural": False
            })

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(json.dumps(voices_list).encode())

    def _handle_tts_post(self, post_data):
        try:
            data = json.loads(post_data.decode('utf-8'))
            text = data.get("text", "")
            voice = data.get("voice", f"edge:{DEFAULT_VOICE}")
            fake_query = f"text={urllib.parse.quote(text)}&voice={urllib.parse.quote(voice)}"
            parsed_url = urllib.parse.urlparse(f"/api/tts?{fake_query}")
            self._handle_tts(parsed_url)
        except Exception as e:
            self.send_error(500, str(e))

    def _handle_screen_analyze(self, post_data):
        try:
            data = json.loads(post_data.decode('utf-8'))
            prompt = data.get("prompt", "Jelaskan dan rangkum poin-poin utama dari konten di layar ini.")
            image_b64 = data.get("image", None)

            clean_b64 = None
            if image_b64 and "," in image_b64:
                clean_b64 = image_b64.split(",")[1]
            elif image_b64:
                clean_b64 = image_b64

            rag_context = ""
            emb = get_ollama_embedding(prompt)
            if emb:
                try:
                    res = collection.query(query_embeddings=[emb], n_results=2)
                    if res.get('documents') and res['documents'][0]:
                        rag_context = "\n".join(res['documents'][0])
                except Exception as e:
                    print(f"[WARN] RAG query error: {e}")

            # Dynamic Vision Model Detection on every request
            target_model = "qwen2.5:3b"
            vision_keywords = ['llava', 'vision', 'qwen2-vl', 'bakllava', 'moondream', 'minicpm', 'gemma-v']
            is_vision_model = False
            
            try:
                models_res = requests.get('http://localhost:11434/api/tags', timeout=5)
                if models_res.status_code == 200:
                    installed_models = [m['name'] for m in models_res.json().get('models', [])]
                    if clean_b64:
                        # Find best Vision model
                        for m in installed_models:
                            if any(vk in m.lower() for vk in vision_keywords):
                                target_model = m
                                is_vision_model = True
                                break
                    if not is_vision_model and installed_models:
                        target_model = installed_models[0]
            except Exception as e:
                print(f"[WARN] Could not fetch Ollama tags: {e}")

            ocr_text = ""
            if clean_b64:
                ocr_text = extract_screen_ocr(clean_b64)
                if ocr_text:
                    print(f"[Screen Analyze] Native macOS OCR extracted {len(ocr_text)} characters from screen image!")

            is_diagram_req = any(k in prompt.lower() for k in ["diagram", "arsitektur", "flowchart", "erd", "sequence", "mindmap"])
            diagram_instruction = "\n\nCatatan Khusus: Karena pengguna meminta diagram/arsitektur, buatlah sintaks Mermaid.js yang valid di dalam blok kode ```mermaid ... ``` untuk memvisualisasikan komponen dan alurnya secara jelas." if is_diagram_req else ""

            if clean_b64 and ocr_text:
                prompt_text = (
                    "BERIKUT ADALAH KONTEN TEKS HASIL TANGKAPAN LAYAR TERKINI:\n"
                    "==================================================\n"
                    f"{ocr_text}\n"
                    "==================================================\n\n"
                    f"Instruksi Pengguna: {prompt}{diagram_instruction}\n\n"
                    "Tugas: Jawablah instruksi pengguna secara lengkap, terstruktur, rinci, dan 100% akurat dalam Bahasa Indonesia berdasarkan konten teks layar di atas."
                )
            elif clean_b64:
                prompt_text = f"Jelaskan dan rangkum poin-poin penting dari gambar layar ini dalam Bahasa Indonesia secara lengkap.{diagram_instruction}\n\nPertanyaan Pengguna: {prompt}"
            else:
                prompt_text = f"Konteks Pengetahuan:\n{rag_context}\n\nPermintaan Pengguna:\n{prompt}{diagram_instruction}"

            reply = None
            try:
                payload = {
                    "model": target_model,
                    "prompt": prompt_text,
                    "stream": False
                }
                # Always attach images if clean_b64 is present
                if clean_b64:
                    payload["images"] = [clean_b64]

                print(f"[Screen Analyze] Sending request to Ollama model '{target_model}' (is_vision={is_vision_model})...")
                res = requests.post('http://localhost:11434/api/generate', json=payload, timeout=60)
                if res.status_code == 200:
                    reply = res.json().get('response', '').strip()
                    print(f"[Screen Analyze] Ollama response received ({len(reply)} chars)")

                # Fallback: If vision model gave a single word answer like "1. Yes", retry with a direct English prompt
                if clean_b64 and reply and len(reply) < 15:
                    print(f"[WARN] Vision model {target_model} returned short reply '{reply}', retrying with simplified prompt...")
                    payload["prompt"] = f"Describe and summarize all text and main content visible in this screenshot in Indonesian in detail. Question: {prompt}"
                    retry_res = requests.post('http://localhost:11434/api/generate', json=payload, timeout=60)
                    if retry_res.status_code == 200:
                        alt_reply = retry_res.json().get('response', '').strip()
                        if len(alt_reply) > len(reply):
                            reply = alt_reply

            except Exception as err:
                print(f"[ERROR] Ollama call error: {err}")

            if not reply:
                if clean_b64 and not is_vision_model:
                    reply = (
                        "🚀 **Pengunduhan Otomatis Model Vision Dimulai!**\n\n"
                        "Sistem mendeteksi model pembaca gambar belum ada di Ollama lokal Anda. **NextAI sedang mengunduh model Vision (`moondream` ~800MB) secara otomatis di latar belakang.**\n\n"
                        "Mohon tunggu sekitar 1-2 menit hingga proses pengunduhan selesai, lalu tekan **Rangkum Layar** kembali!"
                    )
                elif clean_b64:
                    reply = (
                        f"⚠️ **Respons AI Kosong.** Model {target_model} tidak memberikan tanggapan.\n\n"
                        f"Pastikan Ollama berjalan di `http://localhost:11434`."
                    )
                else:
                    reply = f"**Pertanyaan:** *{prompt}*\n\n*(Respons NextAI Spotlight Engine).* "

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "reply": reply}).encode('utf-8'))

        except Exception as e:
            print(f"[ERROR] Screen analyze handler error: {e}")
            self.send_error(500, str(e))

    def _handle_tts(self, parsed_url):
        """Generate speech dari teks."""
        query = urllib.parse.parse_qs(parsed_url.query)
        text = query.get("text", [""])[0]
        voice = query.get("voice", [f"edge:{DEFAULT_VOICE}"])[0]

        if not text:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Parameter 'text' kosong.")
            return

        print(f"[TTS] Voice: {voice} | Text: {text[:80]}...")

        try:
            fd, temp_path = tempfile.mkstemp(suffix=".mp3" if voice.startswith("edge:") else ".wav")
            os.close(fd)

            if voice.startswith("edge:"):
                # Edge TTS (natural neural voice)
                edge_voice_id = voice.replace("edge:", "")
                if edge_voice_id not in EDGE_VOICES:
                    edge_voice_id = DEFAULT_VOICE

                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    loop.run_until_complete(generate_edge_tts(text, edge_voice_id, temp_path))
                finally:
                    loop.close()

                content_type = "audio/mpeg"

            elif voice == "piper:local":
                # Piper offline fallback
                generate_piper_tts(text, temp_path)
                content_type = "audio/wav"

            else:
                # Default to Edge TTS
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    loop.run_until_complete(generate_edge_tts(text, DEFAULT_VOICE, temp_path))
                finally:
                    loop.close()
                content_type = "audio/mpeg"

            # Send audio back to browser
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()

            with open(temp_path, "rb") as f:
                self.wfile.write(f.read())

            try:
                os.remove(temp_path)
            except Exception:
                pass

        except Exception as e:
            print(f"[ERROR] TTS Exception: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"TTS Error: {str(e)}".encode())

def run():
    project_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_root)

    print("=" * 50)
    print("  Nemesis AI — Server Lokal")
    print("=" * 50)

    # Setup Edge TTS (primary, natural voice)
    edge_ok = setup_edge_tts()
    if edge_ok:
        print("[INFO] ✓ Edge TTS (Natural Neural Voice) siap.")
    else:
        print("[WARN] ✗ Edge TTS tidak tersedia, menggunakan Piper sebagai fallback.")

    # Setup Piper (fallback offline)
    try:
        setup_piper()
        print("[INFO] ✓ Piper TTS (Offline Fallback) siap.")
    except Exception as e:
        print(f"[WARN] ✗ Piper TTS tidak tersedia: {e}")

    print()
    server_address = ("", PORT)
    HTTPServer.allow_reuse_address = True
    httpd = HTTPServer(server_address, NemesisHandler)
    print(f"[INFO] Server berjalan di http://localhost:{PORT}")
    print("[INFO] Tekan Ctrl+C untuk menghentikan.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Server dihentikan.")
        sys.exit(0)

if __name__ == "__main__":
    run()
