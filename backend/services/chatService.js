// services/chatService.js
import dotenv from 'dotenv';

dotenv.config();

export const getChatCompletion = async (messages) => {
    const url = `https://azureapi.zotgpt.uci.edu/openai/deployments/${process.env.DEPLOYMENT_ID}/chat/completions?api-version=${process.env.API_VERSION}`;

    const maxCompletionTokens = Number(process.env.MAX_COMPLETION_TOKENS || 1024);

    const data = {
      temperature: 1,
      top_p: 1,
      stream: false,
      stop: null,
      // Some Azure/OpenAI-compatible endpoints now require max_completion_tokens.
      // Using max_tokens will error on newer models.
      max_completion_tokens: maxCompletionTokens,
      messages: [
        {
          role: "system",
          content: "You are a chatbot assistant. You are helping a user with a task.",
        },
        ...messages, // Include the incoming messages
      ],
    };

    console.log('ok');
    console.log(data);
  
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
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}. Body: ${errorText}`);
      }
  
      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error calling ZotGPT API:", error);
      throw error;
    }
  };
  
