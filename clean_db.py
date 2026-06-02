import chromadb
chroma_client = chromadb.PersistentClient(path=".chroma_db")
collection = chroma_client.get_collection(name="nemesis_docs")
try:
    collection.delete(where={"source": "Hacker News"})
    print("Deleted old Hacker News data successfully.")
except Exception as e:
    print("Error deleting:", e)
