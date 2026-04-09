import apiService from '../../services/api';

const normalizeList = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.results)) {
    return payload.results;
  }
  return [];
};

const helpdeskApi = {
  async getSessions() {
    const response = await apiService.getHelpdeskSessions();
    return normalizeList(response);
  },

  async getSessionCandidates() {
    const response = await apiService.getHelpdeskSessionCandidates();
    return normalizeList(response);
  },

  async createSession(data) {
    return apiService.createHelpdeskSession(data);
  },

  async getSession(sessionId) {
    return apiService.getHelpdeskSession(sessionId);
  },

  async deleteSession(sessionId) {
    return apiService.deleteHelpdeskSession(sessionId);
  },

  async getMessages(sessionId) {
    const response = await apiService.getHelpdeskMessages(sessionId);
    return normalizeList(response);
  },

  async postMessage(sessionId, payload) {
    return apiService.createHelpdeskMessage({
      session: sessionId,
      ...payload,
    });
  },

  async startSession(sessionId) {
    return apiService.startHelpdeskSession(sessionId);
  },

  async endSession(sessionId) {
    return apiService.endHelpdeskSession(sessionId);
  },

  async getLivekitToken(sessionId) {
    return apiService.getHelpdeskLivekitToken(sessionId);
  },
};

export default helpdeskApi;
