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
  const settingsStatus = document.getElementById('settingsStatus');

  // General tab elements
  const modelSelect = document.getElementById('modelSelect');
  const modelInfo = document.getElementById('modelInfo');
  const usageStats = document.getElementById('usageStats');
  const apiUrlInput = document.getElementById('apiUrlInput');
  const saveApiUrl = document.getElementById('saveApiUrl');

  // Categories tab elements
  const categoriesList = document.getElementById('categoriesList');
  const newCategoryName = document.getElementById('newCategoryName');
  const newCategoryColor = document.getElementById('newCategoryColor');
  const newCategoryDesc = document.getElementById('newCategoryDesc');
  const addCategoryBtn = document.getElementById('addCategoryBtn');

  // Tags tab elements
  const tagsList = document.getElementById('tagsList');
  const mergeSource = document.getElementById('mergeSource');
  const mergeTarget = document.getElementById('mergeTarget');
  const mergeTagsBtn = document.getElementById('mergeTagsBtn');

  // State
  let availableModels = [];
  let currentModel = '';
  let categories = [];
  let tags = [];

  // Load recent captures on open
  loadRecentCaptures();

  // ============ Main View ============

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

  // ============ Settings Navigation ============

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

  // ============ Settings Tabs ============

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;

      // Update active tab button
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show corresponding tab content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`tab-${tabName}`).classList.add('active');

      // Load tab-specific data
      if (tabName === 'categories') {
        loadCategories();
      } else if (tabName === 'tags') {
        loadTags();
      }
    });
  });

  // ============ General Tab ============

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
        modelSelect.value = currentModel;
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

  // ============ Categories Tab ============

  async function loadCategories() {
    categoriesList.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCategories' });

      if (response.success) {
        categories = response.categories;
        renderCategories();
      } else {
        categoriesList.innerHTML = '<div class="empty">Failed to load categories</div>';
      }
    } catch (err) {
      categoriesList.innerHTML = '<div class="empty">Error loading categories</div>';
    }
  }

  function renderCategories() {
    if (!categories.length) {
      categoriesList.innerHTML = '<div class="empty">No categories</div>';
      return;
    }

    categoriesList.innerHTML = categories.map(cat => `
      <div class="item-row" data-id="${cat.id}">
        <div class="item-info">
          <div class="item-color" style="background: ${cat.color}"></div>
          <span class="item-name">${escapeHtml(cat.name)}</span>
          ${cat.is_default ? '<span class="item-default">default</span>' : ''}
        </div>
        <div class="item-actions">
          ${!cat.is_default ? `<button class="item-btn delete" data-action="delete-category" data-id="${cat.id}">Delete</button>` : ''}
        </div>
      </div>
    `).join('');

    // Add delete handlers
    categoriesList.querySelectorAll('[data-action="delete-category"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (!confirm('Delete this category? Captures will be moved to "reference".')) return;

        const response = await chrome.runtime.sendMessage({ action: 'deleteCategory', id });
        if (response.success) {
          loadCategories();
          showStatus(settingsStatus, true, 'Category deleted');
        } else {
          showStatus(settingsStatus, false, response.error || 'Failed to delete');
        }
      });
    });
  }

  addCategoryBtn.addEventListener('click', async () => {
    const name = newCategoryName.value.trim();
    if (!name) {
      showStatus(settingsStatus, false, 'Category name is required');
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'addCategory',
      category: {
        name,
        color: newCategoryColor.value,
        description: newCategoryDesc.value.trim()
      }
    });

    if (response.success) {
      newCategoryName.value = '';
      newCategoryDesc.value = '';
      loadCategories();
      showStatus(settingsStatus, true, 'Category added!');
    } else {
      showStatus(settingsStatus, false, response.error || 'Failed to add');
    }
  });

  // ============ Tags Tab ============

  async function loadTags() {
    tagsList.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'getTags' });

      if (response.success) {
        tags = response.tags || [];
        renderTags();
        updateMergeDropdowns();
      } else {
        tagsList.innerHTML = '<div class="empty">Failed to load tags</div>';
      }
    } catch (err) {
      tagsList.innerHTML = '<div class="empty">Error loading tags</div>';
    }
  }

  function renderTags() {
    if (!tags.length) {
      tagsList.innerHTML = '<div class="empty">No tags yet</div>';
      return;
    }

    tagsList.innerHTML = tags.map(tag => `
      <div class="item-row" data-name="${escapeHtml(tag.name)}">
        <div class="item-info">
          <span class="item-name">${escapeHtml(tag.name)}</span>
          <span class="item-count">${tag.count}</span>
        </div>
        <div class="item-actions">
          <button class="item-btn delete" data-action="delete-tag" data-name="${escapeHtml(tag.name)}">Delete</button>
        </div>
      </div>
    `).join('');

    // Add delete handlers
    tagsList.querySelectorAll('[data-action="delete-tag"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.name;
        if (!confirm(`Delete tag "${name}" from all captures?`)) return;

        const response = await chrome.runtime.sendMessage({ action: 'deleteTag', name });
        if (response.success) {
          loadTags();
          showStatus(settingsStatus, true, `Tag deleted from ${response.affected} captures`);
        } else {
          showStatus(settingsStatus, false, response.error || 'Failed to delete');
        }
      });
    });
  }

  function updateMergeDropdowns() {
    const options = tags.map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)} (${t.count})</option>`).join('');

    mergeSource.innerHTML = '<option value="">From...</option>' + options;
    mergeTarget.innerHTML = '<option value="">To...</option>' + options;
  }

  mergeTagsBtn.addEventListener('click', async () => {
    const source = mergeSource.value;
    const target = mergeTarget.value;

    if (!source || !target) {
      showStatus(settingsStatus, false, 'Select both source and target tags');
      return;
    }

    if (source === target) {
      showStatus(settingsStatus, false, 'Source and target must be different');
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'mergeTags',
      source,
      target
    });

    if (response.success) {
      loadTags();
      showStatus(settingsStatus, true, `Merged into "${target}" (${response.affected} captures)`);
    } else {
      showStatus(settingsStatus, false, response.error || 'Failed to merge');
    }
  });

  // ============ Utilities ============

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
