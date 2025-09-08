const form = document.getElementById('params-form');
const resultEl = document.getElementById('result');
const logsEl = document.getElementById('logs');
const usageEl = document.getElementById('usage');
const promptEl = document.getElementById('promptUsed');
const copyResultBtn = document.getElementById('copy-result');
const copyPromptBtn = document.getElementById('copy-prompt');

// Collapsible sections (Home)
function setupCollapsible(secId) {
  const sec = document.getElementById(secId);
  if (!sec) return;
  const toggle = sec.querySelector('.collapsible-toggle');
  const body = sec.querySelector('.collapsible-body');
  if (!toggle || !body) return;
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    body.hidden = expanded;
    sec.classList.toggle('open', !expanded);
  });
}
['sec-result','sec-prompt','sec-logs'].forEach(setupCollapsible);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultEl.textContent = 'Running...';
  logsEl.textContent = '';
  usageEl.textContent = '';
  if (promptEl) promptEl.textContent = '';

  const data = Object.fromEntries(new FormData(form).entries());
  for (const k of ['max_tokens','timeout']) {
    if (data[k] !== undefined && data[k] !== '') data[k] = Number(data[k]);
  }
  for (const k of ['temperature','top_p','frequency_penalty','presence_penalty']) {
    if (data[k] !== undefined && data[k] !== '') data[k] = Number(data[k]);
  }
  // coerce showPrompt checkbox
  data.showPrompt = data.showPrompt === 'on';
  // coerce useLmOcr checkbox
  data.useLmOcr = data.useLmOcr === 'on';

  try {
    const r = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const j = await r.json();
    // Prefer raw AI text as-is; pretty print if JSON
    let display = j.text ?? '';
    if (typeof display === 'string') {
      try { display = JSON.stringify(JSON.parse(display), null, 2); } catch {}
    }
  resultEl.textContent = display || JSON.stringify({ ok: j.ok, docType: j.docType }, null, 2);
    if (j.usage) usageEl.textContent = JSON.stringify(j.usage, null, 2);
  if (promptEl && j.prompt) promptEl.textContent = j.prompt;
    logsEl.textContent = (j.stdout || '') + (j.stderr || '');
    // Auto-expand sections when content arrives
    for (const id of ['sec-result','sec-prompt']) {
      const sec = document.getElementById(id);
      const toggle = sec?.querySelector('.collapsible-toggle');
      const body = sec?.querySelector('.collapsible-body');
      if (sec && toggle && body) {
        body.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        sec.classList.add('open');
      }
    }
  } catch (e) {
    resultEl.textContent = 'Error: ' + e.message;
  }
});

// Copy buttons (Home tab)
copyResultBtn?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(resultEl?.textContent || '');
    copyResultBtn.textContent = 'Copied';
    setTimeout(() => (copyResultBtn.textContent = 'Copy'), 1200);
  } catch {}
});
copyPromptBtn?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(promptEl?.textContent || '');
    copyPromptBtn.textContent = 'Copied';
    setTimeout(() => (copyPromptBtn.textContent = 'Copy'), 1200);
  } catch {}
});

// Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabs = document.querySelectorAll('.tab-content');
tabButtons.forEach(btn => btn.addEventListener('click', () => {
  tabButtons.forEach(b => b.classList.remove('active'));
  tabs.forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const id = btn.dataset.tab;
  document.getElementById(`tab-${id}`).classList.add('active');
}));

// Chat UI
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatBox = document.getElementById('chat-box');
const chatParamsForm = document.getElementById('chat-params-form');
const includeHistoryEl = document.getElementById('include-history');
const newChatBtn = document.getElementById('new-chat');
const chatFileEl = document.getElementById('chat-file');

