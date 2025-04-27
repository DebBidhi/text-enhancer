//content.js
let activeElement = null;
let enhancerPopup = null;
let inputText = "";
let apiKey = "";
let customModel = "";
let selectedModel = "openai";

// Initialize the extension
function init() {
  // console.log('Text Enhancer initialized!');

  createEnhancerPopup();

  chrome.storage.sync.get(
    ["apiKey", "selectedModel", "customModel"],
    (result) => {
      apiKey = result.apiKey || "";
      selectedModel = result.selectedModel || "openai";
      customModel = result.customModel || "";

      // console.log('Loaded settings - Selected model:', selectedModel, 'Custom model:', customModel);
    }
  );

  document.addEventListener("keydown", handleKeyDown, true);
}

function createEnhancerPopup() {
  // console.log('Creating the enhancer popup');
  enhancerPopup = document.createElement("div");
  enhancerPopup.className = "text-enhancer-popup";
  enhancerPopup.style.width = "45vw";
  enhancerPopup.style.borderRadius = "8px";
  enhancerPopup.innerHTML = `
    <div class="text-enhancer-header">
      <span>Text Enhancer... (Enhance text with LLMs)</span>
      <button class="text-enhancer-close">✕</button>
    </div>
    <div class="text-enhancer-body">
      <input type="text" class="text-enhancer-input" placeholder="Enter your instruction (e.g., make it formal)">
      <div class="text-enhancer-actions">
        <div class="text-enhancer-loader"></div>
        <button class="text-enhancer-submit">Enhance</button>
      </div>
    </div>
    <div class="text-enhancer-keyboard-hint">
      Esc to close
    </div>
  `;
  document.body.appendChild(enhancerPopup);

  enhancerPopup
    .querySelector(".text-enhancer-close")
    .addEventListener("click", hidePopup);

  const submitButton = enhancerPopup.querySelector(".text-enhancer-submit");
  submitButton.addEventListener("click", enhanceText);

  const input = enhancerPopup.querySelector(".text-enhancer-input");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      enhanceText();
    } else if (e.key === "Escape") {
      hidePopup();
    }
  });

  hidePopup();
}
// Note: (e.ctrlKey || e.metaKey) && e.key === 'b' doesn't work on a lot of sites due to treating Ctrl|Cmd as individual inputs rather than a combination; considering repeat also won't help
function handleKeyDown(e) {
  // console.log('Handling keyboard shortcut');

  let isCtrlOrCmdPressed = false;
  if (e.ctrlKey || e.metaKey) {
    // console.log('Ctrl or Cmd pressed');
    isCtrlOrCmdPressed = true;
    setTimeout(() => (isCtrlOrCmdPressed = false), 2000);
  }

  if (isCtrlOrCmdPressed && e.key === "b") {
    // console.log('Ctrl+B shortcut triggered');
    e.preventDefault();

    if (isEditableElement(document.activeElement)) {
      activeElement = document.activeElement;
      inputText = getInputText(activeElement);

      if (inputText.trim() !== "") {
        showPopup();
      }
    }
  }
}

// function to check if the element is editable
function isEditableElement(element) {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  const contentEditable = element.getAttribute("contenteditable");

  return (
    (tagName === "input" &&
      ["text", "search", "url", "tel", "email", "password", ""].includes(
        element.type
      )) ||
    tagName === "textarea" ||
    contentEditable === "true" ||
    contentEditable === ""
  );
}

// Get text from the input element
function getInputText(element) {
  // console.log('Getting text from the input element');
  if (!element) return "";

  const tagName = element.tagName.toLowerCase();
  const contentEditable = element.getAttribute("contenteditable");

  if (contentEditable === "true" || contentEditable === "") {
    return element.innerText;
  } else if (tagName === "input" || tagName === "textarea") {
    const start = element.selectionStart;
    const end = element.selectionEnd;

    // If there's selected text, use that, otherwise use all text****()
    return start !== end ? element.value.substring(start, end) : element.value;
  }

  return "";
}

