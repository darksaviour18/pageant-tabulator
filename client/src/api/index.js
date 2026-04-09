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
  delete: (id) => api.delete(`/categories/${id}`),
};

// --- Criteria ---
export const criteriaAPI = {
  create: (categoryId, data) => api.post(`/categories/${categoryId}/criteria`, data),
  getAll: (categoryId) => api.get(`/categories/${categoryId}/criteria`),
  update: (id, data) => api.patch(`/criteria/${id}`, data),
  delete: (id) => api.delete(`/criteria/${id}`),
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
  submitScore: (data) => api.post('/scores', data),
  batchSubmitScores: (scores) => api.post('/scores/batch', { scores }),
};
