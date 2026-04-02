// services/chatService.js
import dotenv from 'dotenv';

dotenv.config();

export const getChatCompletion = async (messages) => {
    const url = `https://azureapi.zotgpt.uci.edu/openai/deployments/${process.env.DEPLOYMENT_ID}/chat/completions?api-version=${process.env.API_VERSION}`;

    const inputMessages = Array.isArray(messages) ? messages : [];
    const hasSystemMessage = inputMessages.some((m) => m?.role === 'system');

    const systemMessage = {
      role: "system",
      content:
        "You are a helpful assistant. Provide a concise final answer (short and direct). Do not include hidden reasoning; output only the answer.",
    };

    const data = {
      temperature: 1,
      top_p: 1,
      stream: false,
      max_completion_tokens: parseInt(
        process.env.MAX_COMPLETION_TOKENS || process.env.MAX_TOKENS || "1024",
        10
      ),
      messages: hasSystemMessage ? inputMessages : [systemMessage, ...inputMessages],
    };
  
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "api-key": process.env.API_KEY, // Use environment variable for API key
        },
        body: JSON.stringify(data),
      });
  
      if (!response.ok) {
        let details = "";
        try {
          details = await response.text();
        } catch {
          // ignore
        }
        const trimmed = details ? details.slice(0, 1000) : response.statusText;
        throw new Error(`ZotGPT API error ${response.status}: ${trimmed}`);
      }
  
      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error calling ZotGPT API:", error);
      throw error;
    }
  };
  
