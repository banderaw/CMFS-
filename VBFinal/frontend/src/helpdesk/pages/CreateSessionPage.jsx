import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import CreateSessionModal from '../components/CreateSessionModal';
import HelpdeskShell from '../components/HelpdeskShell';
import helpdeskApi from '../services/helpdeskApi';

const CreateSessionPage = () => {
  const { getUserRole, user } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError('');
    try {
      const role = getUserRole();
      const response = await helpdeskApi.getSessionCandidates();
      const allUsers = Array.isArray(response?.results) ? response.results : Array.isArray(response) ? response : [];

      const candidates = allUsers
        .filter((item) => item.id !== user?.id)
        .filter((item) => {
          if (role === 'user') {
            return item.role === 'officer' || item.role === 'admin';
          }
          return item.role === 'user' || item.role === 'officer' || item.role === 'admin';
        });

      setUsers(candidates);
    } catch (err) {
      setError(err.message || 'Failed to load users for session creation.');
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [getUserRole, user?.id]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreateSession = async (payload) => {
    const {
      start_immediately: startImmediately,
      open_after_create: openAfterCreate,
      initial_message: initialMessage,
      ...sessionPayload
    } = payload;

    setSubmitting(true);
    setError('');
    try {
      const created = await helpdeskApi.createSession(sessionPayload);

      if (startImmediately) {
        await helpdeskApi.startSession(created.id);
      }

      if (initialMessage) {
        await helpdeskApi.postMessage(created.id, {
          message_type: 'text',
          content: initialMessage,
          payload: { source: 'create-session-option' },
        });
      }

      if (openAfterCreate) {
        navigate(`/helpdesk/${created.id}`);
        return;
      }

      navigate('/helpdesk');
    } catch (err) {
      setError(err.message || 'Failed to create helpdesk session.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <HelpdeskShell activeItem="new">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Create New Session</h1>
            <p className="text-sm text-slate-600 mt-1">Configure participants and backend options before starting the conversation.</p>
          </div>
          <button
            onClick={() => navigate('/helpdesk')}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Sessions
          </button>
        </div>

        {loadingUsers && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600">Loading users...</div>
        )}

        {!loadingUsers && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>
        )}

        {!loadingUsers && (
          <CreateSessionModal
            mode="page"
            users={users}
            submitting={submitting}
            onClose={() => navigate('/helpdesk')}
            onSubmit={handleCreateSession}
          />
        )}
      </div>
    </HelpdeskShell>
  );
};

export default CreateSessionPage;
