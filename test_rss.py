import requests
import xml.etree.ElementTree as ET
import re

def clean_html(raw_html):
    if not raw_html: return ""
    cleanr = re.compile('<.*?>')
    return re.sub(cleanr, '', raw_html).strip()

resp = requests.get('https://feeds.feedburner.com/TheHackersNews', timeout=10)
if resp.ok:
    root = ET.fromstring(resp.content)
    items = root.findall('.//item')[:3]
    for i, item in enumerate(items):
        title = item.find('title').text if item.find('title') is not None else ''
        link = item.find('link').text if item.find('link') is not None else ''
        desc = item.find('description').text if item.find('description') is not None else ''
        desc = clean_html(desc)
        print(f"[{i+1}] {title}")
        print(f"Link: {link}")
        print(f"Desc: {desc[:100]}...\n")
