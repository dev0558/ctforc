export default {
  id: 'forensics',
  name: 'Forensics',
  description: 'PCAP analysis, memory forensics, disk image analysis, log investigation, steganography, and artifact recovery.',
  icon: 'search',
  color: '#c084fc',
  defaultTechStack: ['Python', 'Wireshark', 'Scapy', 'Volatility'],
  difficulties: [
    { level: 'easy', points: [100, 200], estimatedMinutes: 20, description: 'Single file analysis, basic encoding' },
    { level: 'medium', points: [300, 400], estimatedMinutes: 45, description: 'Multi-file correlation, steganography' },
    { level: 'hard', points: [500], estimatedMinutes: 90, description: 'Memory dumps, custom protocols, multi-layer encoding' },
  ],
  artifactTypes: ['Artifact generator', 'Evidence files', 'Analysis hints', 'Writeup'],
  outputFiles: ['generate_artifacts.py', 'analysis_hints.txt', 'writeup.md'],
  difficultyWeights: { easy: 100, medium: 300, hard: 500 },
  supportsDocker: false,
  formFields: [
    { name: 'artifactType', label: 'Primary Artifact', type: 'select', options: ['PCAP', 'Memory Dump', 'Disk Image', 'Log Files', 'Image (Stego)', 'PDF', 'Network Logs', 'Other'] },
    { name: 'hidingMethod', label: 'Data Hiding Method', type: 'select', options: ['Steganography', 'Encoding Chain', 'Protocol Abuse', 'File Carving', 'Metadata', 'Encrypted Archive', 'Custom'] },
    { name: 'multiArtifact', label: 'Multi-Artifact Correlation', type: 'checkbox', default: false },
  ],
  exampleIdeas: [
    'PCAP file containing DNS tunneling data exfiltration hidden in TXT record queries',
    'Memory dump from a compromised Windows system with malware artifacts to recover',
    'Steganographic data hidden in multiple PNG images requiring LSB extraction',
  ],
  promptHints: 'Create realistic forensic artifacts. PCAPs should contain real-looking traffic with the malicious data mixed in. Use multiple encoding layers for anti-AI resistance.',
  builder: true,
};
