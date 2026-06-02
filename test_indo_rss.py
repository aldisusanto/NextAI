import requests
import xml.etree.ElementTree as ET

urls = [
    "https://www.antaranews.com/rss/terkini.xml",
    "https://www.cnnindonesia.com/nasional/rss",
    "https://sindikasi.kompas.com/xml/terkini"
]

for url in urls:
    try:
        r = requests.get(url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
        print(f"{url} - {r.status_code}")
        if r.status_code == 200:
            root = ET.fromstring(r.content)
            items = root.findall('.//item')
            print(f"  Found {len(items)} items")
            if items:
                title = items[0].find('title')
                print(f"  Sample: {title.text if title is not None else 'No title'}")
    except Exception as e:
        print(f"{url} - Error: {e}")
