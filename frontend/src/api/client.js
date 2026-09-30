import axios from 'axios';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (!envUrl) return '/api';
  return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/+$/, '')}/api`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('opic_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  defaultLogin: () => api.post('/auth/default-login'),
  getMe: () => api.get('/auth/me'),
};

export const sessionApi = {
  create: (data) => api.post('/sessions', data),
  submitSurvey: (id, data) => api.post(`/sessions/${id}/survey`, data),
  submitSelfAssessment: (id, data) => api.post(`/sessions/${id}/self-assessment`, data),
  submitTopics: (id, data) => api.post(`/sessions/${id}/topics`, data),
  getStatus: (id) => api.get(`/sessions/${id}/status`),
  getNextQuestion: (id, afterOrder) => api.get(`/sessions/${id}/next-question`, {
    params: afterOrder ? { after_order: afterOrder } : undefined
  }),
  getQuestions: (id) => api.get(`/sessions/${id}/questions`),
  getQuestionByIndex: (id, orderIndex) => api.get(`/sessions/${id}/questions/${orderIndex}`),
  finishSession: (id) => api.post(`/sessions/${id}/finish`),
  skipQuestion: (id, orderIndex) => api.post(`/sessions/${id}/questions/${orderIndex}/skip`),
  getReport: (id) => api.get(`/sessions/${id}/report`),
};

export const questionApi = {
  get: (id) => api.get(`/questions/${id}`),
  getAudio: (id) => api.get(`/questions/${id}/audio`),
  getModelAnswers: (id, level) => api.get(`/questions/${id}/model-answers${level ? `?level=${level}` : ''}`),
};

export const answerApi = {
  submit: (formData) => api.post('/answers', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  editTranscript: (id, data) => api.patch(`/answers/${id}/transcript`, data),
  evaluate: (id, versionId) => api.post(`/answers/${id}/evaluate${versionId ? `?version_id=${versionId}` : ''}`),
  rewrite: (id, data) => api.post(`/answers/${id}/rewrite`, data),
  acceptRewrite: (id, formData) => api.post(`/answers/${id}/accept-rewrite`, formData),
  delete: (id) => api.delete(`/answers/${id}`),
};

export const sttApi = {
  getToken: () => api.post('/stt/token'),
};

export const historyApi = {
  getHistory: () => api.get('/history'),
  getStats: () => api.get('/history/stats'),
};

export const libraryApi = {
  get: () => api.get('/library'),
  playlist: (data) => api.post('/library/playlist', data),
};

export const systemApi = {
  ping: () => api.get('/system/ping'),
  getSampleQuestion: () => api.get('/system/sample-question'),
  getBrowserGuide: () => api.get('/system/browser-info-guide'),
};

// Human-readable message for any API error (FastAPI detail may be a string, a list or an object)
export const formatApiError = (err, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.') => {
  if (!err?.response) {
    return 'Không kết nối được máy chủ (backend có thể đang khởi động lại). Vui lòng thử lại sau vài giây.';
  }
  const detail = err.response.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg || JSON.stringify(d)).join('; ');
  if (detail?.message) return detail.message;
  return `${fallback} (HTTP ${err.response.status})`;
};

// Backend-served media (e.g. /data/audio_cache/...) must point at the API host when frontend and backend are split
export const resolveMediaUrl = (path) => {
  if (!path || /^https?:\/\//.test(path)) return path;
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (!envUrl || !envUrl.startsWith('http')) return path;
  return `${new URL(envUrl).origin}${path}`;
};

export default api;
