// Tab Vault Popup Script

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const captureBtn = document.getElementById('captureBtn');
  const captureStatus = document.getElementById('captureStatus');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const resultsTitle = document.getElementById('resultsTitle');
  const resultsContainer = document.getElementById('results');
  const openFullSearch = document.getElementById('openFullSearch');
  const openSettings = document.getElementById('openSettings');

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

    showStatus(response.success, response.success
      ? 'Captured! ' + (response.data?.category || '')
      : response.error || 'Failed to capture');

    if (response.success) {
      // Refresh results
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

    // Add click handlers to open URLs
    resultsContainer.querySelectorAll('.result-item').forEach(item => {
      item.addEventListener('click', () => {
        chrome.tabs.create({ url: item.dataset.url });
      });
    });
  }

  function showStatus(success, message) {
    captureStatus.textContent = message;
    captureStatus.className = `status ${success ? 'success' : 'error'}`;
    captureStatus.classList.remove('hidden');

    setTimeout(() => {
      captureStatus.classList.add('hidden');
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

  // Footer links
  openFullSearch.addEventListener('click', (e) => {
    e.preventDefault();
    // Will be updated when frontend is deployed
    chrome.storage.sync.get(['frontendUrl'], (result) => {
      const url = result.frontendUrl || 'http://localhost:3002';
      chrome.tabs.create({ url });
    });
  });

  openSettings.addEventListener('click', (e) => {
    e.preventDefault();
    // Simple settings via prompt for now
    const currentUrl = localStorage.getItem('apiUrl') || 'http://localhost:3001/api';
    const newUrl = prompt('API URL:', currentUrl);
    if (newUrl) {
      chrome.storage.sync.set({ apiUrl: newUrl });
      alert('API URL updated. Reload extension to apply.');
    }
  });
});
