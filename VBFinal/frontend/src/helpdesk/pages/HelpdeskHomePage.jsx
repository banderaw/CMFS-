import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import SessionList from '../components/SessionList';
import helpdeskApi from '../services/helpdeskApi';
import HelpdeskShell from '../components/HelpdeskShell';

const HelpdeskHomePage = () => {
  const { getUserRole, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const role = getUserRole();
  const isStudent = role === 'user';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletingSessionId, setDeletingSessionId] = useState(null);

  const loadSessions = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await helpdeskApi.getSessions();
      setSessions(payload);
    } catch (err) {
      setError(err.message || 'Failed to load helpdesk sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const pageTitle = useMemo(() => {
    if (isStudent) return 'My Helpdesk Sessions';
    if (role === 'officer') return 'Assigned Helpdesk Sessions';
    return 'Helpdesk Sessions';
  }, [isStudent, role]);

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((session) => {
      const statusMatch = statusFilter === 'all' || session.status === statusFilter;
      if (!statusMatch) return false;
      if (!q) return true;

      const participantNames = Array.isArray(session.participants)
        ? session.participants.map((p) => p.full_name || '').join(' ').toLowerCase()
        : '';

      return (
        (session.title || '').toLowerCase().includes(q) ||
        (session.kind || '').toLowerCase().includes(q) ||
        participantNames.includes(q)
      );
    });
  }, [query, sessions, statusFilter]);

  const stats = useMemo(() => {
    const all = sessions.length;
    const active = sessions.filter((s) => s.status === 'active').length;
    const pending = sessions.filter((s) => s.status === 'pending').length;
    const ended = sessions.filter((s) => s.status === 'ended').length;
    return { all, active, pending, ended };
  }, [sessions]);

  const canDeleteSession = (session) => {
    if (!session) return false;
    return Boolean(isAdmin?.() || String(session.created_by_id) === String(user?.id));
  };

  const handleDeleteSession = async (session) => {
    if (!session?.id) return;
    if (!canDeleteSession(session)) {
      setError('Only the session creator or admins can delete this session.');
      return;
    }

    const confirmed = window.confirm(`Delete session \"${session.title || 'Untitled Session'}\"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingSessionId(session.id);
    setError('');

    try {
      await helpdeskApi.deleteSession(session.id);
      setSessions((prev) => prev.filter((item) => item.id !== session.id));
    } catch (err) {
      setError(err.message || 'Failed to delete session.');
    } finally {
      setDeletingSessionId(null);
    }
  };

  return (
    <HelpdeskShell activeItem="sessions">
      <div className="space-y-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
            <p className="mt-1 text-sm text-slate-600">Connect instantly with students, officers, and admins.</p>
          </div>

          <button
            onClick={() => navigate('/helpdesk/new')}
            className="rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-cyan-700"
          >
            Create New Session
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stats.all}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Active</p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">{stats.active}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-amber-700">Pending</p>
            <p className="mt-1 text-2xl font-bold text-amber-800">{stats.pending}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-600">Ended</p>
            <p className="mt-1 text-2xl font-bold text-slate-700">{stats.ended}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, type, participant"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="ended">Ended</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              onClick={loadSessions}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh Sessions
            </button>
          </div>
        </div>

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">Loading sessions...</div>
        )}

        {!loading && error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>
        )}

        {!loading && !error && (
          <SessionList
            sessions={filteredSessions}
            emptyText="No sessions match your current filters."
            onOpenSession={(session) => navigate(`/helpdesk/${session.id}`)}
            onDeleteSession={handleDeleteSession}
            canDeleteSession={canDeleteSession}
            deletingSessionId={deletingSessionId}
          />
        )}
      </div>
    </HelpdeskShell>
  );
};

export default HelpdeskHomePage;