// popup near the active element
function showPopup() {
  // console.log('Trying to show the popup near the active element');

  if (!activeElement || !enhancerPopup) {
    // console.log('Popup not shown due to missing activeElement or enhancerPopup');
    return;
  }

  const rect = activeElement.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

  enhancerPopup.style.top = `${rect.bottom + scrollTop}px`;
  enhancerPopup.style.left = `${rect.left + scrollLeft}px`;
  enhancerPopup.style.display = "block";

  const input = enhancerPopup.querySelector(".text-enhancer-input");
  input?.focus();

  const popupRect = enhancerPopup.getBoundingClientRect();
  const isVisible =
    enhancerPopup.style.display !== "none" &&
    popupRect.top >= 0 &&
    popupRect.left >= 0 &&
    popupRect.bottom <= window.innerHeight &&
    popupRect.right <= window.innerWidth;

  if (isVisible) {
    // console.log('✅ Popup is visible on screen');
  } else {
    // Adjust the popup to appear in the middle of the screen if it's not fully visible
    enhancerPopup.style.top = `${
      (window.innerHeight - popupRect.height) / 2
    }px`;
    enhancerPopup.style.left = `${(window.innerWidth - popupRect.width) / 2}px`;
    // console.log('✅ Popup is now visible in the middle of the screen');
  }
}

// Hide the popup
function hidePopup() {
  // console.log('Hiding the popup');
  if (!enhancerPopup) return;
  enhancerPopup.style.display = "none";

  // Clear the input
  const input = enhancerPopup.querySelector(".text-enhancer-input");
  input.value = "";

  // Hide loader
  const loader = enhancerPopup.querySelector(".text-enhancer-loader");
  loader.style.display = "none";

  // Re-focus the original input
  if (activeElement) {
    activeElement.focus();
  }
}

// Enhance text using selected model
async function enhanceText() {
  // console.log('Enhancing the text using the selected AI model:', selectedModel);
  if (!activeElement || !enhancerPopup) return;

  if (
    (selectedModel === "openai" || selectedModel === "anthropic") &&
    !apiKey
  ) {
    showError("API key not set. Please set it in the extension popup.");
    return;
  }

  const instructionInput = enhancerPopup.querySelector(".text-enhancer-input");
  const instruction = instructionInput.value.trim();

  if (instruction === "") {
    showError("Please provide an instruction.");
    return;
  }

  // Show loader
  const loader = enhancerPopup.querySelector(".text-enhancer-loader");
  loader.style.display = "block";

  try {
    let enhancedText;

    if (selectedModel === "openai") {
      enhancedText = await callOpenAI(inputText, instruction);
    } else if (selectedModel === "anthropic") {
      enhancedText = await callAnthropic(inputText, instruction);
    } else if (selectedModel === "ollama model:custom") {
      if (!customModel) {
        throw new Error(
          "Custom model name not set. Please set it in the extension popup."
        );
      }
      enhancedText = await callOllamaCustom(
        inputText,
        instruction,
        customModel
      );
    } else {
      throw new Error("Invalid model selected");
    }

    // Replace the original text with the enhanced text
    replaceText(enhancedText);

    // Hide the popup
    hidePopup();
  } catch (error) {
    showError(`Error: ${error.message}`);
    console.error("Enhancement error:", error);
  } finally {
    // Hide loader
    loader.style.display = "none";
  }
}

