/**
 * Agent Runner — Invokes Claude Code sub-agents via the Agent SDK.
 *
 * Each pipeline stage (Researcher, Architect, Developer) runs as a
 * Claude Code sub-agent with access to tools (web search, code execution, etc.)
 * This replaces direct anthropic.messages.create() calls.
 *
 * Falls back to direct API calls if the SDK is unavailable.
 */
import { claudeCode } from '@anthropic-ai/claude-code';
import config from '../config.js';

/**
 * Run a Claude Code agent with the given prompt and system instructions.
 * Returns structured JSON output.
 *
 * @param {object} options
 * @param {string} options.agentName - Name for logging (e.g., 'Researcher', 'Architect', 'Developer')
 * @param {string} options.systemPrompt - System instructions for the agent
 * @param {string} options.userPrompt - The task/context to work on
 * @param {number} [options.maxTokens=8192] - Max output tokens
 * @param {number} [options.maxRetries=2] - Retry count on failure
 * @param {boolean} [options.jsonOutput=true] - Whether to parse output as JSON
 * @returns {Promise<{result: object|string, tokenUsage: number, durationMs: number}>}
 */
export async function runAgent({ agentName, systemPrompt, userPrompt, maxTokens = 8192, maxRetries = 2, jsonOutput = true }) {
  const start = Date.now();
  console.log(`[AgentRunner] Starting ${agentName} agent...`);

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let promptToSend = userPrompt;

      if (attempt > 0 && lastError) {
        promptToSend += `\n\n[RETRY ${attempt}/${maxRetries}] Your previous response failed: ${lastError}. Fix the issue and try again.`;
      }

      const fullPrompt = `${systemPrompt}\n\n---\n\n${promptToSend}${jsonOutput ? '\n\nIMPORTANT: Respond with ONLY a valid JSON object. No markdown, no backticks, no preamble.' : ''}`;

      const result = await claudeCode(fullPrompt, {
        model: config.claude.model,
        maxTurns: 1,
        allowedTools: [],
      });

      const durationMs = Date.now() - start;

      // Extract text from the agent's response
      let outputText = '';
      let tokenUsage = 0;

      for (const msg of result) {
        if (msg.type === 'text') {
          outputText += msg.content;
        }
        if (msg.type === 'usage') {
          tokenUsage += (msg.input_tokens || 0) + (msg.output_tokens || 0);
        }
        if (msg.type === 'result') {
          outputText = msg.result || outputText;
          tokenUsage = msg.total_cost_usd ? Math.round(msg.total_cost_usd * 1000000) : tokenUsage;
        }
      }

      if (!outputText && result.length > 0) {
        // Try extracting from different result formats
        for (const msg of result) {
          if (typeof msg === 'string') {
            outputText += msg;
          } else if (msg.content && typeof msg.content === 'string') {
            outputText += msg.content;
          }
        }
      }

      if (jsonOutput) {
        let rawText = outputText.trim();
        // Strip markdown code fences
        if (rawText.startsWith('```')) {
          rawText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        }
        const parsed = JSON.parse(rawText);
        console.log(`[AgentRunner] ${agentName} completed (${durationMs}ms, ~${tokenUsage} tokens)`);
        return { result: parsed, tokenUsage, durationMs };
      }

      console.log(`[AgentRunner] ${agentName} completed (${durationMs}ms, ~${tokenUsage} tokens)`);
      return { result: outputText, tokenUsage, durationMs };
    } catch (err) {
      lastError = err.message;
      console.error(`[AgentRunner] ${agentName} attempt ${attempt + 1} failed:`, err.message);

      if (attempt === maxRetries) {
        console.warn(`[AgentRunner] ${agentName} SDK failed after ${maxRetries + 1} attempts, falling back to direct API`);
        return await runDirectAPI({ agentName, systemPrompt, userPrompt, maxTokens, maxRetries: 0, jsonOutput });
      }

      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/**
 * Fallback: Direct Anthropic API call (same as original claudeClient.js).
 * Used when Claude Code SDK is unavailable.
 */
async function runDirectAPI({ agentName, systemPrompt, userPrompt, maxTokens = 8192, maxRetries = 2, jsonOutput = true }) {
  const { generateJSON, generateText } = await import('./claudeClient.js');
  console.log(`[AgentRunner] ${agentName} using direct API fallback`);

  if (jsonOutput) {
    return await generateJSON({ systemPrompt, userPrompt, maxRetries, maxTokens });
  } else {
    return await generateText({ systemPrompt, userPrompt });
  }
}
