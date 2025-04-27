// background.js
chrome.runtime.onInstalled.addListener(() => {
  // Default settings
  chrome.storage.sync.get(["selectedModel"], (result) => {
    if (!result.selectedModel) {
      chrome.storage.sync.set({ selectedModel: "openai" });
    }
  });
});

// Combined message listener for all actions
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Save API key
  if (request.action === "saveApiKey") {
    chrome.storage.sync.set({ apiKey: request.apiKey }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Save model
  if (request.action === "saveModel") {
    chrome.storage.sync.set({ selectedModel: request.model }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Save custom model
  if (request.action === "saveCustomModel") {
    chrome.storage.sync.set({ customModel: request.customModel }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Handle Ollama API call
  if (request.action === "callOllama") {
    const { text, instruction, customModel } = request.data;

    const payload = {
      model: customModel,
      temperature: 0.7,
      stream: false,
      messages: [
        {
          role: "user",
          content: `Instruction: ${instruction}\n\nText to enhance: ${text}\n\nPlease modify the text as per the instruction and provide the enhanced text as your response. Ensure the response includes any necessary additional text but excludes explanations or formatting.`,
        },
      ],
    };

    fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        //console.log("res: ",response)
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Ollama API request failed: ${response.status} ${response.statusText} - ${errorText}`
          );
        }
        return response.json();
      })
      .then((parsed) => {
        try {
          const content =
            parsed?.message?.content ||
            parsed?.content?.[0]?.text ||
            parsed?.content;

          if (!content) {
            throw new Error("Unexpected response format from Ollama API");
          }

          sendResponse({ success: true, data: content.trim() });
        } catch (e) {
          console.error("Failed to parse or extract response content:", e);
          //console.log('Raw response data:', parsed);
          sendResponse({
            success: false,
            error: "Invalid response from Ollama API",
          });
        }
      })
      .catch((error) => {
        console.error("Error calling Ollama API:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }
});
