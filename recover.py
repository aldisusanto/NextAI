import json

transcript_path = "/Users/aldisusanto/.gemini/antigravity-ide/brain/483f9c7c-fca2-4aef-b965-9a7a9dbf3535/.system_generated/logs/transcript.jsonl"
edits = []

with open(transcript_path, 'r') as f:
    for line in f:
        try:
            step = json.loads(line)
            if step.get("type") == "PLANNER_RESPONSE" and "tool_calls" in step:
                for tc in step["tool_calls"]:
                    if tc["name"] in ("replace_file_content", "multi_replace_file_content"):
                        args = tc.get("args", {})
                        target = args.get("TargetFile", "")
                        if "app.js" in target:
                            edits.append(args)
        except Exception as e:
            pass

with open("/tmp/app_js_edits.json", "w") as f:
    json.dump(edits, f, indent=2)
print(f"Dumped {len(edits)} edits")
