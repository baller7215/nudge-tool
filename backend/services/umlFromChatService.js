import dotenv from 'dotenv';
import { getChatCompletion } from './chatService.js';

dotenv.config();

/**
 * Builds the system prompt for incremental UML generation.
 * The model should:
 * - Maintain a class-diagram PlantUML between @startuml and @enduml
 * - Make small, incremental changes based on new conversation info
 * - Preserve existing structure unless explicitly asked to change
 * - Return ONLY raw PlantUML code (no markdown fences or commentary)
 */
const buildSystemPrompt = () => {
  return `
You are a software modeling assistant.
You maintain a PlantUML class diagram that models the user's problem domain.

RULES:
- You are given the PRIOR UML diagram and the FULL conversation so far.
- Your job is to return a REVISED PlantUML diagram that makes SMALL, INCREMENTAL changes:
  - Add or refine a few classes, attributes, or associations based on new information.
  - Preserve existing classes and relationships unless the user clearly indicates they are wrong or should be removed.
- The diagram MUST be a valid PlantUML class diagram, wrapped in:
  @startuml
  ... class diagram ...
  @enduml
- Focus on domain concepts: entities, their attributes, and relationships.
- Prefer stable class and association names; avoid renaming existing elements unless strongly justified by the conversation.
- Do NOT include any explanation, comments, markdown code fences, or text outside the PlantUML code.
- Output ONLY the final PlantUML code.
`.trim();
};

/**
 * Generate an incremental PlantUML class diagram from chat messages and existing UML state.
 *
 * @param {Object} params
 * @param {string} params.sessionId - Current session id (for logging/context only)
 * @param {Array<{role: string, content: string}>} params.messages - Chat history
 * @param {string} params.currentPlantUml - Existing PlantUML code for this session
 * @returns {Promise<string>} - New PlantUML code
 */
export const generateUmlFromChat = async ({ sessionId, messages, currentPlantUml }) => {
  const systemPrompt = buildSystemPrompt();

  const promptMessages = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: [
        'Here is the current PlantUML class diagram you are maintaining:',
        '```plantuml',
        currentPlantUml || '@startuml\n@enduml',
        '```',
        '',
        'Here is the full conversation history so far (most recent last):',
        JSON.stringify(messages, null, 2),
        '',
        'Update the diagram incrementally based on what the user is trying to model.',
        'Remember: return ONLY the updated PlantUML code, no markdown fences or explanations.',
      ].join('\n'),
    },
  ];

  const completion = await getChatCompletion(promptMessages);

  const content = completion?.choices?.[0]?.message?.content || '';

  // strip potential markdown fences or commentary if the model disobeys
  const cleaned = extractPlantUml(content);

  return cleaned;
};

/**
 * Try to extract raw PlantUML code from model output.
 * Handles cases where the model mistakenly adds markdown fences or prose.
 */
const extractPlantUml = (raw) => {
  if (!raw) return '@startuml\n@enduml';

  let text = raw.trim();

  // Remove markdown fences if present
  if (text.startsWith('```')) {
    // Drop first fence line
    const lines = text.split('\n');
    // Remove leading ```... and trailing ```
    if (lines[0].startsWith('```')) {
      lines.shift();
    }
    if (lines.length && lines[lines.length - 1].startsWith('```')) {
      lines.pop();
    }
    text = lines.join('\n').trim();
  }

  // Ensure we only keep the part between @startuml and @enduml if present
  const startIdx = text.indexOf('@startuml');
  const endIdx = text.lastIndexOf('@enduml');

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return text.slice(startIdx, endIdx + '@enduml'.length).trim();
  }

  // Fallback: if missing, wrap whatever is there
  return `@startuml
${text}
@enduml`;
};

