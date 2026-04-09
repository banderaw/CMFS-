import React from 'react';
import { useNavigate } from 'react-router-dom';

const kindLabelMap = {
  audio_call: 'Audio Call',
  video_call: 'Video Call',
  audio_conference: 'Audio Conference',
  video_conference: 'Video Conference',
};

const statusClassMap = {
  pending: 'bg-amber-100 text-amber-700',
  active: 'bg-emerald-100 text-emerald-700',
  ended: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

const SessionList = ({
  sessions = [],
  onOpenSession = null,
  onDeleteSession = null,
  canDeleteSession = null,
  deletingSessionId = null,
  emptyText = 'No helpdesk sessions found.',
}) => {
  const navigate = useNavigate();

  if (!sessions.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {sessions.map((session) => {
        const participantCount = Array.isArray(session.participants) ? session.participants.length : 0;
        const previewPeople = Array.isArray(session.participants)
          ? session.participants.slice(0, 3).map((p) => p.full_name).filter(Boolean)
          : [];

        const canDelete = typeof canDeleteSession === 'function' ? canDeleteSession(session) : false;
        const isDeleting = deletingSessionId === session.id;

        return (
          <div
            key={session.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof onOpenSession === 'function') {
                      onOpenSession(session);
                      return;
                    }
                    navigate(`/helpdesk/${session.id}`);
                  }}
                  className="text-left"
                >
                  <h3 className="text-lg font-semibold text-slate-900">{session.title || 'Untitled Session'}</h3>
                  <p className="mt-1 text-sm text-slate-600">{kindLabelMap[session.kind] || session.kind}</p>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassMap[session.status] || 'bg-slate-100 text-slate-700'}`}>
                  {session.status}
                </span>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDeleteSession?.(session)}
                    disabled={isDeleting}
                    className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 text-xs text-slate-500">
              Updated: {new Date(session.updated_at || session.created_at).toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Participants: {participantCount}
              {previewPeople.length > 0 ? ` | ${previewPeople.join(', ')}` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SessionList;
