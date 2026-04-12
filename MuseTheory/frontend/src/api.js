const TOKEN_KEY = 'musetheory_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? safeParse(text) : null;

  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildQuery(params) {
  const usp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      usp.append(k, v);
    }
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  // Auth
  register: (payload) => request('POST', '/api/auth/register', payload),
  login: (payload) => request('POST', '/api/auth/login', payload),
  me: () => request('GET', '/api/users/me'),

  // Instruments / voice parts
  listInstruments: () => request('GET', '/api/instruments'),
  createInstrument: (payload) => request('POST', '/api/instruments', payload),
  listVoiceParts: () => request('GET', '/api/instruments/voice-parts'),
  createVoicePart: (payload) => request('POST', '/api/instruments/voice-parts', payload),

  // Pieces / catalog
  listPieces: () => request('GET', '/api/pieces'),
  searchPieces: (filters) => request('GET', `/api/pieces/search${buildQuery(filters)}`),
  getPiece: (id) => request('GET', `/api/pieces/${id}`),

  // Repertoire workspace
  listRepertoire: () => request('GET', '/api/repertoire'),
  saveRepertoire: (payload) => request('POST', '/api/repertoire', payload),
  getRepertoireDetail: (id) => request('GET', `/api/repertoire/${id}`),
  updateRepertoire: (id, payload) => request('PATCH', `/api/repertoire/${id}`, payload),
  deleteRepertoire: (id) => request('DELETE', `/api/repertoire/${id}`),
  logPractice: (id, payload) => request('POST', `/api/repertoire/${id}/practice-sessions`, payload),
};
