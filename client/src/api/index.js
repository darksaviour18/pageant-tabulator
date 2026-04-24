import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// --- Events ---
export const eventsAPI = {
  create: (name) => api.post('/events', { name }),
  getAll: () => api.get('/events'),
  getById: (id) => api.get(`/events/${id}`),
  update: (id, data) => api.patch(`/events/${id}`, data),
};

// --- Judges ---
export const judgesAPI = {
  create: (eventId, data) => api.post(`/events/${eventId}/judges`, data),
  getAll: (eventId) => api.get(`/events/${eventId}/judges`),
  delete: (eventId, judgeId) => api.delete(`/events/${eventId}/judges/${judgeId}`),
};

// --- Contestants ---
export const contestantsAPI = {
  create: (eventId, data) => api.post(`/events/${eventId}/contestants`, data),
  getAll: (eventId) => api.get(`/events/${eventId}/contestants`),
  update: (id, data) => api.patch(`/contestants/${id}`, data),
  delete: (id) => api.delete(`/contestants/${id}`),
};

// --- Categories ---
export const categoriesAPI = {
  create: (eventId, data) => api.post(`/events/${eventId}/categories`, data),
  getAll: (eventId) => api.get(`/events/${eventId}/categories`),
  update: (id, data) => api.patch(`/categories/${id}`, data),
  delete: (eventId, categoryId) => api.delete(`/events/${eventId}/categories/${categoryId}`),
};

// --- Criteria ---
export const criteriaAPI = {
  create: (categoryId, data) => api.post(`/categories/${categoryId}/criteria`, data),
  getAll: (categoryId) => api.get(`/categories/${categoryId}/criteria`),
  update: (id, data) => api.patch(`/criteria/${id}`, data),
  delete: (categoryId, criterionId) => api.delete(`/categories/${categoryId}/criteria/${criterionId}`),
};

// --- Auth ---
export const authAPI = {
  login: (data) => api.post('/auth/judge', data),
};

// --- Scoring ---
export const scoringAPI = {
  getContext: (judgeId, eventId) => api.get(`/scoring/${judgeId}/event/${eventId}`),
  getCategoryScores: (judgeId, eventId, categoryId) =>
    api.get(`/scoring/${judgeId}/event/${eventId}/category/${categoryId}`),
};

export const scoresAPI = {
  submitScore: (data) => api.post('/scores', data),
  batchSubmitScores: (scores) => api.post('/scores/batch', { scores }),
};

export const submissionsAPI = {
  submitCategory: (judgeId, categoryId) =>
    api.post('/submissions', { judge_id: judgeId, category_id: categoryId }),
  unlockCategory: (judgeId, categoryId) =>
    api.post('/submissions/unlock', { judge_id: judgeId, category_id: categoryId }),
};

// --- Reports ---
export const reportsAPI = {
  getReport: (eventId, categoryId) => api.get(`/reports/${eventId}/category/${categoryId}`),
  getCrossCategoryReport: (eventId, data) => api.post(`/reports/${eventId}/cross-category`, data),
  saveReport: (data) => api.post('/reports/save', data),
  getSavedReports: (eventId) => api.get(`/reports/saved?event_id=${eventId}`),
  deleteSavedReport: (eventId, id) => api.delete(`/reports/saved/${id}?event_id=${eventId}`),
};

// --- Elimination Rounds ---
export const eliminationRoundsAPI = {
  create: (data) => api.post('/elimination-rounds', data),
  getAll: (eventId) => api.get(`/elimination-rounds?event_id=${eventId}`),
  getQualifiers: (roundId) => api.get(`/elimination-rounds/${roundId}/qualifiers`),
  delete: (eventId, roundId) => api.delete(`/elimination-rounds/${roundId}?event_id=${eventId}`),
};

// --- Audit Logs ---
export const auditLogsAPI = {
  getAll: (eventId, options = {}) => {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);
    if (options.action) params.append('action', options.action);
    return api.get(`/audit-logs/${eventId}?${params.toString()}`);
  },
};