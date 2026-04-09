/**
 * @typedef {Object} HelpdeskSession
 * @property {string} id
 * @property {string} title
 * @property {'audio_call'|'video_call'|'audio_conference'|'video_conference'} kind
 * @property {'pending'|'active'|'ended'|'cancelled'} status
 * @property {string} created_at
 * @property {string | null} started_at
 * @property {string | null} ended_at
 * @property {Array<HelpdeskParticipant>} participants
 */

/**
 * @typedef {Object} HelpdeskParticipant
 * @property {number} user_id
 * @property {string} full_name
 * @property {string} role_name
 * @property {'host'|'participant'} role
 * @property {string} joined_at
 * @property {string | null} left_at
 */

/**
 * @typedef {Object} HelpdeskMessage
 * @property {string} id
 * @property {string} session
 * @property {number} sender_id
 * @property {string} sender_name
 * @property {'text'|'signal'|'system'} message_type
 * @property {string} content
 * @property {Object} payload
 * @property {string} created_at
 */

export const HELPDESK_KINDS = [
  { value: 'audio_call', label: 'Audio Call' },
  { value: 'video_call', label: 'Video Call' },
  { value: 'audio_conference', label: 'Audio Conference' },
  { value: 'video_conference', label: 'Video Conference' },
];
