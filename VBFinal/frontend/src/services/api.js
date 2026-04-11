const normalizeApiBase = (rawBase) => {
  const trimmed = (rawBase || '/api').trim().replace(/\/+$/, '');
  if (trimmed === '/api' || trimmed.endsWith('/api')) {
    return trimmed;
  }
  return `${trimmed}/api`;
};

const API_BASE_URL = normalizeApiBase(import.meta.env.VITE_API_URL);

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token || null;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  clearAuthStorage() {
    this.setToken(null);
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
  }

  getHeaders(isFormData = false, skipAuth = false) {
    const headers = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.token && !skipAuth) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refresh');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${API_BASE_URL}/accounts/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      this.clearAuthStorage();
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    this.setToken(data.access);
    return data.access;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: this.getHeaders(options.isFormData, options.skipAuth),
      ...options,
    };

    try {
      let response = await fetch(url, config);

      if (response.status === 401 && this.token) {
        try {
          await this.refreshToken();
          config.headers = this.getHeaders(options.isFormData);
          response = await fetch(url, config);
        } catch (refreshError) {
          this.clearAuthStorage();
          window.location.href = '/login';
          throw refreshError;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (response.status === 204 || !contentType?.includes('application/json')) {
        return {};
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // Feedback Template Management
  async getFeedbackTemplates() {
    return this.request('/feedback/templates/');
  }

  async getFeedbackTemplate(templateId) {
    return this.request(`/feedback/templates/${templateId}/`);
  }

  async createFeedbackTemplate(templateData) {
    return this.request('/feedback/templates/', {
      method: 'POST',
      body: JSON.stringify(templateData)
    });
  }

  async approveFeedbackTemplate(templateId) {
    return this.request(`/feedback/templates/${templateId}/approve/`, {
      method: 'POST'
    });
  }

  async rejectFeedbackTemplate(templateId) {
    return this.request(`/feedback/templates/${templateId}/reject/`, {
      method: 'POST'
    });
  }

  async deactivateFeedbackTemplate(templateId) {
    return this.request(`/feedback/templates/${templateId}/deactivate/`, {
      method: 'POST'
    });
  }

  async activateFeedbackTemplate(templateId) {
    return this.request(`/feedback/templates/${templateId}/activate/`, {
      method: 'POST'
    });
  }

  async closeFeedbackTemplate(templateId) {
    return this.request(`/feedback/templates/${templateId}/close/`, {
      method: 'POST'
    });
  }

  async deleteFeedbackTemplate(templateId) {
    return this.request(`/feedback/templates/${templateId}/`, {
      method: 'DELETE'
    });
  }

  async getFeedbackTemplateAnalytics(templateId, filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.append(key, value);
      }
    });

    const query = params.toString();
    const endpoint = query
      ? `/feedback/templates/${templateId}/analytics/?${query}`
      : `/feedback/templates/${templateId}/analytics/`;

    return this.request(endpoint);
  }

  async submitFeedbackResponse(data) {
    return this.request('/feedback/responses/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getOfficerTemplates() {
    return this.request('/officer/templates/');
  }

  // JWT Session Management
  async getJwtConfig() {
    return this.request('/system/jwt-session/');
  }

  async updateJwtTimeout(timeoutMinutes) {
    return this.request('/system/jwt-session/', {
      method: 'POST',
      body: JSON.stringify({ timeout_minutes: timeoutMinutes }),
    });
  }

  async checkTokenExpiry() {
    return this.request('/accounts/token/check-expiry/', {
      method: 'POST',
    });
  }

  async getMaintenanceStatus() {
    return this.request('/system/maintenance/', {
      skipAuth: true,
    });
  }

  async getSystemLogs({ limit = 100, level = '', category = '', page = 1 } = {}) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (level) params.set('level', level);
    if (category) params.set('category', category);
    if (page) params.set('page', String(page));
    return this.request(`/system-logs/?${params.toString()}`);
  }

  async updateMaintenanceStatus(data) {
    return this.request('/system/maintenance/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getCurrentUserProfile() {
    return this.request('/accounts/me/');
  }

  async updateCurrentUser(data) {
    return this.request('/accounts/me/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
  async getComplaints() {
    return this.request('/complaints/');
  }

  async getCCComplaints() {
    return this.request('/complaints/cc/');
  }

  async createComplaint(data) {
    const isFormData = data instanceof FormData;
    return this.request('/complaints/', {
      method: 'POST',
      body: isFormData ? data : JSON.stringify(data),
      isFormData: isFormData,
    });
  }

  async getComplaint(id) {
    return this.request(`/complaints/${id}/`);
  }

  async updateComplaint(id, data) {
    return this.request(`/complaints/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteComplaint(id) {
    return this.request(`/complaints/${id}/`, {
      method: 'DELETE',
    });
  }

  async patchComplaint(id, data) {
    return this.request(`/complaints/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async assignComplaint(id, data) {
    return this.request(`/complaints/${id}/assign/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async reassignComplaint(id, data) {
    return this.request(`/complaints/${id}/reassign/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getComplaintEligibleOfficers(id) {
    return this.request(`/complaints/${id}/eligible-officers/`);
  }

  async changeComplaintStatus(id, statusValue) {
    return this.request(`/complaints/${id}/change-status/`, {
      method: 'POST',
      body: JSON.stringify({ status: statusValue }),
    });
  }

  // Comments and Responses
  async addComplaintComment(complaintId, comment) {
    return this.request(`/complaints/${complaintId}/comments/`, {
      method: 'POST',
      body: JSON.stringify({ message: comment }),
    });
  }

  async getComplaintComments(complaintId) {
    return this.request(`/complaints/${complaintId}/comments/`);
  }

  async getComplaintAnalytics(options = {}) {
    const params = new URLSearchParams();
    if (options.scope) {
      params.append('scope', options.scope);
    }
    if (options.officerId) {
      params.append('officer_id', String(options.officerId));
    }

    const query = params.toString();
    const endpoint = query ? `/complaints/analytics/?${query}` : '/complaints/analytics/';
    return this.request(endpoint);
  }

  // Responses
  async addComplaintResponse(complaintId, responseData) {
    return this.request('/responses/', {
      method: 'POST',
      body: JSON.stringify({
        complaint: complaintId,
        ...responseData
      }),
    });
  }

  async escalateComplaint(complaintId) {
    return this.request(`/complaints/${complaintId}/escalate/`, {
      method: 'POST',
    });
  }

  async createResponse(data) {
    return this.request('/responses/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getComplaintResponses(complaintId) {
    return this.request(`/complaints/${complaintId}/responses/`);
  }

  async getComplaintComments(complaintId) {
    return this.request(`/complaints/${complaintId}/comments/`);
  }

  async updateResponse(responseId, data) {
    return this.request(`/responses/${responseId}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteResponse(responseId) {
    return this.request(`/responses/${responseId}/`, {
      method: 'DELETE',
    });
  }

  async updateComment(commentId, data) {
    return this.request(`/comments/${commentId}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async createComment(data) {
    return this.request('/comments/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteComment(commentId) {
    return this.request(`/comments/${commentId}/`, {
      method: 'DELETE',
    });
  }

  // Ratings
  async addComplaintRating(complaintId, rating, feedback) {
    return this.request('/comments/', {
      method: 'POST',
      body: JSON.stringify({
        complaint: complaintId,
        comment_type: 'rating',
        message: feedback || 'No feedback provided',
        rating: rating
      }),
    });
  }

  async getUsers(page = null, pageSize = null) {
    let url = '/accounts/';
    const params = new URLSearchParams();

    if (page) params.append('page', page);
    if (pageSize) params.append('page_size', pageSize);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    return this.request(url);
  }

  async getAllUsers() {
    // Fetch all users by getting first page and then all subsequent pages
    let allUsers = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getUsers(page, 50); // Use larger page size
      const users = response.results || response;

      if (Array.isArray(users)) {
        allUsers = allUsers.concat(users);
      } else {
        // If response is not paginated, return as is
        return response;
      }

      // Check if there are more pages
      hasMore = response.next !== null;
      page++;
    }

    return { results: allUsers, count: allUsers.length };
  }

  // Contact
  async sendContact(data) {
    return this.request('/contact/', { method: 'POST', body: JSON.stringify(data) });
  }


  async getInstitutions() {
    const [campusesRes, collegesRes, departmentsRes] = await Promise.all([
      this.getCampuses(),
      this.getColleges(),
      this.getDepartments(),
    ]);

    const campuses = campusesRes.results || campusesRes || [];
    const colleges = collegesRes.results || collegesRes || [];
    const departments = departmentsRes.results || departmentsRes || [];

    return [
      ...campuses.map((item) => ({ ...item, entity_type: 'campus' })),
      ...colleges.map((item) => ({ ...item, entity_type: 'college' })),
      ...departments.map((item) => ({ ...item, entity_type: 'department' })),
    ];
  }

  async createInstitution() {
    throw new Error('Institutions were removed from backend. Create campus, college, or department instead.');
  }

  async updateInstitution() {
    throw new Error('Institutions were removed from backend. Update campus, college, or department instead.');
  }

  async deleteInstitution() {
    throw new Error('Institutions were removed from backend. Delete campus, college, or department instead.');
  }

  // Colleges
  async getColleges(campusId = null) {
    const url = campusId ? `/colleges/?campus=${campusId}` : '/colleges/';
    return this.request(url);
  }
  async createCollege(data) { return this.request('/colleges/', { method: 'POST', body: JSON.stringify(data) }); }
  async updateCollege(id, data) { return this.request(`/colleges/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteCollege(id) { return this.request(`/colleges/${id}/`, { method: 'DELETE' }); }

  // Departments
  async getDepartments(collegeId = null) {
    const url = collegeId ? `/departments/?college=${collegeId}` : '/departments/';
    return this.request(url);
  }
  async createDepartment(data) { return this.request('/departments/', { method: 'POST', body: JSON.stringify(data) }); }
  async updateDepartment(id, data) { return this.request(`/departments/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteDepartment(id) { return this.request(`/departments/${id}/`, { method: 'DELETE' }); }

  // Programs
  async getPrograms() { return this.request('/programs/'); }
  async getStudentTypes() { return this.request('/student-types/'); }
  async createProgram(data) { return this.request('/programs/', { method: 'POST', body: JSON.stringify(data) }); }
  async updateProgram(id, data) { return this.request(`/programs/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteProgram(id) { return this.request(`/programs/${id}/`, { method: 'DELETE' }); }

  // Campuses
  async getCampuses() { return this.request('/campuses/'); }
  async createCampus(data) { return this.request('/campuses/', { method: 'POST', body: JSON.stringify(data) }); }
  async updateCampus(id, data) { return this.request(`/campuses/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteCampus(id) { return this.request(`/campuses/${id}/`, { method: 'DELETE' }); }

  // Categories
  async getCategories(page = null) {
    const url = page ? `/categories/?page=${page}` : '/categories/';
    return this.request(url);
  }

  async getAllCategories() {
    let allCategories = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getCategories(page);
      const categories = Array.isArray(response)
        ? response
        : Array.isArray(response?.results)
          ? response.results
          : [];

      if (Array.isArray(categories)) {
        allCategories = allCategories.concat(categories);
      } else {
        return { results: [], count: 0 };
      }

      hasMore = Boolean(response && !Array.isArray(response) && response.next);
      page += 1;
    }

    return { results: allCategories, count: allCategories.length };
  }

  async getCategoriesByLanguage(language = 'en') {
    return this.request(`/categories/by-language/?lang=${language}`);
  }

  async createCategory(data) {
    return this.request('/categories/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id, data) {
    return this.request(`/categories/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id) {
    return this.request(`/categories/${id}/`, {
      method: 'DELETE',
    });
  }

  // Resolver Levels
  async getResolverLevels() {
    return this.request('/resolver-levels/');
  }

  async createResolverLevel(data) {
    return this.request('/resolver-levels/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateResolverLevel(id, data) {
    return this.request(`/resolver-levels/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteResolverLevel(id) {
    return this.request(`/resolver-levels/${id}/`, {
      method: 'DELETE',
    });
  }

  // Category Resolvers
  async getCategoryResolvers(page = null, pageSize = null) {
    let url = '/resolver-assignments/';
    const params = new URLSearchParams();

    if (page) params.append('page', page);
    if (pageSize) params.append('page_size', pageSize);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    return this.request(url);
  }

  async getAllCategoryResolvers() {
    let allResolvers = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getCategoryResolvers(page, 50);
      const resolvers = Array.isArray(response)
        ? response
        : Array.isArray(response?.results)
          ? response.results
          : [];

      if (Array.isArray(resolvers)) {
        allResolvers = allResolvers.concat(resolvers);
      } else {
        return { results: [], count: 0 };
      }

      hasMore = Boolean(response && !Array.isArray(response) && response.next);
      page++;
    }

    return { results: allResolvers, count: allResolvers.length };
  }

  async createCategoryResolver(data) {
    return this.request('/resolver-assignments/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategoryResolver(id, data) {
    return this.request(`/resolver-assignments/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCategoryResolver(id) {
    return this.request(`/resolver-assignments/${id}/`, {
      method: 'DELETE',
    });
  }

  // Password reset
  async requestPasswordReset(identifier) {
    return this.request('/accounts/request-password-reset/', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });
  }

  async resetPassword(token, password) {
    return this.request('/accounts/reset-password/', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
      skipAuth: true,
    });
  }

  // Users

  async createUser(data) {
    return this.request('/accounts/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id, data) {
    return this.request(`/accounts/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id) {
    return this.request(`/accounts/${id}/`, {
      method: 'DELETE',
    });
  }

  async getNotifications() {
    return this.request('/notifications/');
  }

  async getUnreadNotifications() {
    return this.request('/notifications/unread/');
  }

  async markNotificationAsRead(id) {
    return this.request(`/notifications/${id}/mark-as-read/`, {
      method: 'POST',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request('/notifications/mark-all-as-read/', {
      method: 'POST',
    });
  }

  async getAppointments() {
    return this.request('/appointments/');
  }

  async createAppointment(data) {
    return this.request('/appointments/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAppointmentStatus(id, statusValue) {
    return this.request(`/appointments/${id}/status/`, {
      method: 'PATCH',
      body: JSON.stringify({ status: statusValue }),
    });
  }

  // Dashboard stats
  async getDashboardStats() {
    const complaintsData = await this.getComplaints();
    const complaints = complaintsData.results || complaintsData;
    const stats = {
      total: complaints.length,
      pending: complaints.filter(c => c.status === 'pending').length,
      resolved: complaints.filter(c => c.status === 'resolved').length,
      urgent: complaints.filter(c => c.priority === 'urgent').length,
    };
    return stats;
  }

  // Public Announcements
  async getPublicAnnouncements() {
    return this.request('/announcements/');
  }

  async createPublicAnnouncement(data) {
    return this.request('/announcements/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePublicAnnouncement(id, data) {
    return this.request(`/announcements/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async hidePublicAnnouncement(id) {
    return this.request(`/announcements/${id}/hide/`, {
      method: 'POST',
    });
  }

  async showPublicAnnouncement(id) {
    return this.request(`/announcements/${id}/show/`, {
      method: 'POST',
    });
  }

  async toggleAnnouncementLike(id) {
    return this.request(`/announcements/${id}/toggle-like/`, {
      method: 'POST',
    });
  }

  async getAnnouncementComments(id) {
    return this.request(`/announcements/${id}/comments/`);
  }

  async addAnnouncementComment(id, message) {
    return this.request(`/announcements/${id}/comments/`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async deletePublicAnnouncement(id) {
    return this.request(`/announcements/${id}/`, {
      method: 'DELETE',
    });
  }

  // Helpdesk
  async getHelpdeskSessions() {
    return this.request('/helpdesk/sessions/');
  }

  async getHelpdeskSessionCandidates() {
    return this.request('/helpdesk/sessions/candidates/');
  }

  async createHelpdeskSession(data) {
    return this.request('/helpdesk/sessions/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getHelpdeskSession(sessionId) {
    return this.request(`/helpdesk/sessions/${sessionId}/`);
  }

  async deleteHelpdeskSession(sessionId) {
    return this.request(`/helpdesk/sessions/${sessionId}/`, {
      method: 'DELETE',
    });
  }

  async getHelpdeskMessages(sessionId) {
    const query = new URLSearchParams({ session_id: sessionId }).toString();
    return this.request(`/helpdesk/messages/?${query}`);
  }

  async createHelpdeskMessage(data) {
    return this.request('/helpdesk/messages/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async startHelpdeskSession(sessionId) {
    return this.request(`/helpdesk/sessions/${sessionId}/start/`, {
      method: 'POST',
    });
  }

  async endHelpdeskSession(sessionId) {
    return this.request(`/helpdesk/sessions/${sessionId}/end/`, {
      method: 'POST',
    });
  }

  async getHelpdeskLivekitToken(sessionId) {
    return this.request(`/helpdesk/sessions/${sessionId}/livekit-token/`, {
      method: 'POST',
    });
  }
}

export default new ApiService();
