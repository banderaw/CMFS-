import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';
import { openRealtimeSocket } from '../../services/realtime';

const formatTime = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const ComplaintConversation = ({ complaint, role = 'user' }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const complaintId = complaint?.complaint_id;
  const [responses, setResponses] = useState([]);
  const [comments, setComments] = useState([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [draftTitle, setDraftTitle] = useState('Officer Response');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connectionState, setConnectionState] = useState('connecting');
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const listRef = useRef(null);
  const fallbackTimerRef = useRef(null);

  const loadThread = useCallback(async () => {
    if (!complaintId) return;

    try {
      const [responsesData, commentsData] = await Promise.all([
        apiService.getComplaintResponses(complaintId),
        apiService.getComplaintComments(complaintId),
      ]);

      setResponses(responsesData.results ?? responsesData ?? []);
      setComments(commentsData.results ?? commentsData ?? []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load complaint conversation');
      setResponses([]);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    if (!complaintId) return;

    let mounted = true;
    setLoading(true);
    setConnectionState('connecting');
    loadThread();

    const socket = openRealtimeSocket(`/ws/complaints/${complaintId}/`, {
      onOpen: () => {
        if (mounted) setConnectionState('live');
      },
      onMessage: (event) => {
        if (!mounted) return;
        try {
          const payload = JSON.parse(event.data);
          if (['thread.snapshot', 'thread.updated', 'chat.created', 'notification.updated'].includes(payload.type)) {
            loadThread();
          }
          if (payload.type === 'error' && payload.message) {
            setError(payload.message);
          }
        } catch {
          loadThread();
        }
      },
      onClose: () => {
        if (mounted) setConnectionState('polling');
      },
      onError: () => {
        if (mounted) setConnectionState('polling');
      },
    });

    socketRef.current = socket;
    fallbackTimerRef.current = setInterval(loadThread, 15000);

    return () => {
      mounted = false;
      if (socket) socket.close();
      if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
    };
  }, [complaintId, loadThread]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [responses, comments]);

  const threadMessages = useMemo(() => {
    const responseMessages = responses.map((response) => ({
      id: response.id,
      kind: 'response',
      author: response.responder,
      message: response.message,
      title: response.title,
      response_type: response.response_type,
      created_at: response.created_at,
      updated_at: response.updated_at,
      own: response.responder?.id === user?.id,
    }));

    const commentMessages = comments.map((comment) => ({
      id: comment.id,
      kind: 'comment',
      author: comment.author,
      message: comment.message,
      title: null,
      response_type: comment.comment_type,
      rating: comment.rating,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      own: comment.author?.id === user?.id,
    }));

    return [...responseMessages, ...commentMessages].sort(
      (left, right) => new Date(left.created_at) - new Date(right.created_at),
    );
  }, [responses, comments, user?.id]);

  const sendOverSocket = useCallback((payload) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const submitMessage = async () => {
    const message = draftMessage.trim();
    if (!message) return;
    if (role === 'user' && responses.length === 0) {
      setError('You can comment after an officer responds to your complaint.');
      return;
    }

    setSending(true);
    try {
      const sent = sendOverSocket({
        type: 'chat.message',
        kind: role === 'user' ? 'comment' : 'response',
        complaint_id: complaintId,
        title: role === 'user' ? undefined : (draftTitle || 'Officer Response'),
        message,
        response_type: 'update',
      });

      if (!sent) {
        if (role === 'user') {
          await apiService.createComment({
            complaint: complaintId,
            message,
            comment_type: 'comment',
          });
        } else {
          await apiService.createResponse({
            complaint: complaintId,
            title: draftTitle || 'Officer Response',
            message,
            response_type: 'update',
            is_public: true,
          });
        }
      }

      setDraftMessage('');
      if (role !== 'user') {
        setDraftTitle('Officer Response');
      }
      await loadThread();
    } catch (err) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const editMessage = async (item) => {
    const nextMessage = window.prompt('Edit message', item.message);
    if (nextMessage == null) return;
    const trimmed = nextMessage.trim();
    if (!trimmed || trimmed === item.message) return;

    try {
      if (item.kind === 'comment') {
        await apiService.updateComment(item.id, { message: trimmed });
      } else {
        await apiService.updateResponse(item.id, {
          title: item.title || 'Officer Response',
          message: trimmed,
          response_type: item.response_type || 'update',
          is_public: true,
        });
      }
      await loadThread();
    } catch (err) {
      setError(err.message || 'Failed to update message');
    }
  };

  const deleteMessage = async (item) => {
    if (!window.confirm('Delete this message?')) return;

    try {
      if (item.kind === 'comment') {
        await apiService.deleteComment(item.id);
      } else {
        await apiService.deleteResponse(item.id);
      }
      await loadThread();
    } catch (err) {
      setError(err.message || 'Failed to delete message');
    }
  };

  const canComment = role === 'user';
  const canRespond = role === 'officer' || role === 'admin';

  if (loading) {
    return (
      <div className={`p-4 rounded-xl border ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading  conversation...</div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} shadow-sm`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div>
          <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}> Conversation</h4>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            status: {connectionState}
          </p>
        </div>
        <button
          onClick={loadThread}
          className={`px-3 py-1 rounded-md text-sm ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className={`m-4 p-3 rounded-lg text-sm ${isDark ? 'bg-red-900/30 text-red-200' : 'bg-red-50 text-red-700'}`}>
          {error}
        </div>
      )}

      <div ref={listRef} className="max-h-[32rem] overflow-y-auto px-4 py-4 space-y-4">
        {threadMessages.length === 0 ? (
          <div className={`rounded-lg border border-dashed p-6 text-center ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
            No conversation yet.
          </div>
        ) : (
          threadMessages.map((item) => {
            const bubbleAlign = item.kind === 'response' ? 'justify-end' : 'justify-start';
            const bubbleTone = item.kind === 'response'
              ? isDark
                ? 'bg-blue-900/30 border-blue-700 text-blue-100'
                : 'bg-blue-50 border-blue-200 text-blue-900'
              : isDark
                ? 'bg-gray-700 border-gray-600 text-gray-100'
                : 'bg-gray-50 border-gray-200 text-gray-800';

            return (
              <div key={`${item.kind}-${item.id}`} className={`flex ${bubbleAlign}`}>
                <div className={`w-full max-w-2xl rounded-2xl border px-4 py-3 ${bubbleTone}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {item.kind === 'response' ? 'Officer response' : 'User comment'}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${isDark ? 'bg-black/20 text-gray-200' : 'bg-white text-gray-600'}`}>
                          {formatTime(item.created_at)}
                        </span>
                      </div>
                      <p className={`mt-1 text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                        By {item.author?.first_name || item.author?.username || 'Unknown'} {item.author?.last_name || ''}
                      </p>
                    </div>
                    {item.own && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => editMessage(item)}
                          className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-600'}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMessage(item)}
                          className={`text-xs ${isDark ? 'text-red-300' : 'text-red-600'}`}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.message}</p>
                  {item.kind === 'response' && item.title && (
                    <p className={`mt-2 text-xs font-medium ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>
                      {item.title}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={`px-4 py-4 border-t space-y-3 ${isDark ? 'border-gray-700 bg-gray-800/90' : 'border-gray-200 bg-gray-50'}`}>
        {canComment && responses.length === 0 && (
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            You can reply once an officer responds to your complaint.
          </div>
        )}

        {canRespond && (
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            placeholder="Response title"
          />
        )}

        <textarea
          value={draftMessage}
          onChange={(e) => setDraftMessage(e.target.value)}
          rows={4}
          disabled={canComment && responses.length === 0}
          className={`w-full rounded-xl border px-3 py-3 text-sm outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} disabled:opacity-60`}
          placeholder={canRespond
            ? 'Write an officer response...'
            : 'Write a reply to the officer...'}
        />

        <div className="flex items-center justify-between gap-3">
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {threadMessages.length} message{threadMessages.length === 1 ? '' : 's'} in this thread
          </div>
          <button
            onClick={submitMessage}
            disabled={sending || !draftMessage.trim() || (canComment && responses.length === 0)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? 'Sending...' : canRespond ? 'Send response' : 'Send comment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComplaintConversation;
