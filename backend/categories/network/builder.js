/**
 * Network — category-specific builder.
 * Phase 1: returns mock challenge files.
 */
export default {
  categoryId: 'network',

  async build(spec) {
    const name = spec.challengeName || spec.challenge_name || 'Network Challenge';
    const flag = spec.flags?.[0] || 'Exploit3rs{n3tw0rk_d3f4ult}';
    const narrative = spec.narrative || 'Analyze the network traffic to uncover the hidden data.';
    const difficulty = spec.difficulty || 'medium';
    const points = spec.points || 300;

    return [
      {
        path: 'generate_pcap.py',
        language: 'python',
        content: `#!/usr/bin/env python3
"""${name} - PCAP Generator"""
import struct, base64

FLAG = "${flag}"

def generate():
    encoded = base64.b64encode(FLAG.encode()).decode()
    # Mock PCAP with DNS queries containing encoded flag
    with open("capture.pcap", "wb") as f:
        f.write(struct.pack("<IHHIIII", 0xa1b2c3d4, 2, 4, 0, 0, 65535, 1))
    print(f"[+] PCAP generated: capture.pcap")
    print(f"[+] Hidden data in DNS queries")

if __name__ == "__main__":
    generate()`,
      },
      {
        path: 'capture.pcap',
        language: 'binary',
        content: '[ PCAP data would be here — mock for Phase 1 ]',
      },
      {
        path: 'network_topology.txt',
        language: 'text',
        content: `${name} - Network Topology
==================================
[Attacker] 10.0.0.50
    |
[Switch] ---- [Firewall] ---- [Server] 10.0.0.10
    |
[Victim] 10.0.0.100

Key ports: 53 (DNS), 80 (HTTP), 443 (HTTPS)
Suspicious traffic on port 53 — investigate DNS queries`,
      },
      {
        path: 'solve.py',
        language: 'python',
        content: `#!/usr/bin/env python3
"""Solver for ${name}"""
print("[*] Loading PCAP file...")
print("[*] Step 1: Filter DNS traffic")
print("[*] Step 2: Extract encoded data from queries")
print("[*] Step 3: Decode base64 payload")
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
1. Open the PCAP in Wireshark and examine the traffic
2. Filter for suspicious protocol activity
3. Extract encoded data from packet payloads
4. Decode through encoding layers to recover the flag

## Flag
\`${flag}\``,
      },
    ];
  },
};
