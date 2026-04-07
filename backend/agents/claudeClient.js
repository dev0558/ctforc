import Anthropic from '@anthropic-ai/sdk';
import config from '../config.js';

let client = null;

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: config.claude.apiKey });
  }
  return client;
}

/**
 * Call Claude API with structured JSON output.
 * Retries up to maxRetries times if JSON parsing fails.
 * Returns { result, tokenUsage, durationMs }
 */
export async function generateJSON({ systemPrompt, userPrompt, maxRetries = 2 }) {
  const anthropic = getClient();
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const start = Date.now();

    try {
      let promptToSend = userPrompt;

      // On retry, append correction hint
      if (attempt > 0 && lastError) {
        promptToSend += `\n\n[RETRY ${attempt}/${maxRetries}] Your previous response failed validation: ${lastError}. Please fix the issue and return valid JSON only. No markdown, no backticks, no preamble.`;
      }

      const response = await anthropic.messages.create({
        model: config.claude.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: promptToSend }],
      });

      const durationMs = Date.now() - start;
      const tokenUsage =
        (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

      // Extract text content
      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock) throw new Error('No text block in Claude response');

      let rawText = textBlock.text.trim();

      // Strip markdown code fences if present
      if (rawText.startsWith('```')) {
        rawText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }

      const parsed = JSON.parse(rawText);
      return { result: parsed, tokenUsage, durationMs };
    } catch (err) {
      lastError = err.message;
      console.error(`[Claude] Attempt ${attempt + 1} failed:`, err.message);

      if (attempt === maxRetries) {
        throw new Error(`Claude API failed after ${maxRetries + 1} attempts: ${lastError}`);
      }

      // Brief pause before retry
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/**
 * Simple text completion (non-JSON). Used for idea expansion.
 */
export async function generateText({ systemPrompt, userPrompt }) {
  const anthropic = getClient();
  const start = Date.now();

  const response = await anthropic.messages.create({
    model: config.claude.model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const durationMs = Date.now() - start;
  const tokenUsage =
    (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
  const textBlock = response.content.find((b) => b.type === 'text');

  return { result: textBlock?.text || '', tokenUsage, durationMs };
}
