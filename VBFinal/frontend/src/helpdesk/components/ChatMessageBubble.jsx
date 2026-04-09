import React from 'react';

const ChatMessageBubble = ({ message, isOwn }) => {
  const time = message?.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${isOwn ? 'rounded-br-sm bg-cyan-600 text-white' : 'rounded-bl-sm bg-white text-slate-800 border border-slate-200'
          }`}
      >
        {!isOwn && <p className="mb-1 text-xs font-semibold text-cyan-700">{message.sender_name || 'Unknown sender'}</p>}
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content || ''}</p>
        <p className={`mt-2 text-[11px] ${isOwn ? 'text-cyan-100' : 'text-slate-500'}`}>{time}</p>
      </div>
    </div>
  );
};

export default ChatMessageBubble;
