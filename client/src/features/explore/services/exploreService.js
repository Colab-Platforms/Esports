// Explore feature API calls, using the shared fetch-based api client
// (client/src/services/api.js) - same instance Navbar.js already uses.
import api from '../../../services/api';

const exploreService = {
  // Public feed - returns { featured, items, pagination } in one call
  getExploreContent: (params = {}) => api.get('/api/explore', { params }),

  // Admin
  getAdminExploreContent: (params = {}) => api.get('/api/explore/admin', { params }),
  getExploreContentById: (id) => api.get(`/api/explore/admin/${id}`),
  createExploreContent: (data) => api.post('/api/explore', data),
  updateExploreContent: (id, data) => api.put(`/api/explore/${id}`, data),
  deleteExploreContent: (id) => api.delete(`/api/explore/${id}`),
  toggleExploreContent: (id) => api.request(`/api/explore/${id}/toggle-active`, { method: 'PATCH' }),
  reorderExploreContent: (items) => api.request('/api/explore/reorder', { method: 'PATCH', body: { items } }),

  // Fire-and-forget click tracking - failures must never block navigation
  trackExploreClick: (id) => {
    api.request(`/api/explore/${id}/click`, { method: 'PATCH' }).catch(() => {});
  }
};

export default exploreService;
