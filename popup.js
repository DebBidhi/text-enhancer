document.addEventListener('DOMContentLoaded', function () {
  const modelSelect = document.getElementById('model-select');
  const apiKeyInput = document.getElementById('api-key');
  const saveButton = document.getElementById('save-button');
  const customModel = document.getElementById('custom-model-name');

  // Load saved settings
  chrome.storage.sync.get(['apiKey', 'selectedModel', 'customModel'], function (result) {
    if (result.selectedModel) {
      modelSelect.value = result.selectedModel;
      toggleApiKeyInput(result.selectedModel);

      // Ensure correct visibility on load
      const customModelDiv = document.getElementById('custom-model-container');
      const apiConDiv = document.getElementById('text_enh_api');
      customModelDiv.style.display = result.selectedModel === 'ollama model:custom' ? 'block' : 'none';
      apiConDiv.style.display = ['openai', 'anthropic'].includes(result.selectedModel) ? 'block' : 'none';
    }
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
    if (result.customModel) {
      customModel.value = result.customModel;
    }
  });


  // Handle model selection changes
  modelSelect.addEventListener('change', function () {
    const selectedModel = modelSelect.value;
    toggleApiKeyInput(selectedModel);
    const customModelDiv = document.getElementById('custom-model-container');
    const apiConDiv = document.getElementById('text_enh_api');
    customModelDiv.style.display = selectedModel === 'ollama model:custom' ? 'block' : 'none';
    apiConDiv.style.display = ['openai', 'anthropic'].includes(selectedModel) ? 'block' : 'none';
  });

  // Save settings and refresh the page
  saveButton.addEventListener('click', function () {
    const model = modelSelect.value;
    const apiKey = apiKeyInput.value.trim();
    const customModelName = customModel.value.trim();

    if ((model === 'openai' || model === 'anthropic') && !apiKey) {
      showMessage('API key is required for the selected model.', true);
      return;
    }
    
    if (model === 'ollama model:custom' && !customModelName) {
      showMessage('Custom model name is required.', true);
      return;
    }

    // Save API key
    chrome.runtime.sendMessage({ action: 'saveApiKey', apiKey }, function (response) {
      if (response && response.success) {
        console.log('API key saved');
      }
    });

    // Save selected model
    chrome.runtime.sendMessage({ action: 'saveModel', model }, function (response) {
      if (response && response.success) {
        console.log('Model saved');
      }
    });

    // Save custom model name
    chrome.storage.sync.set({ customModel: customModelName }, function() {
      console.log('Custom model name saved');
    });

    // Refresh the page after saving settings
    chrome.tabs.reload();

    showMessage('Settings saved successfully!');
  });

  // Toggle API key input field based on selected model
  function toggleApiKeyInput(model) {
    const isOllama = model === 'ollama model';
    const isCustomModel = model === 'ollama model:custom';
    
    apiKeyInput.disabled = isOllama || isCustomModel;
    apiKeyInput.placeholder = isOllama || isCustomModel ? 'No API key needed for Ollama' : 'Enter your API key';

    // Show or hide the custom model name input field
    const customModelDiv = document.querySelector('.form-group[style*="display: none;"]');
    if (customModelDiv) {
      customModelDiv.style.display = isCustomModel ? 'block' : 'none';
    }
  }

  // Show message feedback
  function showMessage(message, isError = false) {
    const existingMessage = document.querySelector('.message');
    if (existingMessage) existingMessage.remove();

    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.textContent = message;
    messageElement.style.color = isError ? '#b00020' : '#006400';

    document.querySelector('.container').appendChild(messageElement);

    setTimeout(() => {
      messageElement.remove();
    }, 3000);
  }
});
