// Tab Vault - Background Service Worker

// Configuration - Update this after deploying backend
const API_URL = 'http://localhost:3001/api';

// Listen for keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-tab') {
    await captureCurrentTab();
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'capture') {
    captureCurrentTab().then(sendResponse);
    return true; // Keep channel open for async response
  }
  if (request.action === 'search') {
    searchCaptures(request.query).then(sendResponse);
    return true;
  }
  if (request.action === 'getRecent') {
    getRecentCaptures().then(sendResponse);
    return true;
  }
});

// Capture the current tab
async function captureCurrentTab() {
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      return { success: false, error: 'No active tab found' };
    }

    // Get selected text if any
    let selectedText = '';
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString()
      });
      selectedText = result?.result || '';
    } catch (e) {
      // Some pages don't allow script injection (chrome://, etc.)
      console.log('Could not get selected text:', e.message);
    }

    // Send to backend
    const response = await fetch(`${API_URL}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: tab.url,
        title: tab.title,
        selectedText: selectedText,
        favIconUrl: tab.favIconUrl
      })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();

    // Show notification
    showNotification('Captured!', data.summary || 'Saved to Tab Vault');

    return { success: true, data };
  } catch (error) {
    console.error('Capture failed:', error);
    showNotification('Capture failed', error.message);
    return { success: false, error: error.message };
  }
}

// Search captures
async function searchCaptures(query) {
  try {
    const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Search failed:', error);
    return { success: false, error: error.message, results: [] };
  }
}

// Get recent captures
async function getRecentCaptures() {
  try {
    const response = await fetch(`${API_URL}/recent`);
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to get recent:', error);
    return { success: false, error: error.message, results: [] };
  }
}

// Show browser notification
function showNotification(title, message) {
  // Use chrome.notifications if you want system notifications
  // For now, we'll rely on the popup UI feedback
  console.log(`[Tab Vault] ${title}: ${message}`);
}

// Update API URL from storage (for when backend is deployed)
chrome.storage.sync.get(['apiUrl'], (result) => {
  if (result.apiUrl) {
    // Note: Can't reassign const, would need different pattern for production
    console.log('Custom API URL configured:', result.apiUrl);
  }
});
