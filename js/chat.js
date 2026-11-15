/**
 * chat.js - Team & Counter Chat with Inline Edit & Delete Support
 * Backed by /api/chats on the central ERP server
 */

import { getAuthHeaders, formatDateTime } from './storage.js';
import { getCurrentUser, formatRoleLabel } from './auth.js';

const CHAT_CHANNELS = [
  { id: 'all', label: 'All Channels', icon: '💬' },
  { id: 'general', label: 'General Counter', icon: '🏪' },
  { id: 'services', label: 'Service Desk', icon: '📑' },
  { id: 'customers', label: 'Customer Queries', icon: '👥' },
  { id: 'urgent', label: 'Urgent / Follow-up', icon: '🚨' }
];

const chatState = {
  channel: 'general',
  searchQuery: '',
  messages: [],
  editingId: null,
  editingText: '',
  loading: false,
  error: null
};

let chatHooks = {
  showToast: (msg, type = 'info') => console.log(`[${type}]`, msg),
  showConfirmDialog: (title, msg, onConfirm) => { if (onConfirm) onConfirm(); }
};

export function registerChatHooks({ showToast, showConfirmDialog }) {
  if (showToast) chatHooks.showToast = showToast;
  if (showConfirmDialog) chatHooks.showConfirmDialog = showConfirmDialog;
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(v) {
  return esc(v).replace(/'/g, '&#39;');
}

function canManageMessage(msg, user) {
  if (!msg || !user) return false;
  const userUid = user.uid || user.id;
  const role = String(user.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'MANAGER') return true;
  return msg.senderUid === userUid;
}

function paintChatChannels() {
  const wrap = document.getElementById('chat-channel-tabs');
  if (!wrap) return;
  wrap.innerHTML = CHAT_CHANNELS.map(ch => `
    <button
      type="button"
      class="btn btn-sm chat-channel-btn ${chatState.channel === ch.id ? 'btn-primary' : 'btn-outline'}"
      onclick="window.MJK.selectChatChannel('${ch.id}')"
    >
      <span>${ch.icon}</span>
      <span>${ch.label}</span>
    </button>
  `).join('');
}

function paintChatMessages() {
  const listEl = document.getElementById('chat-messages-list');
  const countEl = document.getElementById('chat-messages-count');
  if (!listEl) return;

  const user = getCurrentUser();
  const q = (chatState.searchQuery || '').toLowerCase().trim();
  const filtered = (chatState.messages || []).filter(m => {
    if (!q) return true;
    return (
      String(m.message || '').toLowerCase().includes(q) ||
      String(m.senderName || '').toLowerCase().includes(q) ||
      String(m.channel || '').toLowerCase().includes(q)
    );
  });

  if (countEl) {
    countEl.textContent = `${filtered.length} message${filtered.length === 1 ? '' : 's'}`;
  }

  if (chatState.loading && !chatState.messages.length) {
    listEl.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted);">Loading team chat messages...</div>`;
    return;
  }

  if (chatState.error) {
    listEl.innerHTML = `
      <div style="padding:1.5rem; text-align:center; color:var(--danger);">
        <div style="font-weight:700; margin-bottom:0.4rem;">Unable to load messages</div>
        <div style="font-size:0.82rem; margin-bottom:0.75rem;">${esc(chatState.error)}</div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.refreshChatMessages()">↻ Retry</button>
      </div>
    `;
    return;
  }

  if (!filtered.length) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:2.5rem 1rem;">
        <div class="empty-state-icon">💬</div>
        <div class="empty-state-title">${q ? 'No Matching Messages' : 'No Messages in This Channel Yet'}</div>
        <div class="empty-state-desc">Start a counter note or staff discussion below. You can edit or delete messages anytime.</div>
      </div>
    `;
    return;
  }

  const channelLabelMap = Object.fromEntries(CHAT_CHANNELS.map(c => [c.id, `${c.icon} ${c.label}`]));

  listEl.innerHTML = filtered.map(msg => {
    const isMine = user && (msg.senderUid === (user.uid || user.id));
    const canModify = canManageMessage(msg, user);
    const isEditing = chatState.editingId === msg.id;

    return `
      <div
        class="chat-msg-card"
        data-chat-id="${escAttr(msg.id)}"
        style="border:1px solid ${isMine ? 'var(--blue-200, #bfdbfe)' : 'var(--border-subtle)'}; background:${isMine ? 'var(--surface)' : 'var(--surface-alt)'}; border-radius:var(--radius-md); padding:0.75rem 0.9rem; display:flex; flex-direction:column; gap:0.45rem;"
      >
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
            <strong style="font-size:0.86rem; color:var(--text-main);">${esc(msg.senderName || msg.senderUid)}</strong>
            <span class="badge badge-neutral" style="font-size:0.68rem;">${esc(formatRoleLabel(msg.senderRole || 'STAFF'))}</span>
            <span class="badge badge-info" style="font-size:0.68rem;">${esc(channelLabelMap[msg.channel] || msg.channel)}</span>
          </div>

          <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
            <span class="tabular-nums font-mono" style="font-size:0.72rem; color:var(--text-muted);">
              ${esc(formatDateTime(msg.createdAt))}
              ${msg.isEdited ? `<span style="color:var(--blue-600); font-weight:700;"> (edited)</span>` : ''}
            </span>
            ${canModify && !isEditing ? `
              <button
                type="button"
                class="btn btn-secondary btn-sm chat-action-btn"
                onclick="window.MJK.startEditChatMessage('${escAttr(msg.id)}')"
                title="Edit chat message"
              >✎ Edit</button>
              <button
                type="button"
                class="btn btn-outline btn-sm chat-action-btn"
                style="color:var(--danger); border-color:var(--danger-border);"
                onclick="window.MJK.promptDeleteChatMessage('${escAttr(msg.id)}')"
                title="Delete chat message"
              >🗑 Delete</button>
            ` : ''}
          </div>
        </div>

        ${isEditing ? `
          <form onsubmit="event.preventDefault(); window.MJK.saveEditChatMessage('${escAttr(msg.id)}');" style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.2rem;">
            <textarea
              id="chat-edit-input-${escAttr(msg.id)}"
              class="form-control"
              rows="2"
              required
              style="font-size:0.88rem; resize:vertical;"
            >${esc(chatState.editingText)}</textarea>
            <div style="display:flex; gap:0.45rem; justify-content:flex-end; flex-wrap:wrap;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.cancelEditChatMessage()">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm">💾 Save Changes</button>
            </div>
          </form>
        ` : `
          <div style="font-size:0.9rem; color:var(--text-main); line-height:1.5; white-space:pre-wrap; word-break:break-word;">${esc(msg.message)}</div>
        `}
      </div>
    `;
  }).join('');
}

export function renderChatView() {
  const sendChannel = chatState.channel === 'all' ? 'general' : chatState.channel;

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">💬 Team & Counter Chat (টিম চ্যাট)</h2>
        <p class="page-subtitle">Counter notes, service updates & team messages with instant Edit and Delete controls</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.refreshChatMessages()">↻ Refresh</button>
      </div>
    </div>

    <div class="card chat-shell" style="padding:1rem; display:flex; flex-direction:column; gap:0.85rem;">
      <!-- Channel tabs + search -->
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; flex-wrap:wrap; border-bottom:1px solid var(--border-subtle); padding-bottom:0.75rem;">
        <div id="chat-channel-tabs" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          ${CHAT_CHANNELS.map(ch => `
            <button
              type="button"
              class="btn btn-sm chat-channel-btn ${chatState.channel === ch.id ? 'btn-primary' : 'btn-outline'}"
              onclick="window.MJK.selectChatChannel('${ch.id}')"
            >
              <span>${ch.icon}</span>
              <span>${ch.label}</span>
            </button>
          `).join('')}
        </div>

        <div style="display:flex; align-items:center; gap:0.5rem; flex:1; max-width:340px; min-width:min(100%, 220px);">
          <input
            type="text"
            id="chat-search-input"
            class="form-control"
            placeholder="Search messages or staff..."
            value="${esc(chatState.searchQuery)}"
            oninput="window.MJK.onChatSearchInput(this.value)"
            style="height:38px;"
          >
          <span id="chat-messages-count" class="tabular-nums" style="font-size:0.76rem; color:var(--text-muted); white-space:nowrap;">0 messages</span>
        </div>
      </div>

      <!-- Messages List -->
      <div id="chat-messages-list" style="display:flex; flex-direction:column; gap:0.65rem; max-height:54vh; min-height:220px; overflow-y:auto; padding-right:0.25rem;">
        <div style="padding:2rem; text-align:center; color:var(--text-muted);">Loading team chat messages...</div>
      </div>

      <!-- Composer -->
      <form id="chat-composer-form" onsubmit="window.MJK.sendChatMessage(event)" style="border-top:1px solid var(--border-subtle); padding-top:0.85rem; display:flex; flex-direction:column; gap:0.55rem;">
        <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
          <label for="chat-compose-channel" style="font-size:0.76rem; font-weight:700; color:var(--text-muted);">Channel:</label>
          <select id="chat-compose-channel" class="form-control" style="width:auto; min-width:170px; height:36px; font-size:0.82rem;">
            ${CHAT_CHANNELS.filter(c => c.id !== 'all').map(c => `
              <option value="${c.id}" ${sendChannel === c.id ? 'selected' : ''}>${c.icon} ${c.label}</option>
            `).join('')}
          </select>
        </div>
        <div class="chat-composer-row" style="display:flex; gap:0.55rem; align-items:flex-end; flex-wrap:wrap;">
          <textarea
            id="chat-composer-input"
            class="form-control"
            rows="2"
            required
            placeholder="Write a note, customer follow-up update, or service remark..."
            style="flex:1; min-width:min(100%, 260px); resize:vertical; font-size:0.9rem;"
            onkeydown="if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); document.getElementById('chat-composer-form')?.requestSubmit(); }"
          ></textarea>
          <button type="submit" id="chat-send-btn" class="btn btn-primary" style="min-height:44px; padding:0 1.25rem;">
            ➤ Send Message
          </button>
        </div>
      </form>
    </div>
  `;
}

export async function refreshChatMessages() {
  chatState.loading = true;
  chatState.error = null;
  paintChatMessages();

  try {
    const qs = new URLSearchParams({ channel: chatState.channel || 'all' });
    const resp = await fetch(`/api/chats?${qs.toString()}`, { headers: getAuthHeaders() });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      chatState.error = data.message || 'Failed to load chat messages';
    } else {
      chatState.messages = Array.isArray(data.chats) ? data.chats : [];
    }
  } catch (err) {
    chatState.error = err?.message || 'Network error while fetching chat messages';
  } finally {
    chatState.loading = false;
    paintChatMessages();
  }
}

