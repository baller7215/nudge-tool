// services/nudgeService.js
import { Nudge } from '../models/NudgeModel.js';
import { getChatCompletion } from './chatService.js';
import sessionService from './sessionService.js';

/**
 * Build a lightweight summary of the current UML diagram from PlantUML text.
 */
const summarizePlantUml = (plantuml = '') => {
  if (!plantuml || typeof plantuml !== 'string') {
    return null;
  }

  const lines = plantuml.split('\n');

  const numClasses = lines.filter((l) => /\bclass\b/.test(l)).length;
  const numInterfaces = lines.filter((l) => /\binterface\b/.test(l)).length;
  const numActors = lines.filter((l) => /\bactor\b/.test(l)).length;
  const numRelations = lines.filter((l) => /(-->|\.\.|--\||\|--|<\||\|>)/.test(l)).length;

  const totalElements = numClasses + numInterfaces + numActors;

  return {
    numClasses,
    numInterfaces,
    numActors,
    numRelations,
    totalElements,
  };
};

/**
 * Classify rough design phase based on UML summary.
 * start  - essentially blank
 * early  - a few elements
 * mid    - richer diagram
 * late   - complex / near-finished
 */
const classifyDesignPhase = (umlSummary) => {
  if (!umlSummary || typeof umlSummary.totalElements !== 'number') {
    return 'start';
  }

  const total = umlSummary.totalElements;

  if (total <= 1) return 'start';
  if (total <= 8) return 'early';
  if (total <= 20) return 'mid';
  return 'late';
};

/**
 * Choose a high-level critic focus based on phase and UML summary.
 * This does NOT generate text; it only decides what kind of question
 * the LLM should ask (e.g., stakeholders, completeness, relationships).
 */
const chooseCriticFocus = (phase, umlSummary) => {
  // Very lightweight heuristics; can be refined over time.
  if (phase === 'start') {
    return 'start_concepts_and_stakeholders';
  }

  if (phase === 'early') {
    return 'completeness_and_stakeholders';
  }

  // If there are many relationships, focus more on structure.
  if (phase === 'mid') {
    const relations = umlSummary ? umlSummary.numRelations || 0 : 0;
    if (relations >= 5) {
      return 'relationships_and_responsibilities';
    }
    return 'completeness_and_structure';
  }

  // late
  return 'reflection_and_edge_cases';
};

/**
 * Build a textual context block for the LLM from phase, UML summary,
 * scratchpad, and recent messages.
 */
const buildNudgeContext = ({
  phase,
  trigger,
  umlSummary,
  scratchpadText,
  messages,
}) => {
  let context = '';

  context += `Design phase: ${phase}\n`;
  context += `Trigger: ${trigger}\n\n`;

  if (umlSummary) {
    context += `Current UML summary:\n`;
    context += `- Classes: ${umlSummary.numClasses}\n`;
    context += `- Interfaces: ${umlSummary.numInterfaces}\n`;
    context += `- Actors: ${umlSummary.numActors}\n`;
    context += `- Relationships (approx): ${umlSummary.numRelations}\n`;
    context += `- Total elements: ${umlSummary.totalElements}\n\n`;
  }

  if (scratchpadText && scratchpadText.trim()) {
    const trimmed =
      scratchpadText.length > 1200
        ? `${scratchpadText.slice(0, 1200)}...`
        : scratchpadText;
    context += `User's current scratchpad content (possibly truncated):\n${trimmed}\n\n`;
  }

  if (Array.isArray(messages) && messages.length > 0) {
    context += `Recent conversation (most recent last):\n`;
    const recentMessages = messages.slice(-8);
    recentMessages.forEach((msg) => {
      if (msg.role === 'user') {
        context += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant' && !msg.nudge) {
        context += `Assistant: ${msg.content}\n`;
      }
    });
    context += '\n';
  }

    // Format nudges for the GPT prompt (with new numbering starting from 1)
    const maxNudgesInPrompt = parseInt(process.env.MAX_NUDGES_IN_PROMPT || "40", 10);
    const nudgesForPrompt =
      allNudges.length > maxNudgesInPrompt
        ? [...allNudges].sort(() => Math.random() - 0.5).slice(0, maxNudgesInPrompt)
        : allNudges;

    const nudgeOptions = nudgesForPrompt.map((nudge, index) => ({
      index,
      id: nudge._id.toString(),
      text: nudge.text,
      category: nudge.category
    }));
    
    console.log(`Recommending from ${nudgeOptions.length} nudges (${shownNudgeIds.length} already shown)`);

    // Create GPT prompt
    const systemPrompt = `You are a helpful assistant that recommends the most relevant insight or nudge to help a user with their current work. Based on the user's scratchpad content and conversation history, suggest which nudge would be most helpful and contextual.`;
    
    const userPrompt = `${context}

Here are the available nudges (numbered starting from 1):
${nudgeOptions.map((opt, idx) => `${idx + 1}. [Category: ${opt.category}] ${opt.text}`).join('\n')}

Based on the user's current work in the scratchpad and their conversation, please respond with ONLY the number (1-${nudgeOptions.length}) of the nudge that would be most helpful and relevant. Do not include any other text, just the number.`;

    // Get recommendation from GPT
  return context;
};

