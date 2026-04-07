/**
 * OSINT — category-specific builder.
 * Mock implementation that uses the REAL spec data (flag, name, exploit path).
 * Phase 3: will call Claude API with prompt.md like web/forensics builders.
 */
export default {
  categoryId: 'osint',

  async build(spec) {
    const name = spec.challengeName || spec.challenge_name || 'OSINT Challenge';
    const flag = spec.flag || (Array.isArray(spec.flags) && spec.flags[0]) || null;
    if (!flag) throw new Error('OSINT builder: spec has no flag');

    const narrative = spec.narrative || 'Use open-source intelligence to uncover the truth.';
    const difficulty = spec.difficulty || 'medium';
    const points = spec.points || 300;
    const exploitPath = spec.exploitPath || ['Enumerate profiles', 'Cross-reference data', 'Extract the flag'];
    const techStack = spec.techStack || ['Python', 'ExifTool'];
    const antiAi = spec.antiAiCountermeasures || [];

    return {
      files: [
        {
          path: 'setup_profiles.py',
          language: 'python',
          content: `#!/usr/bin/env python3
"""${name} - OSINT Artifact Setup"""
# Tech stack: ${techStack.join(', ')}
# Difficulty: ${difficulty}
import json

FLAG = "${flag}"

# TODO: Phase 3 will generate real OSINT artifacts matching the spec
# Exploit path:
${exploitPath.map((s, i) => `#   ${i + 1}. ${s}`).join('\n')}

profiles = {
    "target": {
        "name": "Investigation Target",
        "narrative": """${narrative.replace(/"/g, '\\"')}""",
        "breadcrumbs": ${JSON.stringify(exploitPath)},
        "flag_location": "hidden in metadata"
    }
}

with open("profiles.json", "w") as f:
    json.dump(profiles, f, indent=2)
print("[+] OSINT artifacts generated")
`,
        },
        {
          path: 'solve.py',
          language: 'python',
          content: `#!/usr/bin/env python3
"""Solver for ${name}"""
${exploitPath.map((s, i) => `# Step ${i + 1}: ${s}`).join('\n')}

print("[*] Running OSINT solver...")
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
