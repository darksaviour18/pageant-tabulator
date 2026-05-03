import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Send httpOnly cookies (JWT)
});

// Attach judge token to score requests when available
api.interceptors.request.use((config) => {
  if (config.url?.startsWith('/scores')) {
    try {
      const session = JSON.parse(localStorage.getItem('judge_session') || '{}');
      if (session.token) {
        config.headers['Authorization'] = `Bearer ${session.token}`;
      }
    } catch {
      // No session — request will be rejected by server
    }
  }
  return config;
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
  getAll: (eventId, params) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/events/${eventId}/contestants${queryString}`);
  },
  update: (eventId, id, data) => api.patch(`/events/${eventId}/contestants/${id}`, data),
  delete: (eventId, id) => api.delete(`/events/${eventId}/contestants/${id}`),
  uploadPhoto: (eventId, contestantId, file) => {
    const formData = new FormData();
    formData.append('photo', file);
    return api.post(`/events/${eventId}/contestants/${contestantId}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getPhoto: (eventId, contestantId) => 
    api.get(`/events/${eventId}/contestants/${contestantId}/photo`, { responseType: 'blob' }),
};

// --- Categories ---
export const categoriesAPI = {
  create: (eventId, data) => api.post(`/events/${eventId}/categories`, data),
  getAll: (eventId) => api.get(`/events/${eventId}/categories`),
  update: (eventId, id, data) => api.patch(`/events/${eventId}/categories/${id}`, data),
  delete: (eventId, categoryId) => api.delete(`/events/${eventId}/categories/${categoryId}`),
  setRequiredRound: (eventId, categoryId, roundId) =>
    api.patch(`/events/${eventId}/categories/${categoryId}`, { required_round_id: roundId }),
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
  getContext: (judgeId, eventId, options) => api.get(`/scoring/${judgeId}/event/${eventId}`, options),
  getCategoryScores: (judgeId, eventId, categoryId, options) =>
    api.get(`/scoring/${judgeId}/event/${eventId}/category/${categoryId}`, options),
};

export const scoresAPI = {
  submitScore: (data) => api.post('/scores', data),
  batchSubmitScores: (scores) => api.post('/scores/batch', { scores }),
  getAllByJudge: (judgeId) => api.get(`/scores/judge/${judgeId}`),
  getAllByEventAndCategory: (eventId, categoryId) =>
    api.get(`/scores/event/${eventId}/category/${categoryId}`),
};

export const submissionsAPI = {
  submitCategory: (judgeId, categoryId) =>
    api.post('/submissions', { judge_id: judgeId, category_id: categoryId }),
  unlockCategory: (judgeId, categoryId) =>
    api.post('/submissions/unlock', { judge_id: judgeId, category_id: categoryId }),
  getByJudgeAndEvent: (judgeId, eventId) =>
    api.get(`/submissions/${judgeId}/event/${eventId}`),
};

// --- Reports ---
export const reportsAPI = {
  getReport: (eventId, categoryId) => api.get(`/reports/${eventId}/category/${categoryId}`),
  getCsv: (eventId, categoryId) => api.get(`/reports/${eventId}/category/${categoryId}/csv`, { responseType: 'blob' }),
  getCrossCategoryReport: (eventId, data) => api.post(`/reports/${eventId}/cross-category`, data),
  getCrossCategoryCsv: (eventId, data) => api.post(`/reports/${eventId}/cross-category/csv`, data, { responseType: 'blob' }),
  saveReport: (data) => api.post('/reports/save', data),
  getSavedReports: (eventId) => api.get(`/reports/saved?event_id=${eventId}`),
  deleteSavedReport: (eventId, id) => api.delete(`/reports/saved/${id}?event_id=${eventId}`),
};

// --- Elimination Rounds ---
export const eliminationRoundsAPI = {
  create: (data) => api.post('/elimination-rounds', data),
  getAll: (eventId) => api.get(`/elimination-rounds?event_id=${eventId}`),
  getQualifiers: (roundId) => api.get(`/elimination-rounds/${roundId}/qualifiers`),
  updateQualifiers: (roundId, data) => api.patch(`/elimination-rounds/${roundId}/qualifiers`, data),
  update: (roundId, data) => api.patch(`/elimination-rounds/${roundId}`, data),
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