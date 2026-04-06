import { Worker } from 'bullmq';
import { getConnection } from '../index.js';
import { getJob, updateJobStatus, createSpec } from '../../db/client.js';

const MOCK_SPECS = {
  web: (cveId, idea) => ({
    challenge_name: cveId ? `Web Exploit - ${cveId}` : `Web Challenge - ${idea?.substring(0, 30)}`,
    category: 'web',
    difficulty: 'medium',
    points: 400,
    narrative: cveId
      ? `A vulnerable web application has been identified with ${cveId}. Your mission is to exploit this vulnerability and retrieve the flag.`
      : `${idea || 'A custom web exploitation challenge.'}`,
    tech_stack: ['Python', 'Flask', 'Docker'],
    vulnerability: { type: 'Injection', cwe: 'CWE-94' },
    exploit_path: [
      'Enumerate the web application',
      'Identify the vulnerable endpoint',
      'Craft and deliver the exploit payload',
      'Retrieve the flag from the server',
    ],
    flags: [`Exploit3rs{${(cveId || 'web').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_pwn3d}`],
    hints: [
      'Look at input validation on form fields',
      'Try common injection payloads',
    ],
    anti_ai_measures: [
      'Multi-step exploitation required',
      'Obfuscated flag location',
      'Custom binary verification',
    ],
    estimated_time: '45 minutes',
    files_needed: ['Dockerfile', 'app.py', 'requirements.txt', 'exploit.py', 'writeup.md'],
  }),
  forensics: (cveId, idea) => ({
    challenge_name: cveId ? `Forensics - ${cveId}` : `Forensics Challenge`,
    category: 'forensics',
    difficulty: 'medium',
    points: 350,
    narrative: idea || 'Analyze the provided artifacts to find the hidden flag.',
    tech_stack: ['Wireshark', 'Python', 'volatility'],
    vulnerability: { type: 'Data Exfiltration', cwe: 'CWE-200' },
    exploit_path: ['Extract artifacts', 'Analyze patterns', 'Decode hidden data', 'Retrieve flag'],
    flags: ['Exploit3rs{f0r3ns1cs_m4st3r}'],
    hints: ['Check file headers', 'Look for steganography'],
    anti_ai_measures: ['Custom encoding scheme', 'Multi-layer obfuscation'],
    estimated_time: '30 minutes',
    files_needed: ['capture.pcap', 'analysis.py', 'writeup.md'],
  }),
  default: (cveId, idea, category) => ({
    challenge_name: cveId ? `${category || 'Challenge'} - ${cveId}` : `${category || 'Custom'} Challenge`,
    category: category || 'web',
    difficulty: 'medium',
    points: 300,
    narrative: idea || `Exploit the vulnerability identified in ${cveId || 'the target system'}.`,
    tech_stack: ['Python', 'Docker'],
    vulnerability: { type: 'Various', cwe: 'CWE-1000' },
    exploit_path: ['Reconnaissance', 'Identify vulnerability', 'Exploit', 'Capture flag'],
    flags: [`Exploit3rs{ch4ll3ng3_s0lv3d}`],
    hints: ['Read the description carefully', 'Enumerate thoroughly'],
    anti_ai_measures: ['Custom protocol implementation', 'Time-based verification'],
    estimated_time: '30 minutes',
    files_needed: ['Dockerfile', 'challenge.py', 'exploit.py', 'writeup.md'],
  }),
};

function generateMockSpec(job) {
  const category = job.category || 'web';
  const generator = MOCK_SPECS[category] || MOCK_SPECS.default;
  return generator(job.cve_id, job.idea_text, category);
}

let worker = null;

export function startResearcherWorker() {
  worker = new Worker(
    'research-queue',
    async (bullJob) => {
      const { jobId } = bullJob.data;
      console.log(`[Researcher] Processing job ${jobId}`);

      const job = getJob(jobId);
      if (!job) {
        console.error(`[Researcher] Job ${jobId} not found`);
        return;
      }

      updateJobStatus(jobId, 'researching');

      // Simulate research delay
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const spec = generateMockSpec(job);
      const tokenUsage = Math.floor(Math.random() * 2000) + 800;

      createSpec({
        jobId,
        specJson: spec,
        tokenUsage,
        generationTimeMs: 3000,
      });

      updateJobStatus(jobId, 'pending_spec_review');
      console.log(`[Researcher] Job ${jobId} spec ready for review`);
    },
    {
      connection: getConnection(),
      concurrency: 5,
    }
  );

  worker.on('failed', (bullJob, err) => {
    console.error(`[Researcher] Job ${bullJob?.data?.jobId} failed:`, err.message);
    if (bullJob?.data?.jobId) {
      try {
        updateJobStatus(bullJob.data.jobId, 'failed', err.message);
      } catch {}
    }
  });

  console.log('[Researcher] Worker started');
  return worker;
}

export function getResearcherWorker() {
  return worker;
}
