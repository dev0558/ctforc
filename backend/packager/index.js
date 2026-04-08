import { existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync, createReadStream, createWriteStream } from 'fs';
import { join, relative, dirname, basename } from 'path';
import archiver from 'archiver';
import { generateDungeonConfig } from './dungeonExport.js';

const SPECIALIST_ONLY_PATTERNS = [
  'writeup/', 'solve', 'exploit', 'hints.json', 'anti_ai_manifest',
  'dungeon_config', 'Dockerfile', 'docker-compose', 'Makefile', '.env', 'flag.txt', 'init.sql',
];

const PARTICIPANT_FILES = {
  web: [],
  forensics: ['source/generate_artifacts.py:output'],
  crypto: ['source/ciphertext.txt', 'source/ciphertext.bin', 'source/encrypt.py', 'source/public_key.pem'],
  osint: ['source/generate_breadcrumbs.py:output'],
  network: ['source/generate_capture.py:output'],
  pwn: ['source/vuln'],
};

/**
 * Create both specialist and participant packages.
 */
export async function createPackages(jobId, spec, challengeDir, testResults, storagePath) {
  const packageDir = join(storagePath, 'packages', jobId);
  if (!existsSync(packageDir)) mkdirSync(packageDir, { recursive: true });

  const safeName = sanitizeName(spec.challengeName || 'challenge');

  // Generate DUNGEON config
  const dungeonConfig = generateDungeonConfig(spec, testResults);
  const configDir = join(challengeDir, 'config');
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, 'dungeon_config.json'), JSON.stringify(dungeonConfig, null, 2));

  // Generate specialist README
  writeFileSync(join(challengeDir, 'specialist_readme.md'), generateSpecialistReadme(spec, testResults));

  // Generate participant README
  const participantReadme = generateParticipantReadme(spec);

  // Create specialist package (everything)
  const specialistPath = join(packageDir, `${safeName}_specialist.zip`);
  await createZip(challengeDir, specialistPath);

  // Create participant package (filtered)
  const participantPath = join(packageDir, `${safeName}_participant.zip`);
  await createParticipantZip(spec, challengeDir, participantPath, participantReadme);

  const specialistSize = existsSync(specialistPath) ? statSync(specialistPath).size : 0;
  const participantSize = existsSync(participantPath) ? statSync(participantPath).size : 0;

  return {
    specialistPath,
    participantPath,
    specialistSize,
    participantSize,
    specialistFilename: `${safeName}_specialist.zip`,
    participantFilename: `${safeName}_participant.zip`,
  };
}

function createZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    addDirToArchive(archive, sourceDir, sourceDir);
    archive.finalize();
  });
}

function createParticipantZip(spec, challengeDir, outputPath, readmeContent) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    archive.append(readmeContent, { name: 'README.md' });

    // Add challenge description (stripped of flags)
    const descPath = join(challengeDir, 'config', 'challenge.json');
    if (existsSync(descPath)) {
      try {
        const config = JSON.parse(readFileSync(descPath, 'utf-8'));
        delete config.flag;
        delete config.honeypotFlag;
        delete config._debug_flag;
        delete config._ai_hint;
        archive.append(JSON.stringify(config, null, 2), { name: 'challenge.json' });
      } catch {}
    }

    // Category-specific files
    const category = spec.category || 'web';
    const allowedPatterns = PARTICIPANT_FILES[category] || [];
    for (const pattern of allowedPatterns) {
      if (pattern.endsWith(':output')) {
        const artifactsDir = join(challengeDir, 'artifacts');
        if (existsSync(artifactsDir)) {
          addDirToArchive(archive, artifactsDir, artifactsDir, 'artifacts/');
        }
      } else {
        const filePath = join(challengeDir, pattern);
        if (existsSync(filePath)) {
          let content = readFileSync(filePath, 'utf-8');
          if (spec.flag) content = content.replace(new RegExp(escapeRegex(spec.flag), 'g'), 'REDACTED');
          if (spec.honeypotFlag) content = content.replace(new RegExp(escapeRegex(spec.honeypotFlag), 'g'), 'REDACTED');
          archive.append(content, { name: basename(pattern) });
        }
      }
    }

    archive.finalize();
  });
}

function addDirToArchive(archive, dir, baseDir, prefix = '') {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = prefix + relative(baseDir, fullPath);
    if (entry.isDirectory()) {
      addDirToArchive(archive, fullPath, baseDir, prefix);
    } else {
      archive.file(fullPath, { name: relativePath });
    }
  }
}

function generateSpecialistReadme(spec, testResults) {
  const lines = [
    `# ${spec.challengeName} : Specialist Guide`,
    '',
    `**Category:** ${spec.category} | **Difficulty:** ${spec.difficulty} | **Points:** ${spec.points}`,
    '',
    '## Flag',
    `\`${spec.flag}\``,
    '',
  ];

  if (spec.honeypotFlag) {
    lines.push('## Honeypot Flag (decoy)', `\`${spec.honeypotFlag}\``, '');
  } else {
    lines.push('## Honeypot Flag', 'Disabled for this challenge.', '');
  }

  lines.push('## Deployment');
  if (['web', 'pwn'].includes(spec.category)) {
    lines.push('```bash', 'cd source/', `docker build -t ${sanitizeName(spec.challengeName)} .`,
      `docker run -d -p 80:80 --name ${sanitizeName(spec.challengeName)} ${sanitizeName(spec.challengeName)}`, '```');
  } else {
    lines.push('```bash', 'cd source/', 'pip install -r requirements.txt', 'python3 generate_artifacts.py',
      '# Distribute the generated files in artifacts/ to participants', '```');
  }

  lines.push('', '## Exploit Path');
  (spec.exploitPath || []).forEach((step, i) => lines.push(`${i + 1}. ${step}`));

  lines.push('', '## Anti-AI Countermeasures');
  (spec.antiAiCountermeasures || []).forEach((m) => lines.push(`- ${m}`));

  if (testResults) {
    lines.push('', '## Test Results');
    lines.push(`- Overall: ${testResults.overallPass ? 'PASS' : 'FAIL'}`);
    if (testResults.dockerBuild) lines.push(`- Docker build: ${testResults.dockerBuild.success ? 'pass' : 'fail'}`);
    if (testResults.solveScript) lines.push(`- Solve script: ${testResults.solveScript.success ? 'pass' : 'fail'}`);
    lines.push(`- Flag verified: ${testResults.flagVerification?.realFlagFound ? 'yes' : 'no'}`);
  }

  lines.push('', '## DUNGEON Configuration', 'Import `config/dungeon_config.json` into the DUNGEON platform to auto-fill the challenge form.');
  return lines.join('\n');
}

function generateParticipantReadme(spec) {
  return [
    `# ${spec.challengeName}`,
    '',
    `**Category:** ${spec.category}`,
    `**Difficulty:** ${spec.difficulty}`,
    `**Points:** ${spec.points}`,
    '',
    '## Briefing',
    '',
    spec.narrative || 'No description available.',
    '',
    '## Rules',
    '- Flag format: Exploit3rs{...}',
    '- Do not share flags with other participants',
    '- Use any tools at your disposal',
    '',
    'Good luck!',
  ].join('\n');
}

function sanitizeName(name) {
  return (name || 'challenge').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 50);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