export function initChatViewAfterRender() {
  refreshChatMessages();
}

export function selectChatChannel(channel) {
  chatState.channel = channel || 'general';
  chatState.editingId = null;
  paintChatChannels();
  const composeSelect = document.getElementById('chat-compose-channel');
  if (composeSelect && chatState.channel !== 'all') {
    composeSelect.value = chatState.channel;
  }
  refreshChatMessages();
}

export function onChatSearchInput(val) {
  chatState.searchQuery = val || '';
  paintChatMessages();
}

export async function sendChatMessage(e) {
  e.preventDefault();
  const inputEl = document.getElementById('chat-composer-input');
  const chanEl = document.getElementById('chat-compose-channel');
  const sendBtn = document.getElementById('chat-send-btn');
  const text = (inputEl?.value || '').trim();
  const channel = chanEl?.value || (chatState.channel === 'all' ? 'general' : chatState.channel);

  if (!text) {
    chatHooks.showToast('Please enter a message.', 'warning');
    return;
  }

  if (sendBtn) sendBtn.disabled = true;
  try {
    const resp = await fetch('/api/chats', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ channel, message: text })
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      chatHooks.showToast(data.message || 'Failed to send message.', 'danger');
      return;
    }
    if (inputEl) inputEl.value = '';
    chatHooks.showToast('Message sent.', 'success');
    await refreshChatMessages();
    const listEl = document.getElementById('chat-messages-list');
    if (listEl) listEl.scrollTop = listEl.scrollHeight;
  } catch {
    chatHooks.showToast('Network error while sending message.', 'danger');
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

export function startEditChatMessage(id) {
  const msg = (chatState.messages || []).find(m => m.id === id);
  if (!msg) return;
  chatState.editingId = id;
  chatState.editingText = msg.message || '';
  paintChatMessages();
  setTimeout(() => {
    const inp = document.getElementById(`chat-edit-input-${id}`);
    if (inp) {
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);
    }
  }, 20);
}

