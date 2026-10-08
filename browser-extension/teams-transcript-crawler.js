// HuskyNote: collect the Teams meeting transcript that is open on this page.
//
// Injected on request (right-click menu or the side panel) into every frame of
// the tab. Teams only keeps the transcript lines on screen loaded, so this
// scrolls the transcript list from top to bottom and reads each entry (speaker,
// time, words) as it appears. It only reads text Teams already shows you.
// The result is saved for the HuskyNote app and can also be copied or
// downloaded as a .vtt file.
(() => {
  const TIME = /^\d{1,2}:\d{2}(?::\d{2})?$/;
  const INITIALS = /^[A-Z]{1,3}$/;
  // The time Teams reads out for screen readers ("5 minutes 36 seconds"); never a speaker name
  const SPOKEN_TIME = /^(?=.*\d)(?:\d+ hours? ?)?(?:\d+ minutes? ?)?(?:\d+ seconds?)?$/i;
  const PANEL_ID = 'huskynote-transcript-collector';
  const STORAGE_KEY = 'husky_teams_transcript';

  if (window.__huskynoteCollector?.running) return { found: true, running: true };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const toSeconds = (value) => value.split(':').map(Number).reduce((total, part) => total * 60 + part, 0);

  /** Elements whose own text is a timestamp like 0:03 or 1:02:05 */
  const timeElements = (root) => {
    const found = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent.trim();
      if (TIME.test(text) && walker.currentNode.parentElement) found.push(walker.currentNode.parentElement);
    }
    return found;
  };

  const isScrollable = (el) => {
    const style = getComputedStyle(el);
    return /(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 20;
  };

  /** The scrolling list that holds the most timestamps (the transcript) */
  const findTranscriptList = () => {
    const counts = new Map();
    for (const el of timeElements(document.body)) {
      for (let parent = el.parentElement; parent && parent !== document.documentElement; parent = parent.parentElement) {
        if (isScrollable(parent)) { counts.set(parent, (counts.get(parent) || 0) + 1); break; }
      }
    }
    let best = null;
    let bestScore = 0;
    for (const [el, count] of counts) {
      const label = `${el.getAttribute('aria-label') || ''} ${el.id || ''} ${el.className || ''}`.toLowerCase();
      const score = count * (label.includes('transcript') ? 3 : 1);
      if (score > bestScore) { best = el; bestScore = score; }
    }
    return best && (counts.get(best) || 0) >= 2 ? best : null;
  };

  /** Read the entries currently rendered in the list */
  const readEntries = (list) => {
    const entries = [];
    let lastSpeaker = '';
    for (const timeEl of timeElements(list)) {
      // The entry is the largest ancestor that still holds only this one timestamp
      let entry = timeEl;
      while (entry.parentElement && entry.parentElement !== list && timeElements(entry.parentElement).length === 1) entry = entry.parentElement;
      const lines = entry.innerText.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const timeText = timeEl.textContent.trim();
      const at = lines.indexOf(timeText);
      if (at < 0) continue;
      const before = lines.slice(0, at).filter((line) => !INITIALS.test(line) && !SPOKEN_TIME.test(line));
      let speaker = before[before.length - 1] || '';
      let words = lines.slice(at + 1).filter((line) => !SPOKEN_TIME.test(line));
      // Some layouts put the time first and the name after it
      if (!speaker && words.length > 1 && words[0].length <= 60 && !/[.!?,]$/.test(words[0])) { speaker = words[0]; words = words.slice(1); }
      speaker = speaker || lastSpeaker || 'Speaker';
      lastSpeaker = speaker;
      let text = words.join(' ').trim();
      // A screen-reader label ("Ana Cruz 5 minutes 36 seconds") read along with the words
      const label = text.toLowerCase().startsWith(`${speaker.toLowerCase()} `) && text.slice(speaker.length).match(/^\s+(?:\d+\s+(?:hours?|minutes?|seconds?)(?:\s+|$)){1,3}/i);
      if (label) text = text.slice(speaker.length + label[0].length);
      if (text) entries.push({ t: toSeconds(timeText), speaker, text });
    }
    return entries;
  };

  const list = findTranscriptList();
  if (!list) return { found: false };

  // ── Panel shown on the Teams page while collecting ───────────────────────
  const panel = (() => {
    document.getElementById(PANEL_ID)?.remove();
    const box = document.createElement('div');
    box.id = PANEL_ID;
    box.setAttribute('role', 'status');
    box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;width:300px;padding:12px 14px;border-radius:10px;'
      + 'background:#202020;color:#e3e2e0;font:13px/1.45 "Segoe UI",system-ui,sans-serif;box-shadow:0 0 0 1px rgba(255,255,255,.08),0 9px 24px rgba(0,0,0,.45);';
    const title = document.createElement('div');
    title.textContent = 'HuskyNote';
    title.style.cssText = 'font-weight:600;margin-bottom:4px;';
    const message = document.createElement('div');
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;';
    box.append(title, message, buttons);
    document.body.appendChild(box);
    const button = (label, onClick, primary) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = `padding:4px 10px;border-radius:6px;border:1px solid ${primary ? '#e3e2e0' : '#3a3a3a'};background:${primary ? '#e3e2e0' : 'transparent'};`
        + `color:${primary ? '#191919' : '#e3e2e0'};font:inherit;font-size:12px;cursor:pointer;`;
      b.addEventListener('click', onClick);
      buttons.appendChild(b);
      return b;
    };
    return {
      say(text) { message.textContent = text; },
      clearButtons() { buttons.replaceChildren(); },
      button,
      close() { box.remove(); },
    };
  })();

  const state = { running: true, stopped: false };
  window.__huskynoteCollector = state;
  panel.say('Collecting the transcript… keep this tab open.');
  panel.button('Stop', () => { state.stopped = true; });

  const clock = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
  };
  const vttTime = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}.000`;
  const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  (async () => {
    const byKey = new Map();
    const collect = () => {
      for (const entry of readEntries(list)) {
        const key = `${entry.speaker}|${entry.t}`;
        const previous = byKey.get(key);
        if (!previous || entry.text.length > previous.text.length) byKey.set(key, entry);
      }
    };

    const startPosition = list.scrollTop;
    list.scrollTop = 0;
    await wait(700);
    collect();
    let atBottomChecks = 0;
    for (let step = 0; step < 5000 && !state.stopped; step++) {
      const before = list.scrollTop;
      list.scrollTop = before + Math.max(80, Math.floor(list.clientHeight * 0.6));
      await wait(350);
      collect();
      panel.say(`Collecting the transcript… ${byKey.size} lines so far. Keep this tab open.`);
      if (list.scrollTop <= before + 1) {
        // At the bottom: give a lazily loading list a moment to add more
        await wait(1200);
        collect();
        if (list.scrollHeight - list.clientHeight - list.scrollTop > 5) { atBottomChecks = 0; continue; }
        if (++atBottomChecks >= 2) break;
      } else {
        atBottomChecks = 0;
      }
    }
    list.scrollTop = startPosition;

    // A line read once without its speaker's name is dropped when a named copy exists
    const named = new Set([...byKey.values()].filter((e) => e.speaker !== 'Speaker').map((e) => e.t));
    const lines = [...byKey.values()]
      .filter((e) => e.speaker !== 'Speaker' || !named.has(e.t))
      .sort((a, b) => a.t - b.t);

    state.running = false;
    panel.clearButtons();
    if (!lines.length) {
      panel.say('No transcript lines could be read here. Open the meeting transcript and try again.');
      panel.button('Close', () => panel.close());
      return;
    }

    const vtt = ['WEBVTT', '', ...lines.map((e, i) => {
      const end = Math.max(e.t + 1, lines[i + 1] ? lines[i + 1].t : e.t + 5);
      return `${vttTime(e.t)} --> ${vttTime(end)}\n<v ${escape(e.speaker)}>${escape(e.text)}</v>\n`;
    })].join('\n');
    const speakers = [...new Set(lines.map((e) => e.speaker))];
    const summary = `${lines.length} lines from ${speakers.length} ${speakers.length === 1 ? 'speaker' : 'speakers'} (${clock(lines[0].t)}–${clock(lines[lines.length - 1].t)})`;

    let saved = false;
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: { vtt, lines: lines.length, speakers, title: document.title || 'Teams meeting', collectedAt: Date.now(), partial: state.stopped } });
      saved = true;
    } catch { /* copy and download below still work */ }

    panel.say(`${state.stopped ? 'Stopped. Collected' : 'Collected'} ${summary}.`
      + (saved ? ' It is ready in HuskyNote: open the meeting and choose Supplement or Import.' : ''));
    panel.button('Copy', async (event) => {
      const done = (ok) => { event.target.textContent = ok ? 'Copied' : 'Copy failed'; };
      try { await navigator.clipboard.writeText(vtt); done(true); }
      catch {
        const area = document.createElement('textarea');
        area.value = vtt;
        document.body.appendChild(area);
        area.select();
        done(document.execCommand('copy'));
        area.remove();
      }
    }, true);
    panel.button('Download .vtt', () => {
      const url = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(document.title || 'Teams meeting').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80)} transcript.vtt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
    panel.button('Close', () => panel.close());
  })().catch((error) => {
    state.running = false;
    panel.clearButtons();
    panel.say(`Collecting stopped: ${error?.message || error}`);
    panel.button('Close', () => panel.close());
  });

  return { found: true };
})();
