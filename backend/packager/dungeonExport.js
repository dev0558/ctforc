/**
 * DUNGEON Export Generator
 * Creates a dungeon_config.json mapping to the DUNGEON platform's challenge upload form.
 */

const CATEGORY_MAP = {
  web: 'Web Exploitation',
  forensics: 'Forensics',
  crypto: 'Cryptography',
  osint: 'OSINT',
  network: 'Network',
  pwn: 'Pwn',
};

export function generateDungeonConfig(spec, testResults) {
  const config = {
    quest_name: spec.challengeName,
    category: CATEGORY_MAP[spec.category] || spec.category,
    difficulty: spec.difficulty,
    points: spec.points,
    description: spec.narrative,
    flag: spec.flag,
    flag_format: 'Exploit3rs{...}',
    hints: [],
    deployment_type: ['web', 'pwn'].includes(spec.category) ? 'docker' : 'static',
    docker_image: ['web', 'pwn'].includes(spec.category)
      ? `exploit3rs/challenges:${sanitize(spec.challengeName)}_v1`
      : null,
    docker_port: ['web', 'pwn'].includes(spec.category) ? 80 : null,
    attachments: getAttachmentList(spec.category),
    author: 'CTF Challenge Orchestrator',
    organization: 'Exploit3rs Cyber Security Academy',
    tags: spec.techStack || [],
    estimated_time_minutes: spec.estimatedBuildTimeMin || 30,
    tools_required: spec.toolsRequired || [],
    learning_objective: spec.learningObjective || '',
    cve_id: spec.cveId || null,
    cwe: spec.cwe ? `${spec.cwe.id}: ${spec.cwe.name}` : null,
    mitre_attack: spec.mitre ? `${spec.mitre.technique}: ${spec.mitre.name}` : null,
    cvss_score: spec.cvss?.score || null,
    tested: testResults?.overallPass || false,
    test_summary: testResults ? formatTestSummary(testResults) : 'Not tested',
    has_anti_ai: true,
    honeypot_flag: spec.honeypotFlag || null,
    generated_at: new Date().toISOString(),
    generator_version: '2.0.0',
  };

  // Auto-generate hints from exploit path
  const steps = spec.exploitPath || [];
  if (steps.length >= 3) {
    config.hints = [
      { level: 'subtle', text: `Start by examining the ${spec.techStack?.[0] || 'application'} carefully.`, cost: 0 },
      { level: 'moderate', text: steps[0] || 'Look at the entry point.', cost: Math.round(spec.points * 0.1) },
      { level: 'direct', text: steps[Math.floor(steps.length / 2)] || 'Check the vulnerability.', cost: Math.round(spec.points * 0.25) },
    ];
  }

  return config;
}

function getAttachmentList(category) {
  const map = {
    web: [],
    forensics: ['evidence.pcap', 'logs/', 'memory.dmp'],
    crypto: ['ciphertext.txt', 'encrypt.py', 'public_key.pem'],
    osint: ['briefing.pdf', 'initial_clue.jpg'],
    network: ['capture.pcap', 'topology.png'],
    pwn: ['vuln', 'libc.so.6'],
  };
  return map[category] || [];
}

function formatTestSummary(results) {
  const parts = [];
  if (results.dockerBuild) parts.push(`Build: ${results.dockerBuild.success ? 'pass' : 'fail'}`);
  if (results.containerHealth) parts.push(`Health: ${results.containerHealth.success ? 'pass' : 'fail'}`);
  if (results.artifactGeneration) parts.push(`Artifacts: ${results.artifactGeneration.success ? 'pass' : 'fail'}`);
  if (results.solveScript) parts.push(`Solve: ${results.solveScript.success ? 'pass' : 'fail'}`);
  parts.push(`Flag: ${results.flagVerification?.realFlagFound ? 'verified' : 'NOT FOUND'}`);
  return parts.join(' | ');
}

function sanitize(name) {
  return (name || 'challenge').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 40);
}
