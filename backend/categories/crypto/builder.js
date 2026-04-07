/**
 * Cryptography — category-specific builder.
 * Phase 1: returns mock challenge files.
 */
export default {
  categoryId: 'crypto',

  async build(spec) {
    const name = spec.challengeName || spec.challenge_name || 'Crypto Challenge';
    const flag = spec.flags?.[0] || 'Exploit3rs{crypt0_d3f4ult}';
    const narrative = spec.narrative || 'Break the cryptographic scheme to recover the flag.';
    const difficulty = spec.difficulty || 'medium';
    const points = spec.points || 300;

    return [
      {
        path: 'encrypt.py',
        language: 'python',
        content: `#!/usr/bin/env python3
"""${name} - Encryption Script"""
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_OAEP
import os

FLAG = b"${flag}"

# Generate RSA keys with a deliberate weakness
p = 0xFFFFFFFFFFFFFFC5  # Small prime for CTF
q = 0xFFFFFFFFFFFFFFBF  # Small prime for CTF
n = p * q
e = 65537

key = RSA.construct((n, e))
cipher = PKCS1_OAEP.new(key)

with open("public_key.pem", "wb") as f:
    f.write(key.publickey().export_key())

# In real challenge, encrypt flag with the weak key
ciphertext = FLAG  # Placeholder — Phase 3 will use real encryption
with open("ciphertext.txt", "wb") as f:
    f.write(ciphertext)

print("[+] Encryption complete. Files: public_key.pem, ciphertext.txt")`,
      },
      {
        path: 'ciphertext.txt',
        language: 'text',
        content: '[ encrypted data would be here — mock for Phase 1 ]',
      },
      {
        path: 'public_key.pem',
        language: 'text',
        content: '[ RSA public key would be here — mock for Phase 1 ]',
      },
      {
        path: 'solve.py',
        language: 'python',
        content: `#!/usr/bin/env python3
"""Solver for ${name}"""
from Crypto.PublicKey import RSA
from sympy import factorint

print("[*] Loading public key...")
print("[*] Step 1: Factor the modulus (weak primes)")
print("[*] Step 2: Reconstruct private key")
print("[*] Step 3: Decrypt ciphertext")
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
1. Extract the public key modulus N and exponent e
2. Factor N using known factoring methods (small primes)
3. Compute the private key from p, q, and e
4. Decrypt the ciphertext to recover the flag

## Flag
\`${flag}\``,
      },
    ];
  },
};
