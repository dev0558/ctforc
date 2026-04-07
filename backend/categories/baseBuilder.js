/**
 * Base builder engine — shared by ALL categories.
 * Loads category-specific prompt from agents/prompts/builder-{category}.md,
 * injects spec data (flags, exploit path, etc.), calls Claude API,
 * validates output, and saves files to storage.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { generateJSON } from '../agents/claudeClient.js';
import config from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, '..', 'agents', 'prompts');

/**
 * Build a complete CTF challenge using Claude API.
 * @param {object} approvedSpec - The approved challenge specification.
 * @param {string} categoryId - The category (web, forensics, crypto, osint, network, pwn).
 * @returns {{ files: object, fileList: string[], tokenUsage: number, durationMs: number }}
 */
export async function buildChallenge(approvedSpec, categoryId) {
  const promptFile = join(PROMPTS_DIR, `builder-${categoryId}.md`);

  if (!existsSync(promptFile)) {
    throw new Error(`No builder prompt found for category: ${categoryId}. Expected: ${promptFile}`);
  }

  // Load and customize the system prompt — inject flags
  let systemPrompt = readFileSync(promptFile, 'utf-8');
  const realFlag = approvedSpec.flag || 'Exploit3rs{default_flag}';
  const honeypotFlag = approvedSpec.honeypotFlag || 'Exploit3rs{fake_flag}';

  systemPrompt = systemPrompt.replace(/\{FLAG\}/g, realFlag);
  systemPrompt = systemPrompt.replace(/\{HONEYPOT_FLAG\}/g, honeypotFlag);

  // Build the user prompt from the full approved spec
  const userPrompt = buildUserPrompt(approvedSpec);

  console.log(`[BaseBuilder] Calling Claude for ${categoryId} challenge: "${approvedSpec.challengeName}"...`);

  const { result, tokenUsage, durationMs } = await generateJSON({
    systemPrompt,
    userPrompt,
    maxRetries: 2,
    maxTokens: 8192,
  });

  // Validate the output has a files object
  if (!result.files || typeof result.files !== 'object') {
    throw new Error('Builder output missing "files" object');
  }

  const fileList = Object.keys(result.files);
  if (fileList.length < 3) {
    throw new Error(`Builder produced only ${fileList.length} files, expected at least 3`);
  }

  // Verify the real flag appears in at least one file
  const flagPresent = Object.values(result.files).some(
    (content) => typeof content === 'string' && content.includes(realFlag)
  );
  if (!flagPresent) {
    console.warn(`[BaseBuilder] WARNING: real flag not found in any generated file — injecting into writeup`);
    const writeupKey = fileList.find((f) => f.includes('WRITEUP.md') || f.includes('writeup.md'));
    if (writeupKey) {
      result.files[writeupKey] += `\n\n## Flag\n\`${realFlag}\`\n`;
    }
  }

  console.log(`[BaseBuilder] Generated ${fileList.length} files (${tokenUsage} tokens, ${durationMs}ms)`);

  return {
    files: result.files,
    fileList,
    tokenUsage,
    durationMs,
  };
}

/**
 * Build the user prompt with all spec details so Claude has full context.
 */
function buildUserPrompt(spec) {
  const sections = [
    `Build a complete CTF challenge from this approved specification:`,
    ``,
    `== CHALLENGE IDENTITY ==`,
    `Name: ${spec.challengeName}`,
    `Category: ${spec.category}`,
    `Difficulty: ${spec.difficulty}`,
    `Points: ${spec.points}`,
    ``,
    `== NARRATIVE ==`,
    spec.narrative,
    ``,
    `== TECH STACK ==`,
    (spec.techStack || []).join(', '),
    ``,
    `== VULNERABILITY ==`,
  ];

  if (spec.cwe) {
    sections.push(`CWE: ${spec.cwe.id} - ${spec.cwe.name}`);
  }
  if (spec.cvss) {
    sections.push(`CVSS: ${spec.cvss.score} (${spec.cvss.severity})`);
  }
  if (spec.mitre) {
    sections.push(`MITRE: ${spec.mitre.technique} - ${spec.mitre.name}`);
  }

  sections.push(``);
  sections.push(`== EXPLOIT PATH (the player's solution steps) ==`);
  (spec.exploitPath || []).forEach((step, i) => {
    sections.push(`${i + 1}. ${step}`);
  });

  sections.push(``);
  sections.push(`== FLAGS ==`);
  sections.push(`Real flag: ${spec.flag}`);
  sections.push(`Honeypot (decoy) flag: ${spec.honeypotFlag}`);

  sections.push(``);
  sections.push(`== ANTI-AI COUNTERMEASURES TO IMPLEMENT ==`);
  (spec.antiAiCountermeasures || []).forEach((measure) => {
    sections.push(`- ${measure}`);
  });

  if (spec.learningObjective) {
    sections.push(``);
    sections.push(`== LEARNING OBJECTIVE ==`);
    sections.push(spec.learningObjective);
  }

  if (spec.toolsRequired && spec.toolsRequired.length > 0) {
    sections.push(``);
    sections.push(`== TOOLS PLAYERS NEED ==`);
    sections.push(spec.toolsRequired.join(', '));
  }

  if (spec.reviewerNote) {
    sections.push(``);
    sections.push(`== REVIEWER NOTE ==`);
    sections.push(spec.reviewerNote);
  }

  sections.push(``);
  sections.push(`Generate ALL files as specified in your system prompt. Every file must be complete and functional.`);

  return sections.join('\n');
}

/**
 * Save generated files to the storage directory.
 * @returns {string} The challenge directory path.
 */
export function saveFiles(jobId, files) {
  const storagePath = config.storagePath || resolve(__dirname, '..', 'storage');
  const challengeDir = join(storagePath, 'challenges', jobId);

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(challengeDir, filePath);
    const dir = dirname(fullPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, content, 'utf-8');
  }

  console.log(`[BaseBuilder] Saved ${Object.keys(files).length} files to ${challengeDir}`);
  return challengeDir;
}
