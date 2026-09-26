// HuskyNote Extension Standalone Workspace Controller
// Enables full HuskyNote features (Notes, Meetings, Ollama AI, Screen Capture, Docs) without opening the main app.

document.addEventListener('DOMContentLoaded', () => {
  // Safe Storage wrapper (chrome.storage.local with localStorage fallback)
  const storage = {
    get: (keys, cb) => {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(keys, cb);
      } else {
        const res = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach(k => {
          const val = localStorage.getItem('huskynote_' + k);
          if (val) {
            try { res[k] = JSON.parse(val); } catch { res[k] = val; }
          }
        });
        cb(res);
      }
    },
    set: (items, cb) => {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set(items, cb);
      } else {
        Object.entries(items).forEach(([k, v]) => {
          localStorage.setItem('huskynote_' + k, JSON.stringify(v));
        });
        if (cb) cb();
      }
    },
    clear: (cb) => {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.clear(cb);
      } else {
        localStorage.clear();
        if (cb) cb();
      }
    }
  };

  // Toast Notification
  const showToast = (msg, duration = 2500) => {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, duration);
  };

  // --- TAB NAVIGATION ---
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(`tab-${tabId}`);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Launch Full Desktop / Web Workspace
  document.getElementById('open-full-app-btn')?.addEventListener('click', () => {
    const url = 'http://localhost:5173';
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  });

  // --- 1. NOTES MODULE ---
  let notes = [];
  let currentNoteId = null;

  const notesListEl = document.getElementById('notes-list');
  const noteTitleEl = document.getElementById('note-title');
  const noteContentEl = document.getElementById('note-content');
  const noteWordCountEl = document.getElementById('note-word-count');
  const noteSearchEl = document.getElementById('note-search');

  const updateWordCount = (text) => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    if (noteWordCountEl) noteWordCountEl.textContent = `${words} words`;
  };

  const renderNotesList = (filter = '') => {
    if (!notesListEl) return;
    notesListEl.innerHTML = '';

    const filtered = notes.filter(n =>
      (n.title || '').toLowerCase().includes(filter.toLowerCase()) ||
      (n.content || '').toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
      notesListEl.innerHTML = '<div style="font-size: 10px; color: #71717a; padding: 8px;">No notes found</div>';
      return;
    }

    filtered.forEach(note => {
      const item = document.createElement('div');
      item.className = `note-item ${note.id === currentNoteId ? 'active' : ''}`;
      item.innerHTML = `
        <div class="note-title">${note.title || 'Untitled Note'}</div>
        <div class="note-meta">${new Date(note.updatedAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      `;
      item.addEventListener('click', () => selectNote(note.id));
      notesListEl.appendChild(item);
    });

    const statEl = document.getElementById('stat-notes-count');
    if (statEl) statEl.textContent = notes.length.toString();
  };

  const selectNote = (id) => {
    currentNoteId = id;
    const note = notes.find(n => n.id === id);
    if (!note) return;

    if (noteTitleEl) noteTitleEl.value = note.title || '';
    if (noteContentEl) noteContentEl.value = note.content || '';
    updateWordCount(note.content || '');
    renderNotesList(noteSearchEl?.value || '');
  };

  const saveCurrentNote = () => {
    if (!currentNoteId) return;
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;

    note.title = noteTitleEl?.value || 'Untitled Note';
    note.content = noteContentEl?.value || '';
    note.updatedAt = Date.now();

    storage.set({ notes }, () => {
      renderNotesList(noteSearchEl?.value || '');
    });
  };

  const createNewNote = (initialTitle = 'New Note', initialContent = '') => {
    const newNote = {
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      title: initialTitle,
      content: initialContent,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    notes.unshift(newNote);
    currentNoteId = newNote.id;
    storage.set({ notes }, () => {
      selectNote(newNote.id);
      showToast('New note created');
    });
  };

  document.getElementById('btn-new-note')?.addEventListener('click', () => createNewNote());

  noteTitleEl?.addEventListener('input', () => {
    saveCurrentNote();
  });

  noteContentEl?.addEventListener('input', () => {
    updateWordCount(noteContentEl.value);
    saveCurrentNote();
  });

  noteSearchEl?.addEventListener('input', (e) => {
    renderNotesList(e.target.value);
  });

  document.getElementById('btn-copy-note')?.addEventListener('click', () => {
    if (!noteContentEl) return;
    navigator.clipboard.writeText(noteContentEl.value);
    showToast('Markdown copied to clipboard!');
  });

  document.getElementById('btn-delete-note')?.addEventListener('click', () => {
    if (!currentNoteId) return;
    notes = notes.filter(n => n.id !== currentNoteId);
    currentNoteId = notes.length > 0 ? notes[0].id : null;
    storage.set({ notes }, () => {
      if (currentNoteId) {
        selectNote(currentNoteId);
      } else {
        if (noteTitleEl) noteTitleEl.value = '';
        if (noteContentEl) noteContentEl.value = '';
        updateWordCount('');
        renderNotesList();
      }
      showToast('Note deleted');
    });
  });

  // Load notes initially
  storage.get(['notes'], (res) => {
    notes = res.notes || [];
    if (notes.length === 0) {
      createNewNote('Welcome to HuskyNote', '# HuskyNote AI Secretary\n\nYour notes, voice transcripts, and summaries are saved completely offline in local storage.\n\n- Powered by local Ollama AI\n- Real-time dictation\n- Tab screen capture');
    } else {
      selectNote(notes[0].id);
    }
  });

  // --- 2. OLLAMA HEALTH & MODEL SYNC ---
  const aiStatusDot = document.getElementById('ai-status-dot');
  const aiStatusText = document.getElementById('ai-status-text');
  const modelSelectEl = document.getElementById('model-select');

  const checkOllamaHealth = async () => {
    try {
      const res = await fetch('http://localhost:11434/api/tags', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        if (aiStatusDot) aiStatusDot.className = 'status-dot online';
        if (aiStatusText) aiStatusText.textContent = 'AI: Online';

        if (modelSelectEl && Array.isArray(data.models) && data.models.length > 0) {
          const currentVal = modelSelectEl.value;
          modelSelectEl.innerHTML = '';
          data.models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = m.name;
            modelSelectEl.appendChild(opt);
          });
          if (data.models.some(m => m.name === currentVal)) {
            modelSelectEl.value = currentVal;
          }
        }
        return true;
      }
    } catch {
      // Offline fallback
    }
    if (aiStatusDot) aiStatusDot.className = 'status-dot';
    if (aiStatusText) aiStatusText.textContent = 'AI: Offline';
    return false;
  };

  checkOllamaHealth();
  setInterval(checkOllamaHealth, 10000);

  // --- 3. MEETINGS & VOICE DICTATION MODULE ---
  let isRecording = false;
  let recordStartTime = 0;
  let recordTimerInterval = null;
  let mediaStream = null;
  let audioCtx = null;
  let analyser = null;
  let animId = null;
  let recognition = null;

  const recordBtn = document.getElementById('btn-record-toggle');
  const recordTimerEl = document.getElementById('record-timer');
  const transcriptEl = document.getElementById('meeting-transcript');
  const audioCanvas = document.getElementById('audio-canvas');
  const canvasCtx = audioCanvas?.getContext('2d');

  const drawWaveform = () => {
    if (!analyser || !canvasCtx || !audioCanvas) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = '#09090b';
    canvasCtx.fillRect(0, 0, audioCanvas.width, audioCanvas.height);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#10b981';
    canvasCtx.beginPath();

    const sliceWidth = audioCanvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * audioCanvas.height) / 2;

      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);

      x += sliceWidth;
    }

    canvasCtx.lineTo(audioCanvas.width, audioCanvas.height / 2);
    canvasCtx.stroke();

    animId = requestAnimationFrame(drawWaveform);
  };

  const startRecording = async () => {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(mediaStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      if (audioCanvas) {
        audioCanvas.width = audioCanvas.clientWidth || 300;
        audioCanvas.height = audioCanvas.clientHeight || 48;
      }
      drawWaveform();

      // Speech Recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || 'en-US';

        recognition.onresult = (event) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript + ' ';
          }
          if (transcriptEl) transcriptEl.value = currentTranscript.trim();
        };

        recognition.start();
      }

      isRecording = true;
      recordStartTime = Date.now();
      if (recordBtn) {
        recordBtn.innerHTML = `
          <svg style="width:11px;height:11px;" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
          <span>Stop Recording</span>
        `;
        recordBtn.className = 'btn btn-secondary';
      }

      recordTimerInterval = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - recordStartTime) / 1000);
        const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
        const secs = String(elapsedSec % 60).padStart(2, '0');
        if (recordTimerEl) recordTimerEl.textContent = `${mins}:${secs}`;
      }, 1000);

      showToast('Recording started with live transcript');
    } catch (err) {
      console.warn('Microphone error', err);
      showToast('Microphone access denied or unavailable');
    }
  };

  const stopRecording = () => {
    isRecording = false;
    clearInterval(recordTimerInterval);
    if (recordBtn) {
      recordBtn.innerHTML = `
        <svg style="width:11px;height:11px;" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="7"/></svg>
        <span>Start Recording</span>
      `;
      recordBtn.className = 'btn btn-danger';
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
    if (animId) cancelAnimationFrame(animId);
    if (recognition) {
      recognition.stop();
      recognition = null;
    }

    showToast('Recording stopped. Ready to synthesize.');
  };

  recordBtn?.addEventListener('click', () => {
    if (!isRecording) startRecording();
    else stopRecording();
  });

  // AI Meeting Summary Generator
  document.getElementById('btn-summarize-meeting')?.addEventListener('click', async () => {
    const text = transcriptEl?.value || '';
    if (!text.trim()) {
      showToast('No transcript text available to summarize.');
      return;
    }

    const summaryBox = document.getElementById('meeting-summary-box');
    const summaryText = document.getElementById('meeting-summary-text');
    if (summaryBox) summaryBox.style.display = 'block';
    if (summaryText) summaryText.textContent = 'Synthesizing meeting summary with local Ollama AI...';

    const selectedModel = modelSelectEl?.value || 'llama3.2';

    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: `You are an expert executive AI secretary. Summarize the following meeting transcript into:
1. Executive Overview
2. Key Decisions Made
3. Action Items (with assignees if mentioned)

Transcript:
${text}`,
          stream: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (summaryText) summaryText.textContent = data.response || 'Summary generated successfully.';
        showToast('AI meeting summary complete!');
      } else {
        if (summaryText) summaryText.textContent = 'Local Ollama returned an error. Ensure Ollama is running at localhost:11434.';
      }
    } catch {
      if (summaryText) summaryText.textContent = 'Could not reach Ollama at http://localhost:11434. Check that Ollama daemon is active.';
    }
  });

  // Save Transcript as Note
  document.getElementById('btn-save-as-note')?.addEventListener('click', () => {
    const transcript = transcriptEl?.value || '';
    const summary = document.getElementById('meeting-summary-text')?.textContent || '';
    if (!transcript.trim()) {
      showToast('Nothing to save.');
      return;
    }

    const content = `# Meeting Note - ${new Date().toLocaleDateString()}\n\n## Transcript\n${transcript}\n\n${summary ? '## AI Summary\n' + summary : ''}`;
    createNewNote(`Meeting - ${new Date().toLocaleDateString()}`, content);
    // Switch to notes tab
    document.querySelector('.tab-btn[data-tab="notes"]')?.click();
  });

  // --- 4. LOCAL OLLAMA AI SECRETARY CHAT ---
  const chatWindow = document.getElementById('chat-window');
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('btn-chat-send');

  const appendChatMessage = (role, text) => {
    if (!chatWindow) return;
    const msg = document.createElement('div');
    msg.className = `chat-msg ${role}`;
    msg.textContent = text;
    chatWindow.appendChild(msg);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return msg;
  };

  const sendChatMessage = async (promptText) => {
    const text = promptText || chatInput?.value?.trim();
    if (!text) return;

    if (chatInput) chatInput.value = '';
    appendChatMessage('user', text);

    const assistantMsg = appendChatMessage('assistant', 'Thinking...');
    const selectedModel = modelSelectEl?.value || 'llama3.2';

    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: text,
          stream: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (assistantMsg) assistantMsg.textContent = data.response || 'Completed.';
      } else {
        if (assistantMsg) assistantMsg.textContent = 'Ollama error. Please check your model name and localhost:11434.';
      }
    } catch {
      if (assistantMsg) assistantMsg.textContent = 'Local Ollama is unreachable. Run `ollama serve` in terminal.';
    }
  };

  chatSendBtn?.addEventListener('click', () => sendChatMessage());
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  // Prompt Chips
  document.getElementById('chip-summarize-page')?.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => document.body.innerText.substring(0, 4000),
          }, (results) => {
            const pageText = results?.[0]?.result || '';
            if (pageText) {
              sendChatMessage(`Summarize this webpage content into 3 key bullet points and core takeaway:\n\n${pageText}`);
            } else {
              sendChatMessage('Summarize this page.');
            }
          });
        }
      });
    } else {
      sendChatMessage('Summarize this page.');
    }
  });

  document.getElementById('chip-action-items')?.addEventListener('click', () => {
    sendChatMessage('Extract any action items, deadlines, or deliverables from my recent notes.');
  });

  document.getElementById('chip-polish-text')?.addEventListener('click', () => {
    sendChatMessage('Please polish my writing, correct grammar, and improve conciseness for: ' + (noteContentEl?.value.substring(0, 300) || 'HuskyNote private local secretary'));
  });

  document.getElementById('chip-clear-chat')?.addEventListener('click', () => {
    if (chatWindow) {
      chatWindow.innerHTML = '<div class="chat-msg assistant">Chat cleared. Ask me anything!</div>';
    }
  });

  // --- 5. SCREEN STUDIO & CAPTURE MODULE ---
  const captureBtn = document.getElementById('btn-capture-tab');
  const screenshotCanvas = document.getElementById('screenshot-canvas');
  const capturePlaceholder = document.getElementById('capture-placeholder');
  const coordDisplay = document.getElementById('coord-display');
  let currentScreenshot = null;
  let clickedCoords = null;

  captureBtn?.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.captureVisibleTab) {
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          showToast('Capture error: ' + (chrome.runtime.lastError?.message || 'Check tab permission'));
          return;
        }
        loadScreenshotImage(dataUrl);
      });
    } else {
      // Mock / fallback screenshot for testing
      const mockCanvas = document.createElement('canvas');
      mockCanvas.width = 640;
      mockCanvas.height = 360;
      const mctx = mockCanvas.getContext('2d');
      mctx.fillStyle = '#1e293b';
      mctx.fillRect(0, 0, 640, 360);
      mctx.fillStyle = '#ffffff';
      mctx.font = '20px monospace';
      mctx.fillText('HuskyNote Studio Preview', 40, 180);
      loadScreenshotImage(mockCanvas.toDataURL());
    }
  });

  const loadScreenshotImage = (dataUrl) => {
    const img = new Image();
    img.onload = () => {
      currentScreenshot = img;
      if (capturePlaceholder) capturePlaceholder.style.display = 'none';
      if (screenshotCanvas) {
        screenshotCanvas.width = img.width;
        screenshotCanvas.height = img.height;
        const sctx = screenshotCanvas.getContext('2d');
        sctx.drawImage(img, 0, 0);
      }
      showToast('Tab captured! Click on an element to outline coordinates.');
    };
    img.src = dataUrl;
  };

  screenshotCanvas?.addEventListener('click', (e) => {
    if (!currentScreenshot || !screenshotCanvas) return;
    const rect = screenshotCanvas.getBoundingClientRect();
    const scaleX = screenshotCanvas.width / rect.width;
    const scaleY = screenshotCanvas.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    clickedCoords = { x, y };

    if (coordDisplay) {
      coordDisplay.textContent = `Framed Coordinate: [x: ${x}, y: ${y}]`;
      coordDisplay.style.color = '#10b981';
    }

    // Redraw image and target frame
    const sctx = screenshotCanvas.getContext('2d');
    sctx.drawImage(currentScreenshot, 0, 0);

    // Coordinate Box Target Frame
    const boxW = 80;
    const boxH = 40;
    sctx.strokeStyle = '#ef4444';
    sctx.lineWidth = 3;
    sctx.strokeRect(x - boxW / 2, y - boxH / 2, boxW, boxH);

    // Small center crosshair
    sctx.fillStyle = '#ef4444';
    sctx.fillRect(x - 2, y - 2, 4, 4);

    showToast(`Coordinate captured: [x:${x}, y:${y}]`);
  });

  document.getElementById('btn-export-manual')?.addEventListener('click', () => {
    if (!clickedCoords) {
      showToast('Please click a coordinate on the screenshot first.');
      return;
    }
    const manualContent = `## Standard Operating Procedure Step\n\n- **Target Element Box**: [x: ${clickedCoords.x}, y: ${clickedCoords.y}]\n- **Action**: Click target element to perform workflow step.\n- **Timestamp**: ${new Date().toLocaleTimeString()}\n`;
    createNewNote(`SOP Manual Step - [x:${clickedCoords.x}, y:${clickedCoords.y}]`, manualContent);
    document.querySelector('.tab-btn[data-tab="notes"]')?.click();
  });

  // --- 6. DOCUMENT INTELLIGENCE MODULE ---
  const docInput = document.getElementById('doc-input');
  const docQuestion = document.getElementById('doc-question');
  const askDocBtn = document.getElementById('btn-ask-doc');
  const docAnswerBox = document.getElementById('doc-answer-box');
  const docAnswerText = document.getElementById('doc-answer-text');

  askDocBtn?.addEventListener('click', async () => {
    const docText = docInput?.value?.trim() || '';
    const qText = docQuestion?.value?.trim() || '';

    if (!docText) {
      showToast('Please paste document content first.');
      return;
    }

    if (docAnswerBox) docAnswerBox.style.display = 'block';
    if (docAnswerText) docAnswerText.textContent = 'Analyzing document with local Ollama...';

    const selectedModel = modelSelectEl?.value || 'llama3.2';

    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: `Context Document:\n${docText}\n\nQuestion: ${qText || 'Summarize key points'}\n\nAnswer accurately based only on the document.`,
          stream: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (docAnswerText) docAnswerText.textContent = data.response || 'Analysis complete.';
      } else {
        if (docAnswerText) docAnswerText.textContent = 'Ollama error during document analysis.';
      }
    } catch {
      if (docAnswerText) docAnswerText.textContent = 'Ollama is offline. Start Ollama to run document analysis.';
    }
  });

  // --- 7. SYNC & BACKUP MODULE ---
  document.getElementById('btn-export-backup')?.addEventListener('click', () => {
    storage.get(null, (allData) => {
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `huskynote-extension-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Backup JSON exported successfully!');
    });
  });

  document.getElementById('btn-clear-all')?.addEventListener('click', () => {
    if (confirm('Clear all extension notes and recordings? This cannot be undone.')) {
      storage.clear(() => {
        notes = [];
        currentNoteId = null;
        renderNotesList();
        if (noteTitleEl) noteTitleEl.value = '';
        if (noteContentEl) noteContentEl.value = '';
        showToast('Extension storage cleared.');
      });
    }
  });

  // ─── MEETINGS HUD: Launch on current tab ────────────────────────────────────
  function launchMeetingHUD() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.id) return;
        chrome.tabs.sendMessage(tab.id, { type: 'HUSKY_OPEN_MEETING_HUD' }, (resp) => {
          if (chrome.runtime.lastError) {
            // Content script may not be injected yet — inject it first
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js'],
            }).then(() => {
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { type: 'HUSKY_OPEN_MEETING_HUD' });
              }, 600);
            }).catch(() => {
              showToast('Could not inject HUD. Try refreshing the tab.');
            });
          }
        });
        window.close(); // Close popup so HUD is visible
      });
    }
  }

  document.getElementById('btn-launch-meeting-hud')?.addEventListener('click', launchMeetingHUD);

  // ─── MEETINGS: Load saved meeting documents ──────────────────────────────────
  let savedMeetings = [];
  let viewingMeetingId = null;

  function renderMeetingsList() {
    const listEl = document.getElementById('husky-meetings-list');
    const emptyEl = document.getElementById('husky-meetings-empty');
    if (!listEl) return;

    // Clear existing items (keep empty div)
    listEl.innerHTML = '';

    if (savedMeetings.length === 0) {
      listEl.innerHTML = `<div id="husky-meetings-empty" style="font-size:10px; color:#52525b; text-align:center; padding:16px 0;">
        No saved meetings yet &mdash; launch the HUD above to start recording.
      </div>`;
      return;
    }

    savedMeetings.forEach(meeting => {
      const item = document.createElement('div');
      item.style.cssText = `
        background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 10px 12px;
        cursor: pointer; transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1); display: flex; align-items: center; justify-content: space-between;
        gap: 8px; backdrop-filter: blur(12px);
      `;
      item.onmouseover = () => { item.style.background = 'rgba(255, 255, 255, 0.08)'; item.style.borderColor = 'rgba(255, 255, 255, 0.16)'; };
      item.onmouseout = () => { item.style.background = 'rgba(255, 255, 255, 0.04)'; item.style.borderColor = 'rgba(255, 255, 255, 0.08)'; };

      const participants = (meeting.participants || []).slice(0, 3).join(', ') || 'Unknown speakers';
      const date = new Date(meeting.date || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const duration = meeting.durationSeconds ? Math.floor(meeting.durationSeconds / 60) + 'm' : '?';
      const segCount = (meeting.transcript || []).length;

      item.innerHTML = `
        <div style="flex:1; overflow:hidden;">
          <div style="font-size:11.5px; font-weight:600; color:#f4f4f5; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; letter-spacing:-0.01em;">${meeting.title || 'Meeting'}</div>
          <div style="font-size:9.5px; color:#a1a1aa; margin-top:3px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <span style="display:inline-flex; align-items:center; gap:3px;">
              <svg style="width:10px;height:10px;opacity:0.75;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${date}
            </span>
            <span style="display:inline-flex; align-items:center; gap:3px;">
              <svg style="width:10px;height:10px;opacity:0.75;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${duration}
            </span>
            <span style="display:inline-flex; align-items:center; gap:3px;">
              <svg style="width:10px;height:10px;opacity:0.75;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ${segCount} segs
            </span>
          </div>
          <div style="font-size:9.5px; color:#71717a; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:inline-flex; align-items:center; gap:3px;">
            <svg style="width:10px;height:10px;opacity:0.75;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            ${participants}
          </div>
        </div>
        <div style="color:#71717a; flex-shrink:0; display:flex; align-items:center;">
          <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      `;

      item.addEventListener('click', () => viewMeeting(meeting));
      listEl.appendChild(item);
    });
  }

  function viewMeeting(meeting) {
    viewingMeetingId = meeting.id;
    const viewer = document.getElementById('husky-meeting-doc-viewer');
    const titleEl = document.getElementById('husky-meeting-doc-title');
    const contentEl = document.getElementById('husky-meeting-doc-content');
    if (!viewer || !titleEl || !contentEl) return;

    titleEl.textContent = meeting.title || 'Meeting Document';
    contentEl.textContent = meeting.document || buildFallbackText(meeting);
    viewer.style.display = 'flex';
  }

  function buildFallbackText(meeting) {
    const participants = (meeting.participants || []).join(', ') || 'Unknown';
    const transcript = (meeting.transcript || [])
      .map(s => `[${s.speaker}] ${s.text}`)
      .join('\n');
    return `MEETING DOCUMENT\nParticipants: ${participants}\n\nTRANSCRIPT:\n${transcript || '(none)'}`;
  }

  function loadSavedMeetings() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['husky_meetings'], (res) => {
        savedMeetings = res.husky_meetings || [];
        renderMeetingsList();
      });
    } else {
      renderMeetingsList();
    }
  }

  // Copy meeting doc
  document.getElementById('btn-copy-meeting-doc')?.addEventListener('click', () => {
    const content = document.getElementById('husky-meeting-doc-content')?.textContent || '';
    navigator.clipboard.writeText(content).then(() => showToast('Meeting document copied!'));
  });

  // Close viewer
  document.getElementById('btn-close-meeting-doc')?.addEventListener('click', () => {
    const viewer = document.getElementById('husky-meeting-doc-viewer');
    if (viewer) viewer.style.display = 'none';
  });

  // Refresh button
  document.getElementById('btn-refresh-meetings')?.addEventListener('click', loadSavedMeetings);

  // Load meetings when tab is shown
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === 'meetings') {
      btn.addEventListener('click', loadSavedMeetings);
    }
  });

  // Initial load if meetings tab is active
  if (document.querySelector('.tab-btn.active')?.getAttribute('data-tab') === 'meetings') {
    loadSavedMeetings();
  }
});