// Modified replaceText function with improved Twitter handling
function replaceText(newText) {
  if (!activeElement) return;

  const tagName = activeElement.tagName.toLowerCase();
  const contentEditable = activeElement.getAttribute("contenteditable");
  const isTwitter =
    window.location.hostname.includes("x.com") ||
    window.location.hostname.includes("twitter.com");

  if (isTwitter) {
    // Use modern approach for Twitter/X.com
    insertTextIntoTwitterEditor(newText);
  } else if (contentEditable === "true" || contentEditable === "") {
    // Normal handling for contentEditable elements
    activeElement.innerText = newText;
    activeElement.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (tagName === "input" || tagName === "textarea") {
    // Normal handling for input and textarea elements
    const start = activeElement.selectionStart;
    const end = activeElement.selectionEnd;
    const oldValue = activeElement.value;

    // If there's selected text, replace that, otherwise replace all text
    if (start !== end) {
      activeElement.value =
        oldValue.substring(0, start) + newText + oldValue.substring(end);
      // Set cursor position after the inserted text
      activeElement.selectionStart = activeElement.selectionEnd =
        start + newText.length;
    } else {
      activeElement.value = newText;
    }

    // Trigger input event to notify the page about the change
    activeElement.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

// Modern function to insert text into Twitter's Draft.js editor
function insertTextIntoTwitterEditor(text) {
  try {
    // Focus the editor
    activeElement.focus();

    // Clear any existing text by simulating select all + delete
    // Create a Selection and Range
    const selection = window.getSelection();
    const range = document.createRange();

    // Select all content
    range.selectNodeContents(activeElement);
    selection.removeAllRanges();
    selection.addRange(range);

    // Simulate delete key
    const keyEvent = new KeyboardEvent("keydown", {
      key: "Delete",
      code: "Delete",
      keyCode: 46,
      which: 46,
      bubbles: true,
      cancelable: true,
    });
    activeElement.dispatchEvent(keyEvent);

    // Wait briefly for the delete operation to complete
    setTimeout(() => {
      // Now insert our text using a clipboard paste event
      insertViaClipboardEvent(text);
    }, 50);
  } catch (error) {
    console.error("Error in insertTextIntoTwitterEditor:", error);
    // Try direct insertion as fallback
    insertTextDirectly(text);
  }
}

// Insert text via ClipboardEvent
function insertViaClipboardEvent(text) {
  try {
    // Create a new ClipboardEvent
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    });

    // Set the clipboard data
    pasteEvent.clipboardData.setData("text/plain", text);

    // Dispatch the paste event
    activeElement.dispatchEvent(pasteEvent);

    // Fire input event to ensure Twitter's React components update
    activeElement.dispatchEvent(new Event("input", { bubbles: true }));

    // If it doesn't work, try direct insertion
    setTimeout(() => {
      if (!activeElement.textContent.includes(text)) {
        insertTextDirectly(text);
      }
    }, 100);
  } catch (error) {
    console.error("Error in insertViaClipboardEvent:", error);
    insertTextDirectly(text);
  }
}

// Direct text insertion method as a final fallback
function insertTextDirectly(text) {
  try {
    // For Draft.js editors, we can try setting textContent
    // followed by forcing React to update

    // Clear existing content
    while (activeElement.firstChild) {
      activeElement.removeChild(activeElement.firstChild);
    }

    // Create and insert a text node
    const textNode = document.createTextNode(text);
    activeElement.appendChild(textNode);

    // Dispatch multiple events that Draft.js/React might be listening for
    const events = [
      new Event("input", { bubbles: true, cancelable: true }),
      new Event("change", { bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: " ",
        keyCode: 32,
      }),
      new KeyboardEvent("keyup", {
        bubbles: true,
        cancelable: true,
        key: " ",
        keyCode: 32,
      }),
    ];

    events.forEach((event) => activeElement.dispatchEvent(event));

    // Create and dispatch a blur and focus event to force React to update
    activeElement.dispatchEvent(new Event("blur", { bubbles: true }));
    setTimeout(() => {
      activeElement.focus();
      activeElement.dispatchEvent(new Event("focus", { bubbles: true }));
    }, 10);
  } catch (error) {
    console.error("Error in insertTextDirectly:", error);
  }
}

// Show error message
function showError(message) {
  console.log("Showing error message for text_enhancer");
  alert(message);
}

// Call OpenAI API
async function callOpenAI(text, instruction) {
  // console.log('Calling OpenAI API');
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-2024-07-18",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that enhances text. Follow the instruction precisely and modify the text accordingly. Provide only the modified text as your response, without any additional explanations or formatting.",
        },
        {
          role: "user",
          content: `Instruction: ${instruction}\n\nText to enhance: ${text}`,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "OpenAI API request failed");
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// Call Anthropic API
async function callAnthropic(text, instruction) {
  // console.log('Calling Anthropic API');
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      messages: [
        {
          role: "user",
          content: `Instruction: ${instruction}\n\nText to enhance: ${text}\n\nPlease provide only the modified text as your response, without any additional explanations or formatting.`,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Anthropic API request failed");
  }

  const data = await response.json();
  return data.content[0].text.trim();
}

// Call Ollama API with custom model
async function callOllamaCustom(text, instruction, customModel) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "callOllama",
      data: { text, instruction, customModel },
    });

    //console.log('Response from Ollama:', response);

    if (response && response.success) {
      return response.data;
    } else {
      throw new Error(
        response?.error || "Unknown error in Ollama API response"
      );
    }
  } catch (error) {
    console.error("Error calling Ollama API:", error);
    throw new Error(`Ollama API error: ${error.message || "Unknown error"}`);
  }
}

init();
