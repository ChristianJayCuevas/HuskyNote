// HuskyNote Extension Background Service Worker (Manifest V3)
// Handles: context menus, side-panel, tab capture relay, message routing

// Copy meetings saved by pre-rebrand DomoNote builds (domo_* keys) to husky_* keys
function migrateLegacyStorage() {
  const legacyKeys = { domo_meetings: 'husky_meetings', domo_live_meeting_roster: 'husky_live_meeting_roster' };
  chrome.storage.local.get([...Object.keys(legacyKeys), ...Object.values(legacyKeys)], (res) => {
    const updates = {};
    for (const [legacyKey, newKey] of Object.entries(legacyKeys)) {
      if (res[legacyKey] !== undefined && res[newKey] === undefined) updates[newKey] = res[legacyKey];
    }
    if (Object.keys(updates).length > 0) chrome.storage.local.set(updates);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[HuskyNote] Extension v2.0 installed and ready.');
  migrateLegacyStorage();
  enableSidePanelOnAction();

  // Auto-inject content script into already open meeting tabs so sync starts immediately
  if (chrome.tabs?.query && chrome.scripting?.executeScript) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (
          tab.id &&
          tab.url &&
          (tab.url.includes('meet.google.com') ||
            tab.url.includes('teams.microsoft.com') ||
            tab.url.includes('zoom.us') ||
            tab.url.includes('127.0.0.1'))
        ) {
          chrome.scripting
            .executeScript({
              target: { tabId: tab.id },
              files: ['content.js'],
            })
            .catch(() => {});
        }
      });
    });
  }

  if (chrome.contextMenus) {
    // Menus survive updates; clear them so re-creating does not fail on duplicate ids
    chrome.contextMenus.removeAll(() => createContextMenus());
  }
});

function createContextMenus() {
  chrome.contextMenus.create({
    id: 'huskynote-collect-teams-transcript',
    title: 'Collect Teams transcript for HuskyNote',
    contexts: ['page', 'frame', 'selection', 'link'],
  });
  chrome.contextMenus.create({
    id: 'huskynote-summarize-selection',
    title: 'Summarize with HuskyNote AI (local)',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'huskynote-add-note',
    title: 'Save to HuskyNote Quick Notes',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'huskynote-start-meeting',
    title: 'Start HuskyNote Meeting Recording',
    contexts: ['page'],
  });
}

/**
 * Collect the Teams transcript open in a tab. The crawler runs in every frame
 * because Teams often shows the transcript inside an embedded frame; frames
 * without a transcript return straight away.
 */
async function collectTeamsTranscript(tabId) {
  if (!chrome.scripting?.executeScript) return { found: false };
  let results = [];
  try {
    results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['teams-transcript-crawler.js'] });
  } catch (error) {
    console.warn('[HuskyNote] Could not run the transcript collector:', error);
  }
  const found = results.some((r) => r?.result?.found);
  if (!found) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const id = 'huskynote-transcript-collector';
        document.getElementById(id)?.remove();
        const box = document.createElement('div');
        box.id = id;
        box.setAttribute('role', 'status');
        box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;width:300px;padding:12px 14px;border-radius:10px;background:#202020;color:#e3e2e0;'
          + 'font:13px/1.45 "Segoe UI",system-ui,sans-serif;box-shadow:0 0 0 1px rgba(255,255,255,.08),0 9px 24px rgba(0,0,0,.45);';
        box.textContent = 'HuskyNote could not find an open transcript on this page. Open the meeting in Teams, go to Recap › Transcript so the lines show, then try again.';
        document.body.appendChild(box);
        setTimeout(() => box.remove(), 9000);
      },
    }).catch(() => {});
  }
  return { found };
}

if (chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'HUSKYNOTE_COLLECT_TEAMS_TRANSCRIPT' && msg.tabId) {
      collectTeamsTranscript(msg.tabId).then(sendResponse);
      return true;
    }
    return undefined;
  });
}

