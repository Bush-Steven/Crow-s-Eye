const API = {
  health: '/healthz',
  overview: '/api/overview',
  computers: '/api/computers',
  detections: '/api/detections',
  events: '/api/events'
};

const $ = (id) => document.getElementById(id);
const safeText = (value, fallback = '—') => value === undefined || value === null || value === '' ? fallback : String(value);
const first = (object, keys, fallback) => {
  for (const key of keys) if (object && object[key] !== undefined && object[key] !== null) return object[key];
  return fallback;
};

async function getJSON(path) {
  const response = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) {
    const error = new Error(`Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function itemsFrom(data, keys = ['items', 'results', 'data']) {
  if (Array.isArray(data)) return data;
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key];
  return [];
}

function setNotice(message, visible = true) {
  const notice = $('notice');
  notice.textContent = message;
  notice.hidden = !visible;
}

function updateConnection(online, detail) {
  $('connection-indicator').classList.toggle('is-online', online);
  $('connection-indicator').classList.toggle('is-offline', !online);
  $('connection-state').textContent = online ? 'Server connected' : 'Server unavailable';
  $('connection-detail').textContent = detail;
  $('health-summary').textContent = online ? 'Monitoring API is responding' : 'Unable to reach monitoring API';
}

function renderDetections(data) {
  const list = itemsFrom(data, ['detections', 'items', 'results']);
  $('stat-detections').textContent = safeText(first(data, ['open_detections', 'open', 'total'], list.length));
  $('nav-alert-count').textContent = safeText(first(data, ['open_detections', 'open', 'total'], list.length), '0');
  $('stat-detections-note').textContent = list.length ? `${list.length} recent item${list.length === 1 ? '' : 's'} shown` : 'No recent detections reported';
  const root = $('detections-list');
  if (!list.length) {
    root.innerHTML = '<div class="empty-state"><span class="empty-icon">✓</span><strong>No recent detections</strong><p>New alerts will show here when reported by the server.</p></div>';
    return;
  }
  root.replaceChildren(...list.slice(0, 6).map((item) => {
    const row = document.createElement('div'); row.className = 'detection-row';
    const severity = safeText(first(item, ['severity', 'level'], 'INFO')).toLowerCase();
    const badge = document.createElement('span'); badge.className = `severity severity-${severity}`; badge.textContent = severity.toUpperCase();
    const copy = document.createElement('div'); copy.className = 'detection-copy';
    const title = document.createElement('strong'); title.textContent = safeText(first(item, ['name', 'title', 'rule_name'], 'Detection'));
    const meta = document.createElement('span'); meta.textContent = `${safeText(first(item, ['device', 'hostname', 'computer']), 'Unknown computer')} · ${formatTime(first(item, ['created_at', 'timestamp', 'time']))}`;
    copy.append(title, meta); row.append(badge, copy); return row;
  }));
}

function renderComputers(data) {
  const list = itemsFrom(data, ['computers', 'endpoints', 'hosts', 'items']);
  const onlineCount = list.filter((host) => Boolean(first(host, ['online', 'is_online', 'status'], false) === true || first(host, ['status'], '') === 'online')).length;
  $('stat-computers').textContent = safeText(first(data, ['total', 'count'], list.length));
  $('stat-online').textContent = safeText(first(data, ['online', 'online_count'], onlineCount));
  $('stat-computers-note').textContent = `${list.length} computer${list.length === 1 ? '' : 's'} returned by API`;
  $('stat-online-note').textContent = `${onlineCount} currently reporting`;
  const root = $('computers-list');
  if (!list.length) {
    root.innerHTML = '<div class="empty-state"><span class="empty-icon">▣</span><strong>No computers yet</strong><p>Add an endpoint from the server console to begin monitoring.</p></div>';
    return;
  }
  root.replaceChildren(...list.slice(0, 6).map((host) => {
    const row = document.createElement('div'); row.className = 'computer-row';
    const online = first(host, ['online', 'is_online'], first(host, ['status'], '') === 'online');
    const dot = document.createElement('span'); dot.className = `computer-dot ${online ? 'online' : 'offline'}`;
    const copy = document.createElement('div'); copy.className = 'computer-copy';
    const name = document.createElement('strong'); name.textContent = safeText(first(host, ['hostname', 'name', 'device']), 'Unnamed computer');
    const detail = document.createElement('span'); detail.textContent = `${safeText(first(host, ['platform', 'os'], 'Endpoint'))} · ${online ? 'Online' : 'Offline'}`;
    const heartbeat = document.createElement('span'); heartbeat.className = 'heartbeat'; heartbeat.textContent = formatTime(first(host, ['last_seen', 'last_heartbeat', 'updated_at']));
    copy.append(name, detail); row.append(dot, copy, heartbeat); return row;
  }));
}

function renderActivity(data) {
  const list = itemsFrom(data, ['events', 'activity', 'items', 'results']);
  const body = $('activity-rows');
  if (!list.length) {
    body.innerHTML = '<tr><td class="table-empty" colspan="4">No recent activity was returned by the API.</td></tr>';
    return;
  }
  body.replaceChildren(...list.slice(0, 8).map((item) => {
    const tr = document.createElement('tr');
    const values = [first(item, ['name', 'event', 'title', 'type'], 'Event'), first(item, ['device', 'hostname', 'computer'], '—'), formatTime(first(item, ['timestamp', 'created_at', 'time'])), safeText(first(item, ['severity', 'level'], 'INFO')).toUpperCase()];
    values.forEach((value, index) => { const td = document.createElement('td'); td.textContent = safeText(value); if (index === 3) { td.className = 'severity-cell'; } tr.append(td); });
    return tr;
  }));
}

function formatTime(value) {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

async function refresh() {
  $('refresh-button').disabled = true;
  $('refresh-button').classList.add('loading');
  try {
    await getJSON(API.health);
    updateConnection(true, 'Health check passed');
    const results = await Promise.allSettled([getJSON(API.overview), getJSON(API.computers), getJSON(API.detections), getJSON(API.events)]);
    const [overview, computers, detections, events] = results;
    if (overview.status === 'fulfilled') {
      const summary = overview.value;
      if (summary.health_score !== undefined) $('stat-health').textContent = `${summary.health_score}%`;
      else if (summary.health !== undefined && typeof summary.health !== 'object') $('stat-health').textContent = `${summary.health}${typeof summary.health === 'number' ? '%' : ''}`;
    }
    if (computers.status === 'fulfilled') renderComputers(computers.value);
    if (detections.status === 'fulfilled') renderDetections(detections.value);
    if (events.status === 'fulfilled') renderActivity(events.value);
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length === results.length) setNotice('The server health check is available, but dashboard data endpoints did not respond. Verify the backend API routes.');
    else if (failed.length) setNotice('Some dashboard data could not be loaded. Check the server API response and refresh.');
    else setNotice('', false);
    $('last-updated').textContent = `Updated ${new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date())}`;
  } catch (error) {
    updateConnection(false, error.status === 401 ? 'Authentication required' : 'Health check failed');
    setNotice(error.status === 401 ? 'Your session is not authenticated. Sign in through the server console, then refresh.' : 'Unable to connect to the Crow\'s Eye backend. Confirm the server is running and this page is served by it.');
    $('stat-health').textContent = '—';
  } finally {
    $('refresh-button').disabled = false;
    $('refresh-button').classList.remove('loading');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('refresh-button').addEventListener('click', refresh);
  refresh();
  window.setInterval(refresh, 30000);
});