/**
 * Parse the LLM response into an array of nudge objects.
 * We expect a JSON object with a top-level "nudges" array, but we
 * defensively handle common failure modes.
 */
const parseGeneratedNudges = (raw, phase) => {
  if (!raw || typeof raw !== 'string') {
    return [];
  }

  let text = raw.trim();

  // Strip markdown fences if present
  if (text.startsWith('```')) {
    const lines = text.split('\n');
    if (lines[0].startsWith('```')) {
      lines.shift();
    }
    if (lines.length && lines[lines.length - 1].startsWith('```')) {
      lines.pop();
    }
    text = lines.join('\n').trim();
  }

  // Try to extract JSON object between first "{" and last "}"
  let jsonCandidate = text;
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonCandidate = text.slice(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(jsonCandidate);
    const nudges = Array.isArray(parsed.nudges) ? parsed.nudges : [];

    return nudges
      .filter((n) => n && typeof n.text === 'string' && n.text.trim())
      .map((n, index) => ({
        id: n.id || `llm-${Date.now()}-${index}`,
        text: n.text.trim(),
        phase: n.phase || phase,
        goal: n.goal || 'unspecified',
        topic: n.topic || 'unspecified',
      }));
  } catch (err) {
    console.error('Failed to parse generated nudges JSON, falling back to raw text', err);

    // Fallback: treat entire cleaned text as one nudge question.
    return [
      {
        id: `llm-${Date.now()}-0`,
        text: text,
        phase,
        goal: 'unspecified',
        topic: 'unspecified',
      },
    ];
  }
};

/**
 * Generate one or more nudges via the LLM, given the current session context.
 */
