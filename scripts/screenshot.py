"""Take real screenshots of AILatest Journal via Chrome DevTools Protocol"""
import json
import base64
import time
import os
import requests
from websocket import create_connection

BASE = "/Users/zhizhi/Library/CloudStorage/GoogleDrive-jiantaoweng@gmail.com/我的云端硬盘/AI 工作区/00_每日更新/ailatest-journal"
os.makedirs(f"{BASE}/screenshots", exist_ok=True)

def send_cmd(ws, method, params=None):
    """Send a CDP command and return the result."""
    msg_id = send_cmd.next_id
    send_cmd.next_id += 1
    cmd = {"id": msg_id, "method": method}
    if params:
        cmd["params"] = params
    ws.send(json.dumps(cmd))
    while True:
        resp = json.loads(ws.recv())
        if resp.get("id") == msg_id:
            return resp.get("result", {})
send_cmd.next_id = 1

# Find the page
resp = requests.get("http://localhost:9222/json")
pages = resp.json()
target = None
for p in pages:
    if "journal.ailatest.org" in p.get("url", ""):
        target = p
        break
if not target and pages:
    target = pages[0]

if not target:
    print("No page found!")
    exit(1)

ws_url = target["webSocketDebuggerUrl"]
print(f"Connecting to: {ws_url}")
ws = create_connection(ws_url, timeout=30)

# Set viewport to 1440x900 for nice screenshots
send_cmd(ws, "Emulation.setDeviceMetricsOverride", {
    "width": 1440,
    "height": 900,
    "deviceScaleFactor": 2,
    "mobile": False
})

time.sleep(0.5)

def screenshot(filename, selector_js=None, wait_js=None):
    """Take a full-page screenshot."""
    if wait_js:
        ws.send(json.dumps({"id": send_cmd.next_id, "method": "Runtime.evaluate",
                            "params": {"expression": wait_js}}))
        send_cmd.next_id += 1
        time.sleep(2)
    
    result = send_cmd(ws, "Page.captureScreenshot", {"format": "png", "fromSurface": True})
    if "data" in result:
        data = base64.b64decode(result["data"])
        filepath = f"{BASE}/screenshots/{filename}"
        with open(filepath, "wb") as f:
            f.write(data)
        print(f"Saved: {filename} ({len(data)//1024} KB)")
    else:
        print(f"Failed: {filename} - {result}")

# Screenshot 1: Main dashboard (international tab)
print("\n=== Screenshot 1: Main dashboard ===")
time.sleep(2)
screenshot("preview.png")

# Screenshot 2: Switch to "帮我选刊" tab
print("\n=== Screenshot 2: Pick for Me ===")
send_cmd(ws, "Runtime.evaluate", {
    "expression": """
    (function() {
        var tab = document.querySelector('[data-tab=\"pick\"]');
        if (tab) tab.click();
    })();
    """
})
time.sleep(2)
screenshot("pick-tool.png", wait_js="document.querySelector('#pick-results') !== null || true")

# Screenshot 3: Do a search first to show results
print("\n=== Screenshot 3: Pick results ===")
send_cmd(ws, "Runtime.evaluate", {
    "expression": """
    (function() {
        var input = document.getElementById('pick-input');
        var btn = document.getElementById('pick-search-btn');
        if (input && btn) {
            input.value = 'indoor air quality occupancy estimation';
            btn.click();
        }
    })();
    """
})
# Wait for results to load
time.sleep(8)
screenshot("pick-results.png")

# Screenshot 4: Journal drawer (click first result card)
print("\n=== Screenshot 4: Journal Detail Drawer ===")
send_cmd(ws, "Runtime.evaluate", {
    "expression": """
    (function() {
        var card = document.querySelector('.pick-card');
        if (card) card.click();
    })();
    """
})
time.sleep(3)
screenshot("drawer.png")

ws.close()
print("\n=== All screenshots done! ===")
