/**
 * OSINT — category-specific builder.
 * Phase 1: returns mock challenge files.
 */
export default {
  categoryId: 'osint',

  async build(spec) {
    const name = spec.challengeName || spec.challenge_name || 'OSINT Challenge';
    const flag = spec.flags?.[0] || 'Exploit3rs{0s1nt_d3f4ult}';
    const narrative = spec.narrative || 'Use open-source intelligence to uncover the hidden truth.';
    const difficulty = spec.difficulty || 'medium';
    const points = spec.points || 300;

    return [
      {
        path: 'setup_profiles.py',
        language: 'python',
        content: `#!/usr/bin/env python3
"""${name} - Profile/Artifact Setup"""
import json

profiles = {
    "target_user": {
        "username": "j0hn_d03_1337",
        "platform": "fake-social",
        "bio": "Security enthusiast | Coffee addict | ${flag.slice(0, 10)}...",
        "posts": [
            "Just started a new project at ACME Corp #infosec",
            "Check out my talk at DEF CON village!",
            "Location: Dubai Marina, UAE"
        ],
        "connections": ["alice_sec", "bob_hacker", "charlie_dev"]
    }
}

with open("profiles.json", "w") as f:
    json.dump(profiles, f, indent=2)

print("[+] OSINT artifacts generated")`,
      },
      {
        path: 'profiles.json',
        language: 'json',
        content: JSON.stringify({
          target_user: {
            username: 'j0hn_d03_1337',
            platform: 'fake-social',
            bio: 'Security enthusiast | Coffee addict',
            posts: ['Just started a new project at ACME Corp #infosec'],
            metadata: { hint: 'Check the EXIF data of the profile picture' },
          },
        }, null, 2),
      },
      {
        path: 'solve.py',
        language: 'python',
        content: `#!/usr/bin/env python3
"""Solver for ${name}"""
print("[*] Step 1: Enumerate target's social profiles")
print("[*] Step 2: Cross-reference information across platforms")
print("[*] Step 3: Extract metadata from shared images")
print("[*] Step 4: Piece together the breadcrumbs")
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
1. Start with the provided username/profile information
2. Search across platforms for additional breadcrumbs
3. Analyze image metadata (EXIF) for hidden clues
4. Correlate findings to assemble the flag

## Flag
\`${flag}\``,
      },
    ];
  },
};