export const generateNudges = async ({
  sessionId = null,
  scratchpadText = '',
  messages = [],
  plantuml: providedPlantuml,
  umlSummary: providedUmlSummary,
  trigger = 'timer',
  avoidTopics = [],
} = {}) => {
  try {
    let plantuml = providedPlantuml || '';
    let umlSummary = providedUmlSummary || null;

    if (!plantuml && sessionId) {
      try {
        const session = await sessionService.getSession(sessionId);
        if (session && typeof session.getUmlState === 'function') {
          const umlState = session.getUmlState();
          if (umlState && typeof umlState.plantumlCode === 'string') {
            plantuml = umlState.plantumlCode;
          }
        }
      } catch (sessionError) {
        console.error('Error loading UML state for nudge context:', sessionError);
      }
    }

    if (!umlSummary && plantuml) {
      umlSummary = summarizePlantUml(plantuml);
    }

    const phase = classifyDesignPhase(umlSummary);
    const focus = chooseCriticFocus(phase, umlSummary);

    const hasMeaningfulContext =
      (scratchpadText && scratchpadText.trim().length > 0) ||
      (Array.isArray(messages) && messages.length > 0) ||
      (umlSummary && umlSummary.totalElements > 0);

    // If there is almost no context, avoid noisy nudges unless in start phase.
    if (!hasMeaningfulContext && phase !== 'start') {
      console.log(
        'No meaningful context for generated nudges; returning empty list',
        { phase, trigger },
      );
      return { nudges: [], phase, trigger, umlSummary };
    }

    const context = buildNudgeContext({
      phase,
      trigger,
      umlSummary,
      scratchpadText,
      messages,
    });

    console.log('Generating nudges via LLM', {
      phase,
      trigger,
      focus,
      umlSummary,
      scratchpadLength: scratchpadText.length,
      numMessages: messages.length,
    });

    const systemPrompt = `
You are a UML design critic helping a student iteratively improve a UML class diagram.

You will receive:
- The rough phase of their design process (start, early, mid, late)
- A lightweight summary of the current UML diagram
- Excerpts from their notes and recent conversation
- A requested critic focus area.

Your task:
- Propose between 1 and 3 SHORT reflective questions ("nudges") that help the student think more deeply about the requested focus.
- Do NOT provide direct solutions, code, or a complete redesign of the diagram.
- Each nudge MUST be phrased as a question (or two closely related sentences) that invites reflection.

Response format:
Return ONLY a JSON object with this structure, and nothing else:

{
  "nudges": [
    {
      "text": "...",
      "goal": "completeness|precision|consistency|reflection",
      "topic": "stakeholders|use_cases|relationships|methods|attributes|other"
    }
  ]
}
`.trim();

    const userPrompt = `
Here is the current design context:

${context}

Critic focus for this nudge:
- ${focus}

Avoid repeating these topics if possible:
- ${(Array.isArray(avoidTopics) && avoidTopics.length > 0) ? avoidTopics.join(', ') : '(none)'}

Now generate your JSON response with 1-3 nudges as specified.
`.trim();

    const gptMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const completion = await getChatCompletion(gptMessages);
    const raw = completion?.choices?.[0]?.message?.content || '';

    let nudges = parseGeneratedNudges(raw, phase);

    // Filter out avoided topics if provided (best-effort; fallback if all removed)
    const avoidSet = new Set(
      (Array.isArray(avoidTopics) ? avoidTopics : [])
        .map((t) => String(t).toLowerCase().trim())
        .filter(Boolean),
    );
    if (avoidSet.size > 0) {
      const filtered = nudges.filter((n) => {
        const topic = String(n.topic || '').toLowerCase().trim();
        return !topic || !avoidSet.has(topic);
      });
      if (filtered.length > 0) {
        nudges = filtered;
      }
    }

    console.log('Generated nudges count', nudges.length);

    // Optionally log generated nudges to DB for later analysis
    try {
      if (nudges.length > 0) {
        await Nudge.insertMany(
          nudges.map((n) => ({
            text: n.text,
            category: n.topic || 'Generated',
          })),
        );
      }
    } catch (logErr) {
      console.error('Failed to persist generated nudges snapshot', logErr);
    }

    return {
      nudges,
      phase,
      trigger,
      umlSummary,
    };
  } catch (error) {
    console.error('Error generating nudges:', error);
    return {
      nudges: [],
      phase: 'start',
      trigger,
      umlSummary: null,
    };
  }
};

/**
 * Legacy helper: get a single smart nudge document based on the current session
 * context by delegating to generateNudges and returning the first nudge.
 * This is kept for backwards compatibility with older callers.
 */
export const getSmartNudge = async (...args) => {
  try {
    // Normalise arguments to an options object for backwards compatibility
    let options;
    if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      options = args[0];
    } else {
      const [scratchpadText = '', messages = [], shownNudgeIds = []] = args;
      options = { scratchpadText, messages, shownNudgeIds };
    }

    const { shownNudgeIds, ...rest } = options;

    const { nudges, phase, trigger, umlSummary } = await generateNudges(rest);

    if (!nudges || nudges.length === 0) {
      console.log('No generated nudges available, falling back to random DB nudge');
      const randomNudge = await Nudge.aggregate([{ $sample: { size: 1 } }]);
      return randomNudge[0];
    }

    const first = nudges[0];

    console.log('Selected smart nudge (from generated list)', {
      id: first.id,
      goal: first.goal,
      topic: first.topic,
      phase,
      trigger,
      umlSummary,
    });

    // For legacy callers, return a shape similar to a stored Nudge document.
    return {
      _id: first.id,
      text: first.text,
      category: first.topic || 'Generated',
    };
  } catch (error) {
    console.error('Error getting smart nudge:', error);
    // Fall back to random if smart selection fails
    const randomNudge = await Nudge.aggregate([
      { $sample: { size: 1 } }
    ]);
    return randomNudge[0];
  }
};
