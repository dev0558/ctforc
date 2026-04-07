export default {
  id: 'cryptography',
  name: 'Cryptography',
  description: 'Classical ciphers, modern crypto attacks, RSA, AES, hash cracking, key exchange flaws, and custom cryptographic implementations.',
  icon: 'lock',
  color: '#ffd93d',
  defaultTechStack: ['Python', 'PyCryptodome', 'SageMath'],
  difficulties: [
    { level: 'easy', points: [100, 200], estimatedMinutes: 20, description: 'Classical ciphers, base encoding, simple XOR' },
    { level: 'medium', points: [300, 400], estimatedMinutes: 45, description: 'RSA with small primes, AES-ECB, hash collisions' },
    { level: 'hard', points: [500], estimatedMinutes: 90, description: 'Elliptic curve attacks, padding oracle, custom crypto' },
  ],
  outputFiles: ['encrypt.py', 'ciphertext.txt', 'public_key.pem', 'solve.py', 'writeup.md'],
  formFields: [
    { name: 'cryptoType', label: 'Crypto Type', type: 'select', options: ['RSA', 'AES', 'XOR', 'Classical Cipher', 'Hash', 'Elliptic Curve', 'Diffie-Hellman', 'Custom Algorithm', 'Other'] },
    { name: 'attackType', label: 'Attack Vector', type: 'select', options: ['Factoring', 'Padding Oracle', 'Brute Force', 'Known Plaintext', 'Frequency Analysis', 'Side Channel', 'Implementation Flaw', 'Custom'] },
    { name: 'providesSource', label: 'Provide Encryption Source', type: 'checkbox', default: true },
  ],
  exampleIdeas: [
    'RSA challenge with a shared prime between two public keys',
    'AES-ECB oracle that leaks information through block alignment',
    'Custom substitution cipher with frequency analysis and a twist',
  ],
  promptHints: 'Provide the encryption script so players can analyze the algorithm. Use mathematically interesting attacks, not just brute force. Include solver script in writeup.',
};
