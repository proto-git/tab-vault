// Tab Vault Popup Script

document.addEventListener('DOMContentLoaded', () => {
  // Views
  const mainView = document.getElementById('mainView');
  const settingsView = document.getElementById('settingsView');

  // Main view elements
  const captureBtn = document.getElementById('captureBtn');
  const captureStatus = document.getElementById('captureStatus');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const resultsTitle = document.getElementById('resultsTitle');
  const resultsContainer = document.getElementById('results');
  const openFullSearch = document.getElementById('openFullSearch');
  const openSettings = document.getElementById('openSettings');

  // Settings view elements
  const backToMain = document.getElementById('backToMain');
  const modelSelect = document.getElementById('modelSelect');
  const modelInfo = document.getElementById('modelInfo');
  const usageStats = document.getElementById('usageStats');
  const apiUrlInput = document.getElementById('apiUrlInput');
  const saveApiUrl = document.getElementById('saveApiUrl');
  const settingsStatus = document.getElementById('settingsStatus');

  // State
  let availableModels = [];
  let currentModel = '';

  // Load recent captures on open
  loadRecentCaptures();

  // Capture button click
  captureBtn.addEventListener('click', async () => {
    captureBtn.classList.add('loading');
    captureBtn.disabled = true;
    captureBtn.innerHTML = '<span class="icon">...</span> Capturing...';

    const response = await chrome.runtime.sendMessage({ action: 'capture' });

    captureBtn.classList.remove('loading');
    captureBtn.disabled = false;
    captureBtn.innerHTML = '<span class="icon">+</span> Capture This Tab';

    showStatus(captureStatus, response.success, response.success
      ? 'Captured! ' + (response.data?.category || '')
      : response.error || 'Failed to capture');

    if (response.success) {
      setTimeout(loadRecentCaptures, 500);
    }
  });

  // Search functionality
  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) {
      loadRecentCaptures();
      return;
    }

    resultsTitle.textContent = 'Search Results';
    resultsContainer.innerHTML = '<div class="loading">Searching...</div>';

    const response = await chrome.runtime.sendMessage({ action: 'search', query });
    displayResults(response.results || []);
  }

  async function loadRecentCaptures() {
    resultsTitle.textContent = 'Recent Captures';
    resultsContainer.innerHTML = '<div class="loading">Loading...</div>';

    const response = await chrome.runtime.sendMessage({ action: 'getRecent' });
    displayResults(response.results || []);
  }

  function displayResults(results) {
    if (!results.length) {
      resultsContainer.innerHTML = '<div class="empty">No captures yet. Start capturing tabs!</div>';
      return;
    }

    resultsContainer.innerHTML = results.map(item => `
      <div class="result-item" data-url="${escapeHtml(item.url)}">
        <div class="title">${escapeHtml(item.title || item.url)}</div>
        ${item.summary ? `<div class="summary">${escapeHtml(item.summary)}</div>` : ''}
        <div class="meta">
          ${item.category ? `<span class="category">${escapeHtml(item.category)}</span>` : ''}
          <span class="date">${formatDate(item.created_at)}</span>
        </div>
      </div>
    `).join('');

    resultsContainer.querySelectorAll('.result-item').forEach(item => {
      item.addEventListener('click', () => {
        chrome.tabs.create({ url: item.dataset.url });
      });
    });
  }

  // Settings navigation
  openSettings.addEventListener('click', (e) => {
    e.preventDefault();
    showSettingsView();
  });

  backToMain.addEventListener('click', () => {
    showMainView();
  });

  function showSettingsView() {
    mainView.classList.add('hidden');
    settingsView.classList.remove('hidden');
    loadSettings();
    loadUsageStats();
    loadApiUrl();
  }

  function showMainView() {
    settingsView.classList.add('hidden');
    mainView.classList.remove('hidden');
  }

  // Load settings from API
  async function loadSettings() {
    modelSelect.innerHTML = '<option value="">Loading...</option>';
    modelInfo.innerHTML = '';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });

      if (response.success) {
        availableModels = response.options.models;
        currentModel = response.current.aiModel;

        modelSelect.innerHTML = availableModels.map(model => `
          <option value="${model.key}" ${model.key === currentModel ? 'selected' : ''}>
            ${model.name} (${model.provider})
          </option>
        `).join('');

        updateModelInfo(currentModel);
      } else {
        modelSelect.innerHTML = '<option value="">Failed to load</option>';
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      modelSelect.innerHTML = '<option value="">Error loading settings</option>';
    }
  }

  // Model selection change
  modelSelect.addEventListener('change', async () => {
    const newModel = modelSelect.value;
    if (!newModel || newModel === currentModel) return;

    modelSelect.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: { aiModel: newModel }
      });

      if (response.success) {
        currentModel = newModel;
        updateModelInfo(newModel);
        showStatus(settingsStatus, true, 'Model updated!');
      } else {
        showStatus(settingsStatus, false, response.error || 'Failed to update');
        modelSelect.value = currentModel; // Revert
      }
    } catch (err) {
      showStatus(settingsStatus, false, 'Error updating model');
      modelSelect.value = currentModel;
    }

    modelSelect.disabled = false;
  });

  function updateModelInfo(modelKey) {
    const model = availableModels.find(m => m.key === modelKey);
    if (!model) {
      modelInfo.innerHTML = '';
      return;
    }

    modelInfo.innerHTML = `
      <div class="model-detail">
        <span class="label">Speed</span>
        <span class="value">${capitalize(model.speed)}</span>
      </div>
      <div class="model-detail">
        <span class="label">Quality</span>
        <span class="value">${capitalize(model.quality)}</span>
      </div>
      <div class="model-detail">
        <span class="label">Est. Cost/Capture</span>
        <span class="value">${model.estimatedCostPerCapture}</span>
      </div>
    `;
  }

  // Load usage stats
  async function loadUsageStats() {
    usageStats.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'getUsage' });

      if (response.success && response.today) {
        usageStats.innerHTML = `
          <div class="stat-row">
            <span class="stat-label">Requests</span>
            <span class="stat-value">${response.today.requests}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Tokens</span>
            <span class="stat-value">${response.today.tokens.toLocaleString()}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Cost</span>
            <span class="stat-value cost">$${response.today.cost}</span>
          </div>
        `;
      } else {
        usageStats.innerHTML = '<div class="empty">No usage data yet</div>';
      }
    } catch (err) {
      usageStats.innerHTML = '<div class="empty">Failed to load usage</div>';
    }
  }

  // API URL management
  function loadApiUrl() {
    chrome.storage.sync.get(['apiUrl'], (result) => {
      apiUrlInput.value = result.apiUrl || 'https://backend-production-49f0.up.railway.app/api';
    });
  }

  saveApiUrl.addEventListener('click', () => {
    const newUrl = apiUrlInput.value.trim();
    if (newUrl) {
      chrome.storage.sync.set({ apiUrl: newUrl });
      showStatus(settingsStatus, true, 'API URL saved!');
    }
  });

  // Utility functions
  function showStatus(element, success, message) {
    element.textContent = message;
    element.className = `status ${success ? 'success' : 'error'}`;
    element.classList.remove('hidden');

    setTimeout(() => {
      element.classList.add('hidden');
    }, 3000);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return date.toLocaleDateString();
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  // Footer links
  openFullSearch.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.storage.sync.get(['frontendUrl'], (result) => {
      const url = result.frontendUrl || 'http://localhost:3002';
      chrome.tabs.create({ url });
    });
  });
});