// Ensure newly opened or navigated meeting tabs have content script injected
if (chrome.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (
      changeInfo.status === 'complete' &&
      tab.url &&
      (tab.url.includes('meet.google.com') ||
        tab.url.includes('teams.microsoft.com') ||
        tab.url.includes('zoom.us') ||
        tab.url.includes('127.0.0.1'))
    ) {
      if (chrome.scripting?.executeScript) {
        chrome.scripting
          .executeScript({
            target: { tabId },
            files: ['content.js'],
          })
          .catch(() => {});
      }
    }
  });
}

// Context menu actions
if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'huskynote-add-note' && info.selectionText) {
      chrome.storage.local.get(['notes'], (res) => {
        const notes = res.notes || [];
        notes.unshift({
          id: 'note_' + Date.now(),
          title: info.selectionText.slice(0, 40) + '...',
          content: info.selectionText,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        chrome.storage.local.set({ notes });
      });
    }

    if (info.menuItemId === 'huskynote-collect-teams-transcript' && tab?.id) {
      collectTeamsTranscript(tab.id);
    }

    if (info.menuItemId === 'huskynote-start-meeting' && tab?.id) {
      // Inject meeting HUD into the active tab
      chrome.tabs.sendMessage(tab.id, { type: 'HUSKY_OPEN_MEETING_HUD' });
    }
  });
}

// Side panel behavior: Open side panel docked on the right when the extension action icon is clicked
function enableSidePanelOnAction() {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
}
enableSidePanelOnAction();

if (chrome.action?.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    try {
      if (chrome.sidePanel?.open && tab?.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } catch (e) {
      console.warn('[HuskyNote] Side panel open triggered:', e);
    }
  });
}

// Message routing
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Status check
  if (request.type === 'HUSKYNOTE_CHECK_STATUS') {
    sendResponse({ status: 'active', version: '2.0.0' });
    return true;
  }

  // Relay: open meeting HUD on specified tab (or current tab)
  if (request.type === 'HUSKY_OPEN_MEETING_HUD') {
    const targetTabId = request.tabId;
    if (targetTabId) {
      chrome.tabs.sendMessage(targetTabId, { type: 'HUSKY_OPEN_MEETING_HUD' });
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'HUSKY_OPEN_MEETING_HUD' });
        }
      });
    }
    sendResponse({ ok: true });
    return true;
  }

  // Retrieve saved meetings
  if (request.type === 'HUSKY_GET_MEETINGS') {
    chrome.storage.local.get(['husky_meetings'], (res) => {
      sendResponse({ meetings: res.husky_meetings || [] });
    });
    return true; // async
  }

  // Save meeting from content script (backup path)
  if (request.type === 'HUSKY_SAVE_MEETING') {
    chrome.storage.local.get(['husky_meetings'], (res) => {
      const meetings = res.husky_meetings || [];
      meetings.unshift(request.data);
      chrome.storage.local.set({ husky_meetings: meetings.slice(0, 50) });
      sendResponse({ ok: true });
    });
    return true;
  }

  // Relay live meeting roster / active speaker across tabs
  if (request.type === 'HUSKY_MEETING_SYNC') {
    chrome.storage.local.set({ husky_live_meeting_roster: request.data });
    // Broadcast to all tabs so HuskyNote web app receives it
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id && tab.id !== sender?.tab?.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'HUSKYNOTE_MEETING_PARTICIPANTS',
            ...request.data,
          }).catch(() => {});
        }
      });
    });
    sendResponse({ ok: true });
    return true;
  }

  // Get current live meeting roster
  if (request.type === 'HUSKY_GET_LIVE_MEETING') {
    chrome.storage.local.get(['husky_live_meeting_roster'], (res) => {
      sendResponse({ roster: res.husky_live_meeting_roster || null });
    });
    return true;
  }
});
