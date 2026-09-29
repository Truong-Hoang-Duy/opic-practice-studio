import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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
  getNextQuestion: (id) => api.get(`/sessions/${id}/next-question`),
  finishSession: (id) => api.post(`/sessions/${id}/finish`),
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

export const systemApi = {
  ping: () => api.get('/system/ping'),
  getSampleQuestion: () => api.get('/system/sample-question'),
  getBrowserGuide: () => api.get('/system/browser-info-guide'),
};

export default api;
