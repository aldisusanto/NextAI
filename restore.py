import json
import ast

with open("/tmp/app_js_edits.json", "r") as f:
    edits = json.load(f)

with open("/Users/aldisusanto/Downloads/AI/app.js", "r") as f:
    content = f.read()

for i in range(7):
    edit = edits[i]
    if "ReplacementChunks" in edit:
        chunks = edit["ReplacementChunks"]
        if isinstance(chunks, str):
            try:
                chunks = json.loads(chunks)
            except:
                chunks = ast.literal_eval(chunks)
                
        for chunk in chunks:
            target = chunk["TargetContent"]
            replacement = chunk["ReplacementContent"]
            if target in content:
                content = content.replace(target, replacement)
                print(f"Applied multi-replace chunk in edit {i}")
            else:
                print(f"Failed to find target in edit {i}")
    else:
        target = edit["TargetContent"]
        replacement = edit["ReplacementContent"]
        if target in content:
            content = content.replace(target, replacement)
            print(f"Applied replace in edit {i}")
        else:
            print(f"Failed to find target in edit {i}")

with open("/Users/aldisusanto/Downloads/AI/app.js", "w") as f:
    f.write(content)
print("Restored app.js successfully!")
