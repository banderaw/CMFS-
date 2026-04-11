import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Room, RoomEvent, Track } from 'livekit-client';
import { useAuth } from '../../contexts/AuthContext';
import ChatComposer from '../components/ChatComposer';
import ChatMessageBubble from '../components/ChatMessageBubble';
import HelpdeskShell from '../components/HelpdeskShell';
import { useHelpdeskSocket } from '../hooks/useHelpdeskSocket';
import helpdeskApi from '../services/helpdeskApi';


const LivekitTrackTile = ({ publication, participantName, isLocal }) => {
  const mediaRef = useRef(null);
  const track = publication?.track || null;
  const isVideo = publication?.kind === Track.Kind.Video;

  useEffect(() => {
    if (!track || !mediaRef.current) return;
    const mediaElement = mediaRef.current;
    track.attach(mediaElement);
    return () => {
      track.detach(mediaElement);
    };
  }, [track]);

  return (
    <div className="mx-auto w-full max-w-sm rounded-lg border border-slate-200 bg-slate-50 p-2">
      {isVideo ? (
        <video ref={mediaRef} autoPlay playsInline muted={isLocal} className="h-72 w-full rounded bg-slate-100 object-cover" />
      ) : (
        <audio ref={mediaRef} autoPlay muted={isLocal} />
      )}
      <p className="mt-1 text-xs font-semibold text-slate-700">{participantName}{isLocal ? ' (You)' : ''}</p>
      <p className="text-[11px] text-slate-500">{publication?.kind === Track.Kind.Video ? 'Video' : 'Audio'}</p>
    </div>
  );
};

const DEFAULT_LIVEKIT_LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
const DEFAULT_LIVEKIT_FALLBACK_HOSTS = ['127.0.0.1', 'localhost', '0.0.0.0', '::1'];

const parseHostList = (rawValue, fallbackHosts) => {
  const source = (rawValue || '').trim();
  const hosts = source ? source.split(',') : fallbackHosts;
  return hosts.map((host) => host.trim()).filter(Boolean);
};

const LOCAL_HOSTNAMES = new Set(
  parseHostList(import.meta.env.VITE_LIVEKIT_LOCAL_HOSTNAMES, DEFAULT_LIVEKIT_LOCAL_HOSTNAMES),
);
const LIVEKIT_FALLBACK_HOSTS = parseHostList(
  import.meta.env.VITE_LIVEKIT_FALLBACK_HOSTS,
  DEFAULT_LIVEKIT_FALLBACK_HOSTS,
);

const resolveLivekitConnectUrl = (rawUrl) => {
  if (!rawUrl) {
    return rawUrl;
  }

  try {
    const livekitUrl = new URL(rawUrl);
    if (typeof window === 'undefined') {
      return livekitUrl.toString().replace(/\/+$/, '');
    }

    const currentHost = window.location.hostname;
    if (LOCAL_HOSTNAMES.has(livekitUrl.hostname) && currentHost) {
      livekitUrl.hostname = currentHost;
    }

    if (window.location.protocol === 'https:' && livekitUrl.protocol === 'ws:') {
      livekitUrl.protocol = 'wss:';
    }

    return livekitUrl.toString().replace(/\/+$/, '');
  } catch {
    return rawUrl;
  }
};

const buildLocalHostFallbackUrls = (connectUrl) => {
  const fallbacks = [];
  try {
    const parsed = new URL(connectUrl);
    if (!LOCAL_HOSTNAMES.has(parsed.hostname)) {
      return fallbacks;
    }

    const alternateHosts = LIVEKIT_FALLBACK_HOSTS.filter((host) => host !== parsed.hostname);
    alternateHosts.forEach((host) => {
      const nextUrl = new URL(parsed.toString());
      nextUrl.hostname = host;
      fallbacks.push(nextUrl.toString().replace(/\/+$/, ''));
    });
  } catch {
    return [];
  }
  return fallbacks;
};

const formatMediaDeviceError = (err, label) => {
  const code = err?.name || err?.code || '';
  const message = (err?.message || '').toLowerCase();

  if (code === 'NotAllowedError' || message.includes('permission')) {
    return `${label} permission was denied. Allow ${label.toLowerCase()} access in browser site settings and retry.`;
  }
  if (code === 'NotFoundError' || message.includes('not found') || message.includes('no device')) {
    return `No ${label.toLowerCase()} device was found. Connect a device and retry.`;
  }
  if (code === 'NotReadableError' || message.includes('in use')) {
    return `${label} is busy in another app or browser tab. Close other apps using it and retry.`;
  }

  return err?.message || `Unable to start ${label.toLowerCase()}.`;
};

