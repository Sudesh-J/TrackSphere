// Empty VITE_API_URL => same-origin (nginx proxies /api). Dev default is localhost:4000.
const rawApiUrl = import.meta.env.VITE_API_URL;
const API_URL =
  rawApiUrl === undefined || rawApiUrl === null || rawApiUrl === ''
    ? import.meta.env.DEV
      ? 'http://localhost:4000'
      : ''
    : String(rawApiUrl).replace(/\/$/, '');

export function getApiUrl() {
  return API_URL;
}

export async function apiRequest(path, { method = 'GET', body, token, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!formData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: formData ? formData : body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else if (contentType.includes('text/csv')) {
    data = await res.text();
  }

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export function authedAssetUrl(path, token) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token || '')}`;
}
