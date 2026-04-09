import { getChatCompletion } from './chatService.js';

const ORCHESTRATOR_SYSTEM_PROMPT = `You are an assistant that decides how to help a user think better.

Given:
- the user's latest input
- their current workspace

Your goal:
- Only intervene if it adds value
- Prefer reflection over critique
- Avoid being intrusive

Choose one:
- nudge_reflect (clarify thinking)
- nudge_expand (add perspective)
- structure (organize ideas)
- none (no help needed)

Guidelines:
- If the user is exploring → reflect
- If the idea is narrow → expand
- If messy → structure
- If already clear → none

Output JSON:
{
  "action": "...",
  "reason": "..."
}`;

const ALLOWED_ACTIONS = new Set(['nudge_reflect', 'nudge_expand', 'structure', 'none']);

const extractJsonCandidate = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();

  // Strip markdown fences if present.
  if (text.startsWith('```')) {
    const lines = text.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    if (lines.length && lines[lines.length - 1].startsWith('```')) lines.pop();
    text = lines.join('\n').trim();
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

  return text.slice(firstBrace, lastBrace + 1);
};

const safeParseOrchestratorOutput = (raw) => {
  const jsonCandidate = extractJsonCandidate(raw);
  if (!jsonCandidate) return null;

  try {
    const parsed = JSON.parse(jsonCandidate);
    const action = String(parsed?.action ?? '').trim();
    const reason = String(parsed?.reason ?? '').trim();

    if (!ALLOWED_ACTIONS.has(action)) return null;
    return { action, reason };
  } catch {
    return null;
  }
};

// Required signature per prompt.
export async function runOrchestrator(input) {
  const { message, workspace } = input || {};
  const userMessage = `
Latest user input:
${String(message ?? '').trim()}

Current workspace:
${String(workspace ?? '').trim()}
`.trim();

  const gptMessages = [
    { role: 'system', content: ORCHESTRATOR_SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  const completion = await getChatCompletion(gptMessages);
  const raw = completion?.choices?.[0]?.message?.content || '';

  const parsed = safeParseOrchestratorOutput(raw);
  if (!parsed) {
    return {
      action: 'none',
      reason: 'Failed to parse orchestrator output; skipping nudge.',
    };
  }

  return parsed;
}

