import json

with open("/tmp/app_js_edits.json", "r") as f:
    edits = json.load(f)

# The last edit is the one where I deleted the crypto functions using multi-replace
edit = edits[-1] 
for chunk in edit["ReplacementChunks"]:
    if "function fetchCryptoData" in chunk["TargetContent"]:
        with open("/tmp/deleted_crypto_code.js", "w") as f:
            f.write(chunk["TargetContent"])
        print("Recovered deleted code!")
