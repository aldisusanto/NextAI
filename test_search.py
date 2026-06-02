import chromadb
import requests

def get_ollama_embedding(text):
    response = requests.post('http://localhost:11434/api/embeddings', json={"model": "nomic-embed-text", "prompt": text})
    return response.json()['embedding']

chroma_client = chromadb.PersistentClient(path=".chroma_db")
collection = chroma_client.get_collection(name="nemesis_docs")

query = "Berita apa saja yang ada di Hacker News hari ini?"
emb = get_ollama_embedding(query)
results = collection.query(query_embeddings=[emb], n_results=20, include=["documents", "metadatas", "distances"])
for i in range(len(results['documents'][0])):
    print(f"[{i+1}] Distance: {results['distances'][0][i]:.2f} | Source: {results['metadatas'][0][i].get('source')} | {results['documents'][0][i][:50]}")

