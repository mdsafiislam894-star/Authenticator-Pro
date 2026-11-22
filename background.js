// Authenticator Pro - Background Service Worker (Manifest V3)
// Handles context menus, active tab detection, 2FA autofill, standalone window launch,
// and external Web Auth Bridge messages for zero-config Google Sync.

chrome.runtime.onInstalled.addListener(() => {
  // Create right-click context menu options
  try {
    chrome.contextMenus.create({
      id: 'authpro-root',
      title: '🛡️ Authenticator Pro',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'authpro-fill',
      parentId: 'authpro-root',
      title: '⚡ বর্তমান সাইটের 2FA কোড পেস্ট করুন',
      contexts: ['editable', 'page']
    });

    chrome.contextMenus.create({
      id: 'authpro-open-window',
      parentId: 'authpro-root',
      title: '🪟 ফ্লোটিং উইন্ডোতে Authenticator খুলুন',
      contexts: ['all']
    });
  } catch (err) {
    console.warn('Context menu creation warning:', err);
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'authpro-open-window') {
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html?mode=window'),
      type: 'popup',
      width: 400,
      height: 640
    });
    return;
  }

  if (info.menuItemId === 'authpro-fill' && tab?.id) {
    try {
      // Execute paste script into active tab
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          try {
            const clipText = await navigator.clipboard.readText();
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
              activeEl.value = clipText;
              activeEl.dispatchEvent(new Event('input', { bubbles: true }));
              activeEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
          } catch (e) {
            console.warn('Autofill warning:', e);
          }
        }
      });
    } catch (e) {
      console.warn('Script execution error:', e);
    }
  }
});

// Handle External Messages from authorized Web App (Web Auth Bridge)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message?.type === 'AUTH_BRIDGE_SUCCESS' && message?.session) {
    chrome.storage.local.set({ 'authpro.google.v1': message.session }, () => {
      sendResponse({ success: true, message: 'Extension session saved successfully' });
    });
    return true; // Keep message channel open for async response
  }

  if (message?.type === 'PING') {
    sendResponse({ ok: true, version: '3.0.0' });
    return false;
  }
});