function appendMsg(role, text, opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'chat-msg';

  const roleEl = document.createElement('div');
  roleEl.className = 'role';
  roleEl.textContent = role;
  wrap.appendChild(roleEl);

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text || '';
  bubble.dataset.raw = text || '';
  wrap.appendChild(bubble);

  if (Array.isArray(opts.attachments) && opts.attachments.length) {
    const att = document.createElement('div');
    att.className = 'attachments';
    for (const name of opts.attachments) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = name;
      att.appendChild(chip);
    }
    wrap.appendChild(att);
  }

  if (role === 'assistant') {
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(bubble.dataset.raw || bubble.textContent || '');
        copyBtn.textContent = 'Copied';
        setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
      } catch {}
    });
    wrap.appendChild(copyBtn);
  }

  if (opts.typing) {
    bubble.classList.add('typing');
    bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  }

  chatBox.appendChild(wrap);
  chatBox.scrollTop = chatBox.scrollHeight;
  return { wrap, bubble };
}

function setMsgText(bubbleEl, text) {
  if (!bubbleEl) return;
  bubbleEl.classList.remove('typing');
  bubbleEl.textContent = text || '';
  bubbleEl.dataset.raw = text || '';
}

let chatHistory = [];
newChatBtn?.addEventListener('click', () => {
  chatHistory = [];
  chatBox.innerHTML = '';
});

// Vendor Matching UI
const vmPhase1 = document.getElementById('vm-phase1');
const vmRun = document.getElementById('vm-run');
const vmResults = document.getElementById('vm-results');
const vmForm = document.getElementById('vendor-form');
const vmSubmitBtn = document.getElementById('vendor-submit');

async function runVendorMatchingUI() {
  vmResults.textContent = 'Running...';
  // read options
  const opts = Object.fromEntries(new FormData(vmForm).entries());
  const minScore = Number(opts.minScore || 38);
  const isCanadian = String(opts.isCanadian || 'false') === 'true';
  // parse payloads
  let phase1Data;
  try { phase1Data = JSON.parse(vmPhase1.value || '{}'); }
  catch (e) { vmResults.textContent = 'Invalid Phase 1 JSON: ' + e.message; return; }

  try {
    const r = await fetch('/api/vendor-matching', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase1Data, isCanadian, minScore })
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Unknown error');
    vmResults.textContent = JSON.stringify(j.results, null, 2);
  } catch (e) {
    vmResults.textContent = 'Error: ' + e.message;
  }
}

vmRun?.addEventListener('click', runVendorMatchingUI);
vmSubmitBtn?.addEventListener('click', runVendorMatchingUI);
vmForm?.addEventListener('submit', (e) => { e.preventDefault(); runVendorMatchingUI(); });
chatForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = chatInput.value.trim();
  if (!content) return;
  const files = chatFileEl?.files;
  const fileNames = files && files.length ? Array.from(files).map(f => f.name) : [];
  appendMsg('user', content, { attachments: fileNames });
  chatInput.value = '';
  chatHistory.push({ role: 'user', content });

  const params = Object.fromEntries(new FormData(chatParamsForm).entries());
  // coerce numerics
  for (const k of ['max_tokens','timeout']) if (params[k] !== '') params[k] = Number(params[k]);
  for (const k of ['temperature','top_p','frequency_penalty','presence_penalty']) if (params[k] !== '') params[k] = Number(params[k]);

  // Build messages per include-history toggle
  const messages = includeHistoryEl?.checked ? chatHistory : chatHistory.slice(-1);

  const sendBtn = chatForm.querySelector('button[type="submit"]');
  sendBtn && (sendBtn.disabled = true);
  const pending = appendMsg('assistant', '', { typing: true });

  try {
    // If files are selected, send as multipart with raw files
    let j;
    if (files && files.length) {
      const fd = new FormData();
      fd.append('payload', JSON.stringify({ ...params, messages }));
      for (const f of files) fd.append('files', f, f.name);
      const r = await fetch('/api/chat', { method: 'POST', body: fd });
      j = await r.json();
    } else {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, messages })
      });
      j = await r.json();
    }
    const text = j?.text || j?.error || '';
    setMsgText(pending.bubble, text);
    if (j?.text) chatHistory.push({ role: 'assistant', content: j.text });
    // clear file selection after send
    if (files && files.length) chatFileEl.value = '';
  } catch (err) {
    setMsgText(pending.bubble, 'Error: ' + err.message);
  }
  finally {
    sendBtn && (sendBtn.disabled = false);
  }
});
