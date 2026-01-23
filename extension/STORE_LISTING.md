# Chrome Web Store Listing - Tab Vault

Use this document when submitting Tab Vault to the Chrome Web Store.

---

## Basic Information

### Extension Name
```
Tab Vault
```

### Summary (132 characters max)
```
Capture web pages to your personal knowledge base with AI summarization, smart categorization, and semantic search.
```

### Description (up to 16,000 characters)
```
Tab Vault transforms your browser into a personal knowledge capture system. Save any web page with one click or keyboard shortcut, and let AI do the heavy lifting.

KEY FEATURES

Instant Capture
Press Ctrl+Shift+S (Cmd+Shift+S on Mac) or click the extension icon to capture any page. Tab Vault automatically extracts the content and sends it to your personal backend for processing.

AI-Powered Organization
Each captured page is automatically:
• Summarized into a concise description
• Categorized into topics you define
• Tagged with relevant keywords
• Indexed for semantic search

Smart Search
Find captured pages using natural language. Search for concepts, not just keywords. Looking for "articles about productivity"? Tab Vault understands what you mean.

Your Data, Your Control
Tab Vault connects to your own backend server. Your captures are stored in your database, processed by AI services you configure. Self-host or use the provided Railway deployment.

PERFECT FOR

• Researchers collecting references
• Developers bookmarking documentation
• Students organizing study materials
• Anyone who wants to remember what they've read online

PRIVACY FOCUSED

Tab Vault only captures pages when you explicitly click the capture button. No background tracking, no browsing history collection, no personal data harvesting.

OPEN SOURCE

Tab Vault is fully open source. Review the code, self-host the backend, or contribute improvements.

GitHub: https://github.com/proto-git/tab-vault
```

### Category
```
Productivity
```

### Language
```
English
```

---

## Visual Assets

### Extension Icon
Already included in `/extension/icons/`:
- icon16.png (16x16) ✓
- icon32.png (32x32) - NEEDS CREATION
- icon48.png (48x48) ✓
- icon128.png (128x128) ✓

**To create icon32.png:**
Use any image editor to resize icon.svg or icon128.png to 32x32 pixels.
Online tool: https://www.iloveimg.com/resize-image

### Screenshots (1280x800 or 640x400 recommended)
You'll need to create 1-5 screenshots showing:

1. **Main popup** - Show the capture button and recent captures
2. **Search results** - Show semantic search finding relevant pages
3. **Settings view** - Show AI model selection and usage stats
4. **Category management** - Show custom categories
5. **Dashboard** (optional) - Show the full web dashboard if you have one

**Screenshot tips:**
- Use a clean browser profile
- Have some example captures already saved
- Show the extension in action with real content

### Promotional Images (optional but recommended)

| Size | Purpose |
|------|---------|
| 440x280 | Small promotional tile |
| 920x680 | Large promotional tile |
| 1400x560 | Marquee (featured placement) |

---

## Privacy & Permissions

### Single Purpose Description
```
Tab Vault captures web pages and organizes them using AI-powered summarization and semantic search.
```

### Permission Justifications

| Permission | Justification |
|------------|---------------|
| `activeTab` | Required to capture the URL, title, and selected text of the current tab when the user clicks the capture button. |
| `storage` | Required to store user preferences such as the backend API URL. |
| `host_permissions: <all_urls>` | Required to capture content from any website the user visits. Tab Vault only accesses pages when the user explicitly triggers a capture. |

### Privacy Policy URL
```
https://github.com/proto-git/tab-vault/blob/master/extension/PRIVACY_POLICY.md
```

(You can also host this on a simple website or GitHub Pages)

### Data Usage Declarations

When Chrome Web Store asks about data collection, declare:

**Data collected:**
- Website content (URLs, titles) - for capture functionality
- User activity (captured pages) - stored on user's backend

**Data NOT collected:**
- Personally identifiable information
- Financial and payment information
- Health information
- Authentication information
- Personal communications
- Location data
- Web history (only explicitly captured pages)

---

## Submission Checklist

### Before Submitting

- [ ] Create a Chrome Web Store Developer account ($5 one-time fee)
      https://chrome.google.com/webstore/devconsole

- [ ] Create icon32.png (32x32 pixels)

- [ ] Take 1-5 screenshots (1280x800 recommended)

- [ ] Host privacy policy at a public URL

- [ ] Test the extension one more time

### Create the ZIP File

```bash
cd extension
zip -r ../tab-vault-extension.zip . -x "*.md" -x ".git/*"
```

Or manually:
1. Select all files in the `extension/` folder (excluding .md files)
2. Right-click → Send to → Compressed (zipped) folder
3. Name it `tab-vault-extension.zip`

### Submit to Chrome Web Store

1. Go to https://chrome.google.com/webstore/devconsole
2. Click "New Item"
3. Upload `tab-vault-extension.zip`
4. Fill in all fields using information from this document
5. Upload screenshots
6. Submit for review

### After Submission

- Review typically takes 1-3 business days (can be longer)
- You'll receive an email when approved or if changes are needed
- Once approved, you can share the direct link with family/coworkers

---

## Listing Visibility Options

### Unlisted (Recommended for sharing with family/coworkers)
- Not searchable in the store
- Anyone with the direct link can install
- Good for testing before going public

### Public
- Searchable by anyone
- More visibility = more users
- Requires polished screenshots and description

You can start as Unlisted and switch to Public later.

---

## Post-Submission Updates

To update the extension after it's published:

1. Increment `version` in `manifest.json` (e.g., "1.0.0" → "1.0.1")
2. Create a new ZIP file
3. Go to Developer Dashboard → Tab Vault → Package → Upload new package
4. Submit for review

Updates also require review but are typically faster.
