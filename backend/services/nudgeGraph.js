import { StateGraph, Annotation } from '@langchain/langgraph';
import sessionService from './sessionService.js';
import { Nudge } from '../models/NudgeModel.js';
import { runOrchestrator } from './nudgeOrchestrator.js';
import { generateNudge } from './nudgeAgent.js';

const actionToMode = (action) => {
  const a = String(action || '').trim();
  if (a === 'nudge_reflect') return 'reflect';
  if (a === 'nudge_expand') return 'expand';
  if (a === 'structure') return 'structure';
  // Default.
  return 'reflect';
};

const computeDistributionOverride = ({ currentAction, recentModes }) => {
  // Targets: reflect 70%, expand 20%, structure 10%
  const targets = { reflect: 0.7, expand: 0.2, structure: 0.1 };
  const counts = { reflect: 0, expand: 0, structure: 0 };
  for (const m of recentModes) {
    if (counts[m] !== undefined) counts[m] += 1;
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const ratios = {
    reflect: counts.reflect / total,
    expand: counts.expand / total,
    structure: counts.structure / total,
  };

  // Only override non-none actions.
  if (!currentAction || currentAction === 'none') return currentAction;

  const currentMode = actionToMode(currentAction);
  const target = targets[currentMode];

  // If we're overshooting the current mode, gently rotate to the most underrepresented one.
  // This keeps distribution "trending" without hard-coding quotas.
  const overshootThreshold = target + 0.12;
  if (ratios[currentMode] > overshootThreshold) {
    let bestMode = currentMode;
    let bestGap = -Infinity;
    for (const mode of Object.keys(targets)) {
      const gap = targets[mode] - ratios[mode];
      if (gap > bestGap) {
        bestGap = gap;
        bestMode = mode;
      }
    }

    // Map mode back to an action.
    if (bestMode !== currentMode) {
      if (bestMode === 'reflect') return 'nudge_reflect';
      if (bestMode === 'expand') return 'nudge_expand';
      if (bestMode === 'structure') return 'structure';
    }
  }

  return currentAction;
};

const StateAnnotation = Annotation.Root({
  sessionId: Annotation({ default: () => '' }),
  trigger: Annotation({ default: () => '' }),
  message: Annotation({ default: () => '' }),
  workspace: Annotation({ default: () => '' }),

  action: Annotation({ default: () => 'none' }),
  reason: Annotation({ default: () => '' }),
  mode: Annotation({ default: () => 'reflect' }),

  nudges: Annotation({
    default: () => [],
    reducer: (left, right) => left.concat(right),
  }),

  recentNudgeTexts: Annotation({
    default: () => [],
    reducer: (left, right) => left.concat(right),
  }),
});

const buildGraph = () => {
  const graph = new StateGraph(StateAnnotation);

  graph.addNode('orchestrator', async (state) => {
    const { sessionId, message, workspace } = state;
    const orchestratorOutput = await runOrchestrator({ message, workspace });
    let { action, reason } = orchestratorOutput || { action: 'none', reason: '' };

    // Repetition / distribution memory is optional; only apply when session exists.
    if (!sessionId || action === 'none') {
      return { action, reason };
    }

    const session = await sessionService.getSession(sessionId).catch(() => null);
    const sessionMessages = Array.isArray(session?.messages) ? session.messages : [];

    const recentNudgeMessages = sessionMessages
      .filter((m) => m && m.isNudge && m.nudgeId)
      .slice(-20);

    const recentNudgeIds = recentNudgeMessages
      .map((m) => String(m.nudgeId))
      .filter(Boolean);

    const recentNudgeTexts = recentNudgeMessages
      .slice(-5)
      .map((m) => String(m.content || '').trim())
      .filter(Boolean);

    let recentModes = [];
    if (recentNudgeIds.length > 0) {
      const docs = await Nudge.find({ _id: { $in: recentNudgeIds } }).lean().catch(() => []);
      const idToCategory = new Map(
        (docs || []).map((d) => [String(d._id), String(d.category || '').trim()])
      );
      recentModes = recentNudgeMessages
        .map((m) => idToCategory.get(String(m.nudgeId)) || null)
        .filter(Boolean);
    }

    const adjustedAction = computeDistributionOverride({ currentAction: action, recentModes });
    return { action: adjustedAction, reason, recentNudgeTexts };
  });

  graph.addNode('generateNudge', async (state) => {
    const { action, message, workspace, recentNudgeTexts } = state;
    const mode = actionToMode(action);

    const avoidanceBlock =
      Array.isArray(recentNudgeTexts) && recentNudgeTexts.length > 0
        ? `\n\nRecent nudges to avoid repeating (last ${Math.min(5, recentNudgeTexts.length)}):\n${recentNudgeTexts
            .slice(0, 5)
            .map((t) => `- ${t}`)
            .join('\n')}\n`
        : '';

    const workspaceForAgent = `${workspace || ''}${avoidanceBlock}`.trim();
    const nudgeText = await generateNudge({ mode, message, workspace: workspaceForAgent });
    return { mode, nudges: [nudgeText] };
  });

  graph.addEdge('__start__', 'orchestrator');
  graph.addConditionalEdges('orchestrator', (state) => {
    if (state.action === 'none') return '__end__';
    return 'generateNudge';
  });
  graph.addEdge('generateNudge', '__end__');

  return graph.compile();
};

let compiledGraph = null;
const getCompiledGraph = () => {
  if (!compiledGraph) compiledGraph = buildGraph();
  return compiledGraph;
};

// The graph runner returns:
// { action, reason, mode, nudges: string[] }
export async function runNudgeGraph({ sessionId, message, workspace, trigger }) {
  const graph = getCompiledGraph();
  const result = await graph.invoke({
    sessionId: String(sessionId || ''),
    trigger: String(trigger || ''),
    message: String(message || ''),
    workspace: String(workspace || ''),
  });

  return {
    action: result?.action || 'none',
    reason: result?.reason || '',
    mode: result?.mode || actionToMode(result?.action),
    nudges: Array.isArray(result?.nudges) ? result.nudges : [],
  };
}

