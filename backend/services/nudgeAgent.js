import { getChatCompletion } from './chatService.js';

const BASE_PROMPT = `You are a thoughtful assistant that helps users think more deeply.

You DO NOT:
- criticize harshly
- overwhelm the user
- give long explanations

You DO:
- ask 1 concise, thought-provoking question OR
- give 1 short suggestion

Tone:
- calm
- curious
- collaborative

Keep responses under 2 sentences.`;

const MODE_ADD_ONS = {
  reflect: `Focus on helping the user clarify their own thinking.
Ask about assumptions, goals, or definitions.`,
  expand: `Introduce a new perspective, constraint, or scenario the user may not have considered.`,
  structure: `Help organize the user's thoughts into a clearer format.`,
};

const normalizeMode = (mode) => {
  const m = String(mode || '').trim().toLowerCase();
  if (m === 'reflect' || m === 'expand' || m === 'structure') return m;
  return 'reflect';
};

const limitToTwoSentences = (raw) => {
  const text = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!text) return '';

  // Best-effort sentence splitting.
  const parts = text.split(/(?<=[.!?])\s+/);
  if (parts.length <= 2) return parts.join(' ').trim();
  return `${parts[0]} ${parts[1]}`.trim();
};

// Required signature per prompt.
export async function generateNudge(input) {
  const { mode, message, workspace } = input || {};
  const normalizedMode = normalizeMode(mode);
  const modeAddon = MODE_ADD_ONS[normalizedMode] || MODE_ADD_ONS.reflect;

  const systemPrompt = `${BASE_PROMPT}\n\n${modeAddon}\n\nRespond with exactly one question or one short suggestion.`;

  const userPrompt = `
Latest user input:
${String(message ?? '').trim()}

Current workspace:
${String(workspace ?? '').trim()}
`.trim();

  const gptMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const completion = await getChatCompletion(gptMessages);
  const raw = completion?.choices?.[0]?.message?.content || '';
  const limited = limitToTwoSentences(raw);
  return limited || raw.trim().slice(0, 280) || 'Want to think about one key assumption you might be making?';
}

