export default {
  id: 'pwn',
  name: 'Binary Exploitation (Pwn)',
  description: 'Buffer overflows, format string bugs, heap exploitation, ROP chains, shellcoding, and binary reverse engineering.',
  icon: 'terminal',
  color: '#ff6b6b',
  defaultTechStack: ['C', 'GCC', 'Python', 'pwntools', 'Docker'],
  difficulties: [
    { level: 'easy', points: [100, 200], estimatedMinutes: 30, description: 'Basic buffer overflow, no protections' },
    { level: 'medium', points: [300, 400], estimatedMinutes: 60, description: 'Stack canary bypass, ROP, format string' },
    { level: 'hard', points: [500], estimatedMinutes: 120, description: 'Heap exploitation, ASLR+PIE bypass, kernel pwn' },
  ],
  outputFiles: ['vuln.c', 'Makefile', 'Dockerfile', 'exploit.py', 'writeup.md'],
  formFields: [
    { name: 'vulnType', label: 'Vulnerability Type', type: 'select', options: ['Buffer Overflow', 'Format String', 'Heap Overflow', 'Use-After-Free', 'Integer Overflow', 'Race Condition', 'ROP', 'Shellcoding', 'Other'] },
    { name: 'protections', label: 'Binary Protections', type: 'select', options: ['None', 'NX Only', 'NX + Canary', 'NX + Canary + ASLR', 'Full (NX+Canary+ASLR+PIE)', 'Custom'] },
    { name: 'architecture', label: 'Architecture', type: 'select', options: ['x86', 'x86_64', 'ARM', 'MIPS'] },
  ],
  exampleIdeas: [
    'Stack buffer overflow with NX enabled requiring a ROP chain to call system("/bin/sh")',
    'Format string vulnerability in a setuid binary to overwrite GOT entry',
    'Heap use-after-free in a custom memory allocator leading to arbitrary write',
  ],
  promptHints: 'Provide C source code and a Makefile with specific compiler flags for protections. Include a Docker setup for consistent exploitation environment. Binary should be compiled for the target architecture.',
};
