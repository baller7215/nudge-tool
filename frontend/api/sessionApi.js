const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api/session`;

export const sessionApi = {
  // Create a new session
  createSession: async (sessionData = {}) => {
    try {
      const response = await fetch(`${API_BASE_URL}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create session');
      }
      
      const data = await response.json();
      return data.sessionId;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  },

  // Get session by ID
  getSession: async (sessionId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${sessionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to get session');
      }
      
      const data = await response.json();
      return data.session;
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    }
  },

  // Get session statistics
  getSessionStats: async (sessionId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${sessionId}/stats`);
      
      if (!response.ok) {
        throw new Error('Failed to get session stats');
      }
      
      const data = await response.json();
      return data.stats;
    } catch (error) {
      console.error('Error getting session stats:', error);
      throw error;
    }
  },

  // Add message to session
  addMessage: async (sessionId, messageData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${sessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add message to session');
      }
      
      const data = await response.json();
      return data.session;
    } catch (error) {
      console.error('Error adding message to session:', error);
      throw error;
    }
  },

  // Update feedback for a message
  updateFeedback: async (sessionId, messageIndex, feedbackType) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${sessionId}/feedback/${messageIndex}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedbackType }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update feedback');
      }
      
      const data = await response.json();
      return data.session;
    } catch (error) {
      console.error('Error updating feedback:', error);
      throw error;
    }
  },

  // Add spin interaction
  addSpinInteraction: async (sessionId, messageIndex, action) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${sessionId}/spin/${messageIndex}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to track spin interaction');
      }
      
      const data = await response.json();
      return data.session;
    } catch (error) {
      console.error('Error tracking spin interaction:', error);
      throw error;
    }
  },

  // Add card interaction
  addCardInteraction: async (sessionId, cardData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${sessionId}/card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cardData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to track card interaction');
      }
      
      const data = await response.json();
      return data.session;
    } catch (error) {
      console.error('Error tracking card interaction:', error);
      throw error;
    }
  },

  // End session
  endSession: async (sessionId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${sessionId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to end session');
      }
      
      const data = await response.json();
      return data.session;
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  },

  // Get recent active sessions
  getRecentSessions: async (limit = 10) => {
    try {
      const response = await fetch(`${API_BASE_URL}/recent/active?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error('Failed to get recent sessions');
      }
      
      const data = await response.json();
      return data.sessions;
    } catch (error) {
      console.error('Error getting recent sessions:', error);
      throw error;
    }
  },

  // Add scratchpad snapshot
  addScratchpadSnapshot: async (sessionId, text) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${sessionId}/scratchpad-snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        throw new Error('Failed to add scratchpad snapshot');
      }
      const data = await response.json();
      return data.session;
    } catch (error) {
      console.error('Error adding scratchpad snapshot:', error);
      throw error;
    }
  },

  // Upsert nudge state for current session
  upsertNudgeState: async (sessionId, nudgeData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${sessionId}/nudge-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nudgeData),
      });
      if (!response.ok) {
        throw new Error('Failed to update nudge state');
      }
      const data = await response.json();
      return data.session;
    } catch (error) {
      console.error('Error updating nudge state:', error);
      throw error;
    }
  },

  // Toggle completion status by displayId
  toggleNudgeCompletion: async (sessionId, displayId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${sessionId}/nudge-state/${encodeURIComponent(displayId)}/toggle-completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Failed to toggle nudge completion');
      }
      const data = await response.json();
      return data.session;
    } catch (error) {
      console.error('Error toggling nudge completion:', error);
      throw error;
    }
  },
}; 