const requestCameraAccess = async () => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera access is not supported in this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  stream.getTracks().forEach((track) => track.stop());
};

const ChatPage = () => {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const bottomRef = useRef(null);
  const roomRef = useRef(null);

  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [conferenceError, setConferenceError] = useState('');
  const [updatingSession, setUpdatingSession] = useState(false);
  const [conferenceStatus, setConferenceStatus] = useState('idle');
  const [conferenceConnected, setConferenceConnected] = useState(false);
  const [participantTracks, setParticipantTracks] = useState([]);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [cameraPermissionBlocked, setCameraPermissionBlocked] = useState(false);
  const canConnectRealtime = !loading && !error && Boolean(session?.id);
  const supportsLivekit = ['audio_call', 'video_call', 'audio_conference', 'video_conference'].includes(session?.kind);
  const isVideoSession = ['video_call', 'video_conference'].includes(session?.kind);

  const appendIfMissing = (incoming) => {
    setMessages((prev) => {
      if (prev.some((item) => item.id === incoming.id)) {
        return prev;
      }
      return [...prev, incoming];
    });
  };

  const rebuildParticipantTracks = (room) => {
    const nextTracks = [];

    if (room.localParticipant) {
      room.localParticipant.trackPublications.forEach((publication) => {
        if (publication.track && (publication.kind === Track.Kind.Video || publication.kind === Track.Kind.Audio)) {
          nextTracks.push({
            key: `local-${publication.trackSid}`,
            isLocal: true,
            participantName: room.localParticipant.name || 'You',
            publication,
          });
        }
      });
    }

    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        if (publication.track && (publication.kind === Track.Kind.Video || publication.kind === Track.Kind.Audio)) {
          nextTracks.push({
            key: `${participant.identity}-${publication.trackSid}`,
            isLocal: false,
            participantName: participant.name || participant.identity,
            publication,
          });
        }
      });
    });

    setParticipantTracks(nextTracks);
  };

  const { isConnected, connectionError, send } = useHelpdeskSocket({
    sessionId,
    enabled: canConnectRealtime,
    onMessage: (payload) => {
      if (payload?.type !== 'chat.message') {
        return;
      }
      if (payload?.message) {
        appendIfMissing(payload.message);
      }
    },
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [sessionPayload, messagePayload] = await Promise.all([
          helpdeskApi.getSession(sessionId),
          helpdeskApi.getMessages(sessionId),
        ]);
        setSession(sessionPayload);
        setMessages(messagePayload);
      } catch (err) {
        setError(err.message || 'Failed to load chat session.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [sessionId]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [messages]);

  const visibleMessages = useMemo(() => {
    return sortedMessages.filter((message) => message.message_type !== 'signal');
  }, [sortedMessages]);

  const handleSend = async (text) => {
    setSendError('');

    const payload = {
      type: 'chat.message',
      message_type: 'text',
      content: text,
      payload: {},
    };

    const wsSent = send(payload);
    if (wsSent) {
      return;
    }

    try {
      const created = await helpdeskApi.postMessage(sessionId, {
        message_type: 'text',
        content: text,
        payload: {},
      });
      appendIfMissing(created);
    } catch (err) {
      setSendError(err.message || 'Failed to send message.');
    }
  };

  const handleStartSession = async () => {
    if (!session) return;
    setUpdatingSession(true);
    try {
      const updated = await helpdeskApi.startSession(session.id);
      setSession(updated);
    } catch (err) {
      setSendError(err.message || 'Failed to start session.');
    } finally {
      setUpdatingSession(false);
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    setUpdatingSession(true);
    try {
      const updated = await helpdeskApi.endSession(session.id);
      setSession(updated);
    } catch (err) {
      setSendError(err.message || 'Failed to end session.');
    } finally {
      setUpdatingSession(false);
    }
  };

  const handleJoinConference = async () => {
    if (!session?.id) return;
    if (conferenceStatus === 'connecting') return;
    if (conferenceConnected) return;
    if (!supportsLivekit) {
      setConferenceError('This session type does not use multi-user conference mode.');
      return;
    }

    try {
      setConferenceStatus('connecting');
      setConferenceError('');

      if (roomRef.current) {
        roomRef.current.disconnect(true);
        roomRef.current = null;
      }

      const tokenPayload = await helpdeskApi.getLivekitToken(session.id);
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, () => rebuildParticipantTracks(room));
      room.on(RoomEvent.TrackUnsubscribed, () => rebuildParticipantTracks(room));
      room.on(RoomEvent.ParticipantConnected, () => rebuildParticipantTracks(room));
      room.on(RoomEvent.ParticipantDisconnected, () => rebuildParticipantTracks(room));
      room.on(RoomEvent.LocalTrackPublished, () => rebuildParticipantTracks(room));
      room.on(RoomEvent.LocalTrackUnpublished, () => rebuildParticipantTracks(room));
      room.on(RoomEvent.Disconnected, () => {
        setConferenceConnected(false);
        setConferenceStatus('disconnected');
        setParticipantTracks([]);
      });

      const primaryConnectUrl = resolveLivekitConnectUrl(tokenPayload.url);
      const candidateUrls = [primaryConnectUrl, ...buildLocalHostFallbackUrls(primaryConnectUrl)];

      let connected = false;
      let lastConnectError = null;
      for (const url of candidateUrls) {
        try {
          await room.connect(url, tokenPayload.token);
          connected = true;
          break;
        } catch (connectErr) {
          lastConnectError = connectErr;
        }
      }

      if (!connected) {
        throw lastConnectError || new Error('Failed to connect to LiveKit room.');
      }
      setConferenceConnected(true);
      setConferenceStatus('connected');
      rebuildParticipantTracks(room);

      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMicMuted(false);
      } catch (micErr) {
        setIsMicMuted(true);
        setConferenceError(formatMediaDeviceError(micErr, 'Microphone'));
      }

      if (isVideoSession) {
        try {
          await requestCameraAccess();
          await room.localParticipant.setCameraEnabled(true);
          setIsCameraEnabled(true);
          setCameraPermissionBlocked(false);
          rebuildParticipantTracks(room);
        } catch (camErr) {
          setIsCameraEnabled(false);
          setCameraPermissionBlocked(camErr?.name === 'NotAllowedError' || `${camErr?.message || ''}`.toLowerCase().includes('permission'));
          setConferenceError(formatMediaDeviceError(camErr, 'Camera'));
        }
      } else {
        setIsCameraEnabled(false);
        setCameraPermissionBlocked(false);
      }
    } catch (err) {
      setConferenceError(err.message || 'Failed to join conference.');
      setConferenceStatus('failed');
    }
  };

  const handleLeaveConference = async () => {
    if (roomRef.current) {
      roomRef.current.disconnect(true);
      roomRef.current = null;
    }
    setParticipantTracks([]);
    setConferenceConnected(false);
    setConferenceStatus('disconnected');
    setIsMicMuted(false);
    setIsCameraEnabled(false);
    setCameraPermissionBlocked(false);
  };

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    const shouldEnable = isMicMuted;
    try {
      await room.localParticipant.setMicrophoneEnabled(shouldEnable);
      setIsMicMuted(!shouldEnable);
    } catch (err) {
      setConferenceError(err.message || 'Unable to change microphone state.');
    }
  };

  const toggleCamera = async () => {
    if (!isVideoSession) {
      setConferenceError('Camera is not enabled for audio sessions.');
      return;
    }

    const room = roomRef.current;
    if (!room) return;
    const shouldEnable = !isCameraEnabled;

    try {
      await room.localParticipant.setCameraEnabled(shouldEnable);
      setIsCameraEnabled(shouldEnable);
      setCameraPermissionBlocked(false);
      rebuildParticipantTracks(room);
    } catch (err) {
      if (shouldEnable && (err?.name === 'NotAllowedError' || `${err?.message || ''}`.toLowerCase().includes('permission'))) {
        setCameraPermissionBlocked(true);
      }
      setConferenceError(err.message || 'Unable to change camera state.');
    }
  };

  const handleAllowCameraAccess = async () => {
    const room = roomRef.current;
    if (!room || !conferenceConnected || !isVideoSession) return;

    try {
      setConferenceError('');
      await requestCameraAccess();
      await room.localParticipant.setCameraEnabled(true);
      setIsCameraEnabled(true);
      setCameraPermissionBlocked(false);
      rebuildParticipantTracks(room);
    } catch (err) {
      if (err?.name === 'NotAllowedError' || `${err?.message || ''}`.toLowerCase().includes('permission')) {
        setCameraPermissionBlocked(true);
      }
      setConferenceError(formatMediaDeviceError(err, 'Camera'));
    }
  };

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect(true);
        roomRef.current = null;
      }
    };
  }, []);

  const participants = Array.isArray(session?.participants) ? session.participants : [];

  return (
    <HelpdeskShell activeItem="sessions">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Helpdesk Chat</p>
                <h1 className="text-lg font-semibold text-slate-900">{session?.title || 'Session Conversation'}</h1>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className={`rounded-full px-3 py-1 font-semibold ${isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isConnected ? 'Realtime Connected' : 'Realtime Reconnecting'}
                </span>
                <Link to="/helpdesk" className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100">
                  Back to Sessions
                </Link>
              </div>
            </div>
            {connectionError && <p className="mt-2 text-xs text-amber-700">{connectionError}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={handleStartSession}
                disabled={updatingSession || session?.status === 'active'}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Start Session
              </button>
              <button
                onClick={handleEndSession}
                disabled={updatingSession || session?.status === 'ended'}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                End Session
              </button>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                Status: {session?.status || 'unknown'}
              </span>
            </div>
          </div>

          <div className="h-[60vh] overflow-y-auto bg-gradient-to-b from-slate-100 to-slate-50 p-4">
            {loading && <p className="text-center text-slate-500">Loading chat...</p>}
            {!loading && error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            {!loading && !error && sortedMessages.length === 0 && (
              <p className="text-center text-slate-500">No messages yet. Start the conversation.</p>
            )}
            {!loading &&
              !error &&
              visibleMessages.map((message) => (
                <ChatMessageBubble
                  key={message.id}
                  message={message}
                  isOwn={String(message.sender_id) === String(user?.id)}
                />
              ))}
            <div ref={bottomRef} />
          </div>

          {sendError && <p className="px-4 py-2 text-sm text-rose-700">{sendError}</p>}
          <ChatComposer onSend={handleSend} disabled={!!error || session?.status === 'ended'} />
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Conference</h2>
          <div className="mt-3 space-y-3">
            {!supportsLivekit && (
              <p className="text-xs text-slate-600">
                This session type does not support LiveKit connection.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleJoinConference}
                disabled={!supportsLivekit || conferenceConnected || conferenceStatus === 'connecting'}
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Join Conference
              </button>
              <button
                onClick={handleLeaveConference}
                disabled={!conferenceConnected}
                className="rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Leave Conference
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={toggleMic}
                disabled={!conferenceConnected}
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
              </button>
              <button
                onClick={toggleCamera}
                disabled={!conferenceConnected || !isVideoSession}
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {isCameraEnabled ? 'Turn Camera Off' : cameraPermissionBlocked ? 'Allow Camera Access' : 'Turn Camera On'}
              </button>
            </div>

            {cameraPermissionBlocked && isVideoSession && conferenceConnected && !isCameraEnabled && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Camera access is blocked. Click Allow Camera Access and approve the browser prompt, or enable camera access in your browser site settings.
                <div className="mt-2">
                  <button
                    onClick={handleAllowCameraAccess}
                    className="rounded-md bg-amber-600 px-2.5 py-1.5 font-semibold text-white hover:bg-amber-700"
                  >
                    Ask for Camera Access Again
                  </button>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-600">Conference state: {conferenceStatus.replace('_', ' ')}</p>
            {conferenceError && <p className="text-xs text-rose-700">{conferenceError}</p>}

            {conferenceConnected && (
              <div className="grid grid-cols-1 gap-2">
                {participantTracks.length === 0 && (
                  <p className="text-xs text-slate-500">Connected. Waiting for participant media tracks...</p>
                )}
                {participantTracks.map((item) => (
                  <LivekitTrackTile
                    key={item.key}
                    publication={item.publication}
                    participantName={item.participantName}
                    isLocal={item.isLocal}
                  />
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-500">
              Multi-user conference runs on LiveKit SFU. Ensure LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET are configured in backend.
            </p>
          </div>

          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Session Details</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p><span className="font-semibold">Type:</span> {session?.kind || 'N/A'}</p>
            <p><span className="font-semibold">Participants:</span> {participants.length}</p>
            <p><span className="font-semibold">Created:</span> {session?.created_at ? new Date(session.created_at).toLocaleString() : 'N/A'}</p>
          </div>

          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">People</h3>
          <div className="mt-2 space-y-2">
            {participants.length === 0 && <p className="text-sm text-slate-500">No participants available.</p>}
            {participants.map((participant) => (
              <div key={`${participant.user_id}-${participant.joined_at}`} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">{participant.full_name || 'Unknown user'}</p>
                <p className="text-xs text-slate-500">{participant.role_name || 'member'} | {participant.role}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </HelpdeskShell>
  );
};

export default ChatPage;