export function cancelEditChatMessage() {
  chatState.editingId = null;
  chatState.editingText = '';
  paintChatMessages();
}

export async function saveEditChatMessage(id) {
  const inp = document.getElementById(`chat-edit-input-${id}`);
  const nextText = (inp?.value || '').trim();
  if (!nextText) {
    chatHooks.showToast('Message cannot be empty.', 'warning');
    return;
  }

  try {
    const resp = await fetch(`/api/chats/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ message: nextText })
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      chatHooks.showToast(data.message || 'Failed to update chat message.', 'danger');
      return;
    }
    chatState.editingId = null;
    chatState.editingText = '';
    chatHooks.showToast('Chat message updated.', 'success');
    await refreshChatMessages();
  } catch {
    chatHooks.showToast('Network error while updating chat message.', 'danger');
  }
}

export function promptDeleteChatMessage(id) {
  const msg = (chatState.messages || []).find(m => m.id === id);
  const preview = msg ? String(msg.message || '').slice(0, 60) : '';
  chatHooks.showConfirmDialog(
    'Delete Chat Message?',
    `Are you sure you want to delete this message${preview ? ` ("${preview}${msg.message.length > 60 ? '...' : ''}")` : ''}? This cannot be undone.`,
    async () => {
      try {
        const resp = await fetch(`/api/chats/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
          chatHooks.showToast(data.message || 'Failed to delete chat message.', 'danger');
          return;
        }
        if (chatState.editingId === id) {
          chatState.editingId = null;
          chatState.editingText = '';
        }
        chatHooks.showToast('Chat message deleted.', 'info');
        await refreshChatMessages();
      } catch {
        chatHooks.showToast('Network error while deleting chat message.', 'danger');
      }
    }
  );
}
