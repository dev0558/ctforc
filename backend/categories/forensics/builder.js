/**
 * Forensics — category-specific builder.
 * Phase 1: returns mock challenge files.
 */
export default {
  categoryId: 'forensics',

  async build(spec) {
    const name = spec.challengeName || spec.challenge_name || 'Forensics Challenge';
    const flag = spec.flags?.[0] || 'Exploit3rs{f0r3ns1cs_d3f4ult}';
    const narrative = spec.narrative || 'Analyze the artifacts and recover the hidden data.';
    const difficulty = spec.difficulty || 'medium';
    const points = spec.points || 300;

    return [
      {
        path: 'generate_artifacts.py',
        language: 'python',
        content: `#!/usr/bin/env python3
"""${name} - Artifact Generator"""
import os, struct, base64

FLAG = "${flag}"

def generate_pcap():
    """Generate a PCAP file with hidden data"""
    # Mock PCAP generation — Phase 3 will use Scapy
    print(f"[*] Generating PCAP with hidden flag...")
    encoded = base64.b64encode(FLAG.encode()).decode()
    with open("evidence.pcap", "wb") as f:
        # PCAP global header
        f.write(struct.pack("<IHHIIII", 0xa1b2c3d4, 2, 4, 0, 0, 65535, 1))
        print(f"[+] PCAP generated: evidence.pcap")
    return encoded

if __name__ == "__main__":
    generate_pcap()
    print("[+] Artifacts generated successfully")`,
      },
      {
        path: 'analysis_hints.txt',
        language: 'text',
        content: `${name} - Analysis Hints
================================
1. Start by examining the file headers
2. Look for anomalous patterns in the data
3. Consider multiple encoding layers
4. The answer hides in plain sight — if you know where to look

Difficulty: ${difficulty} (${points} pts)`,
      },
      {
        path: 'solve.py',
        language: 'python',
        content: `#!/usr/bin/env python3
"""Solver for ${name}"""
import base64

print("[*] Analyzing artifacts...")
print("[*] Step 1: Extract hidden data from PCAP")
print("[*] Step 2: Decode base64 layer")
print("[*] Step 3: Recover flag")
print(f"[+] Flag: ${flag}")`,
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
1. Open the evidence file and identify the artifact type
2. Analyze traffic patterns / file structure for anomalies
3. Extract the hidden data using appropriate tools
4. Decode through the encoding layers to recover the flag

## Flag
\`${flag}\``,
      },
    ];
  },
};
