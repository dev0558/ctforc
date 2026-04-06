import { initDb, createBatch, createJob, updateJobStatus, createSpec, createChallenge, createReview } from './client.js';

async function seed() {
  await initDb();
  console.log('Seeding database...');

  const batch = createBatch('cve', 3);
  const job1 = createJob({ batchId: batch.id, cveId: 'CVE-2023-22527', category: 'web', difficulty: 'hard' });
  const job2 = createJob({ batchId: batch.id, cveId: 'CVE-2024-50379', category: 'web', difficulty: 'medium' });
  const job3 = createJob({ batchId: batch.id, cveId: 'CVE-2023-44487', category: 'network', difficulty: 'hard' });

  // Move job1 to pending_spec_review with a spec
  updateJobStatus(job1.id, 'pending_spec_review');
  createSpec({
    jobId: job1.id,
    specJson: {
      challenge_name: 'Confluence OGNL Injection',
      category: 'web',
      difficulty: 'hard',
      points: 500,
      narrative: 'A vulnerable Confluence instance has been deployed. Exploit the OGNL injection vulnerability to achieve remote code execution.',
      tech_stack: ['Python', 'Flask', 'Docker'],
      vulnerability: { type: 'OGNL Injection', cwe: 'CWE-94' },
      exploit_path: ['Discover vulnerable endpoint', 'Craft OGNL payload', 'Execute RCE', 'Read flag'],
      flags: ['Exploit3rs{c0nflu3nc3_pwn3d_2023}'],
      hints: ['Check template injection endpoints', 'OGNL is not just for Java beans'],
      anti_ai_measures: ['Obfuscated flag in binary', 'Multi-step exploitation required'],
      estimated_time: '45 minutes',
      files_needed: ['Dockerfile', 'app.py', 'requirements.txt', 'exploit.py', 'writeup.md'],
    },
    tokenUsage: 1250,
    generationTimeMs: 3200,
  });

  // Leave job2 as queued
  // Move job3 to ready
  updateJobStatus(job3.id, 'researching');
  updateJobStatus(job3.id, 'pending_spec_review');
  createSpec({
    jobId: job3.id,
    specJson: {
      challenge_name: 'HTTP/2 Rapid Reset',
      category: 'network',
      difficulty: 'hard',
      points: 600,
      narrative: 'Analyze network captures to identify the HTTP/2 Rapid Reset attack pattern.',
      tech_stack: ['Wireshark', 'Python', 'scapy'],
      vulnerability: { type: 'DoS', cwe: 'CWE-400' },
      exploit_path: ['Capture traffic', 'Identify RST_STREAM pattern', 'Extract flag from headers'],
      flags: ['Exploit3rs{r4p1d_r3s3t_d3t3ct3d}'],
      hints: ['Look at HTTP/2 frame types', 'Count RST_STREAM frames'],
      anti_ai_measures: ['Custom protocol variant', 'Steganographic flag embedding'],
      estimated_time: '30 minutes',
      files_needed: ['capture.pcap', 'analysis.py', 'writeup.md'],
    },
    tokenUsage: 980,
    generationTimeMs: 2800,
  });
  updateJobStatus(job3.id, 'spec_approved');
  createReview({ jobId: job3.id, stage: 'spec', action: 'approve', notes: 'Looks good' });
  updateJobStatus(job3.id, 'building');
  updateJobStatus(job3.id, 'pending_build_review');
  createChallenge({
    jobId: job3.id,
    fileManifest: [
      { path: 'capture.pcap', content: '(binary pcap data)', language: 'binary' },
      { path: 'analysis.py', content: '#!/usr/bin/env python3\nimport scapy\n# Analysis script', language: 'python' },
      { path: 'writeup.md', content: '# HTTP/2 Rapid Reset Writeup\n\n## Solution\n...', language: 'markdown' },
    ],
    tokenUsage: 1800,
    generationTimeMs: 5100,
  });

  console.log('Seed complete. Created:');
  console.log(`  Batch: ${batch.id}`);
  console.log(`  Job 1 (pending_spec_review): ${job1.id}`);
  console.log(`  Job 2 (queued): ${job2.id}`);
  console.log(`  Job 3 (pending_build_review): ${job3.id}`);
}

seed().catch(console.error);
