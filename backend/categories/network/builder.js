/**
 * Network — category-specific builder.
 * Mock implementation that uses the REAL spec data (flag, name, exploit path).
 * Phase 3: will call Claude API with prompt.md like web/forensics builders.
 */
export default {
  categoryId: 'network',

  async build(spec) {
    const name = spec.challengeName || spec.challenge_name || 'Network Challenge';
    const flag = spec.flag || (Array.isArray(spec.flags) && spec.flags[0]) || null;
    if (!flag) throw new Error('Network builder: spec has no flag');

    const narrative = spec.narrative || 'Analyze the network traffic.';
    const difficulty = spec.difficulty || 'medium';
    const points = spec.points || 300;
    const exploitPath = spec.exploitPath || ['Capture traffic', 'Analyze protocols', 'Extract the flag'];
    const techStack = spec.techStack || ['Python', 'Scapy', 'Wireshark'];
    const antiAi = spec.antiAiCountermeasures || [];

    return {
      files: [
        {
          path: 'generate_pcap.py',
          language: 'python',
          content: `#!/usr/bin/env python3
"""${name} - Network Capture Generator"""
# Tech stack: ${techStack.join(', ')}
# Difficulty: ${difficulty}
import struct, base64

FLAG = "${flag}"

# TODO: Phase 3 will generate real Scapy-based PCAP matching the spec
# Exploit path:
${exploitPath.map((s, i) => `#   ${i + 1}. ${s}`).join('\n')}

def generate():
    encoded = base64.b64encode(FLAG.encode()).decode()
    with open("capture.pcap", "wb") as f:
        f.write(struct.pack("<IHHIIII", 0xa1b2c3d4, 2, 4, 0, 0, 65535, 1))
    print(f"[+] PCAP generated: capture.pcap")

if __name__ == "__main__":
    generate()
`,
        },
        {
          path: 'solve.py',
          language: 'python',
          content: `#!/usr/bin/env python3
"""Solver for ${name}"""
${exploitPath.map((s, i) => `# Step ${i + 1}: ${s}`).join('\n')}

print("[*] Running network solver...")
${exploitPath.map((s, i) => `print("[*] Step ${i + 1}: ${s}")`).join('\n')}
print(f"[+] Flag: ${flag}")
`,
        },
        {
          path: 'writeup.md',
          language: 'markdown',
          content: `# ${name} - Writeup

## Challenge Description
${narrative}

## Difficulty
${difficulty} (${points} points)

## Tech Stack
${techStack.map((t) => `- ${t}`).join('\n')}

## Solution
${exploitPath.map((s, i) => `${i + 1}. ${s}`).join('\n')}
${antiAi.length > 0 ? `\n## Anti-AI Measures\n${antiAi.map((m) => `- ${m}`).join('\n')}\n` : ''}
## Flag
\`${flag}\`
`,
        },
      ],
      tokenUsage: 0,
      durationMs: 0,
    };
  },
};
