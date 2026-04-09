import React, { useMemo, useState } from 'react';
import { HELPDESK_KINDS } from '../types/helpdeskTypes';

const CreateSessionModal = ({ users = [], onClose, onSubmit, submitting = false, mode = 'modal' }) => {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('video_call');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [startImmediately, setStartImmediately] = useState(true);
  const [openAfterCreate, setOpenAfterCreate] = useState(true);
  const [sendInitialMessage, setSendInitialMessage] = useState(false);
  const [initialMessage, setInitialMessage] = useState('');
  const [error, setError] = useState('');

  const isConference = useMemo(
    () => kind === 'audio_conference' || kind === 'video_conference',
    [kind]
  );

  const toggleUser = (userId) => {
    setSelectedUsers((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      return [...prev, userId];
    });
  };

  const filteredUsers = useMemo(() => {
    const search = participantSearch.trim().toLowerCase();
    return users.filter((user) => {
      const roleMatches = roleFilter === 'all' || (user.role || '').toLowerCase() === roleFilter;
      if (!roleMatches) {
        return false;
      }

      if (!search) {
        return true;
      }

      const fullName = (user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim()).toLowerCase();
      const email = (user.email || '').toLowerCase();
      const role = (user.role || '').toLowerCase();
      return fullName.includes(search) || email.includes(search) || role.includes(search);
    });
  }, [participantSearch, roleFilter, users]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!selectedUsers.length) {
      setError('Select at least one participant.');
      return;
    }

    if (!isConference && selectedUsers.length !== 1) {
      setError('Audio/Video calls require exactly one other participant.');
      return;
    }

    if (sendInitialMessage && !initialMessage.trim()) {
      setError('Please provide an initial message or disable initial message option.');
      return;
    }

    await onSubmit({
      title,
      kind,
      participant_ids: selectedUsers,
      start_immediately: startImmediately,
      open_after_create: openAfterCreate,
      initial_message: sendInitialMessage ? initialMessage.trim() : '',
    });
  };

  const containerClassName = mode === 'page'
    ? 'w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
    : 'w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl';

  const body = (
    <div className={containerClassName}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">
          {mode === 'page' ? 'Create New Session' : 'Create New Helpdesk Session'}
        </h2>
        <button onClick={onClose} className="rounded-md px-3 py-1 text-slate-600 hover:bg-slate-100">
          {mode === 'page' ? 'Back' : 'Close'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Session title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-cyan-500 focus:outline-none"
            placeholder="Student support conversation"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Session type</label>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setSelectedUsers([]);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-cyan-500 focus:outline-none"
          >
            {HELPDESK_KINDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Participants</p>
          <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              placeholder="Search participant"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">All roles</option>
              <option value="user">Students</option>
              <option value="officer">Officers</option>
              <option value="admin">Admins</option>
            </select>
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {filteredUsers.map((user) => {
              const checked = selectedUsers.includes(user.id);
              return (
                <label key={user.id} className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1 hover:bg-slate-50">
                  <span className="text-sm text-slate-700">
                    {user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}
                    <span className="ml-2 text-xs text-slate-500">({user.role || 'member'})</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleUser(user.id)}
                    className="h-4 w-4"
                  />
                </label>
              );
            })}
            {!filteredUsers.length && <p className="text-sm text-slate-500">No available users to invite.</p>}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Calls require 1 participant. Conferences support multiple participants.
          </p>
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-center justify-between text-sm text-slate-700">
            <span>Start session immediately after creation</span>
            <input
              type="checkbox"
              checked={startImmediately}
              onChange={(e) => setStartImmediately(e.target.checked)}
              className="h-4 w-4"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-slate-700">
            <span>Open chat page after create</span>
            <input
              type="checkbox"
              checked={openAfterCreate}
              onChange={(e) => setOpenAfterCreate(e.target.checked)}
              className="h-4 w-4"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-slate-700">
            <span>Send initial message automatically</span>
            <input
              type="checkbox"
              checked={sendInitialMessage}
              onChange={(e) => setSendInitialMessage(e.target.checked)}
              className="h-4 w-4"
            />
          </label>
          {sendInitialMessage && (
            <textarea
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              rows={2}
              placeholder="Type initial message..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
            />
          )}
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">
            {mode === 'page' ? 'Back' : 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Create Session'}
          </button>
        </div>
      </form>
    </div>
  );

  if (mode === 'page') {
    return body;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      {body}
    </div>
  );
};

export default CreateSessionModal;
