// services/nudgeService.js
import { Nudge } from '../models/NudgeModel.js';
import { getChatCompletion } from './chatService.js';

/**
 * Get a smart nudge recommendation based on scratchpad and chat content
 * @param {string} scratchpadText - The current scratchpad content
 * @param {Array} messages - The chat messages array
 * @param {Array} shownNudgeIds - Array of nudge IDs that have already been shown (to avoid duplicates)
 * @returns {Object} - The recommended nudge
 */
export const getSmartNudge = async (scratchpadText = '', messages = [], shownNudgeIds = []) => {
  try {
    // Get all available nudges, excluding ones that have already been shown
    const allNudges = await Nudge.find({
      _id: { $nin: shownNudgeIds }
    });
    
    // If we've shown all nudges, reset and allow duplicates
    if (!allNudges || allNudges.length === 0) {
      console.log('All nudges have been shown, allowing duplicates');
      return await getSmartNudge(scratchpadText, messages, []);
    }

    // If there's no meaningful content, fall back to random selection
    if (!scratchpadText.trim() && messages.length === 0) {
      const randomNudge = allNudges[Math.floor(Math.random() * allNudges.length)];
      return randomNudge;
    }

    // Build context from scratchpad and recent messages
    let context = '';
    
    if (scratchpadText.trim()) {
      context += `User's current scratchpad content:\n${scratchpadText}\n\n`;
    }

    if (messages.length > 0) {
      context += `Recent conversation:\n`;
      // Include last 5 messages for context
      const recentMessages = messages.slice(-5);
      recentMessages.forEach((msg, index) => {
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
    const gptMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const completion = await getChatCompletion(gptMessages);
    const response = completion.choices[0].message.content.trim();
    
    // Parse the response to get the nudge index
    const selectedIndex = parseInt(response, 10) - 1;
    
    // Validate the index
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= nudgesForPrompt.length) {
      console.log('Invalid nudge index from GPT, using random selection');
      const randomNudge = nudgesForPrompt[Math.floor(Math.random() * nudgesForPrompt.length)];
      return randomNudge;
    }

    const selectedNudge = nudgesForPrompt[selectedIndex];
    
    // Increment usage count
    await Nudge.findByIdAndUpdate(selectedNudge._id, {
      $inc: { usageCount: 1 }
    });

    return selectedNudge;
  } catch (error) {
    console.error('Error getting smart nudge:', error);
    // Fall back to random if smart selection fails
    const randomNudge = await Nudge.aggregate([
      { $sample: { size: 1 } }
    ]);
    return randomNudge[0];
  }
};
