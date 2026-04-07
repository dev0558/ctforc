/**
 * Forensics — category-specific builder.
 * Calls Claude API with the forensics-specific prompt.md and the full approved spec.
 * Returns an array of { path, language, content } file objects.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateJSON } from '../../agents/claudeClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const promptTemplate = readFileSync(join(__dirname, 'prompt.md'), 'utf-8');

function resolveFlag(spec) {
  if (spec.flag) return spec.flag;
  if (Array.isArray(spec.flags) && spec.flags.length > 0) return spec.flags[0];
  return null;
}

export default {
  categoryId: 'forensics',

  /**
   * Build forensics challenge artifacts using Claude API.
   * @param {object} spec - The approved challenge spec from the researcher.
   * @returns {{ files: Array<{path, language, content}>, tokenUsage: number, durationMs: number }}
   */
  async build(spec) {
    const flag = resolveFlag(spec);
    if (!flag) {
      throw new Error('Forensics builder: spec has no flag — cannot generate challenge without a flag');
    }

    const systemPrompt = promptTemplate.replace(/\{\{FLAG\}\}/g, flag);

    const userPrompt = `Generate a complete digital forensics CTF challenge based on this approved specification:

${JSON.stringify({
  challengeName: spec.challengeName,
  category: spec.category,
  difficulty: spec.difficulty,
  points: spec.points,
  narrative: spec.narrative,
  techStack: spec.techStack,
  cwe: spec.cwe || null,
  exploitPath: spec.exploitPath,
  flag: flag,
  honeypotFlag: spec.honeypotFlag || null,
  antiAiCountermeasures: spec.antiAiCountermeasures,
  learningObjective: spec.learningObjective || null,
  toolsRequired: spec.toolsRequired || null,
  reviewerNote: spec.reviewerNote || null,
}, null, 2)}

IMPORTANT:
- The flag is: ${flag}
- Every file that references the flag MUST use exactly: ${flag}
- The artifact type must match the spec — if the narrative mentions memory dumps, generate memory analysis scripts, NOT PCAP analysis
- If the narrative mentions PCAP/network capture, generate Scapy-based PCAP creation scripts
- If the narrative mentions steganography, generate PIL/Pillow-based image scripts
- If the narrative mentions log analysis, generate realistic log files with anomalous entries
- The exploit path has ${(spec.exploitPath || []).length} steps — the writeup MUST cover each one with specific tool commands
- Difficulty is "${spec.difficulty}" — adjust encoding complexity and number of artifacts
- Return ONLY the JSON array of file objects. No other text.`;

    console.log(`[Forensics Builder] Calling Claude API for "${spec.challengeName}"...`);

    const { result: files, tokenUsage, durationMs } = await generateJSON({
      systemPrompt,
      userPrompt,
      maxRetries: 2,
    });

    if (!Array.isArray(files)) {
      throw new Error('Forensics builder: Claude returned non-array response');
    }

    for (const file of files) {
      if (!file.path || !file.content) {
        throw new Error(`Forensics builder: file object missing path or content: ${JSON.stringify(file)}`);
      }
    }

    // Verify the flag appears in at least one file
    const flagPresent = files.some((f) => f.content.includes(flag));
    if (!flagPresent) {
      console.warn(`[Forensics Builder] WARNING: flag "${flag}" not found in any generated file — injecting into writeup`);
      const writeup = files.find((f) => f.path.endsWith('writeup.md'));
      if (writeup) {
        writeup.content += `\n\n## Flag\n\`${flag}\`\n`;
      }
    }

    console.log(`[Forensics Builder] Generated ${files.length} files (${tokenUsage} tokens, ${durationMs}ms)`);

    return { files, tokenUsage, durationMs };
  },
};
