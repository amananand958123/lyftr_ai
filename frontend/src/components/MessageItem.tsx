import React from 'react';
import { Bot, User, AlertTriangle } from 'lucide-react';
import { ChatMessage } from '../types';
import { MetadataBadge } from './MetadataBadge';

interface MessageItemProps {
  message: ChatMessage;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = message.isError;

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-fadeIn">
        <div className="flex gap-2.5 max-w-[85%] sm:max-w-[75%] items-start flex-row-reverse">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 shadow-md border border-indigo-400/30">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="bg-indigo-600/90 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm font-sans text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message container (MUST contain data-testid="assistant-message")
  return (
    <div className="flex justify-start mb-5 animate-fadeIn">
      <div
        data-testid="assistant-message"
        className={`flex gap-3 max-w-[90%] sm:max-w-[80%] items-start ${
          isError ? 'w-full' : ''
        }`}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md border ${
          isError
            ? 'bg-rose-950 border-rose-800 text-rose-400'
            : 'bg-slate-900 border-slate-700 text-indigo-400'
        }`}>
          {isError ? <AlertTriangle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>

        <div className={`flex-1 rounded-2xl rounded-tl-sm px-4 py-3 shadow-md border ${
          isError
            ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
            : 'bg-slate-900/90 border-slate-800 text-slate-200'
        }`}>
          <div className="font-sans text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </div>

          {message.metadata && (
            <MetadataBadge metadata={message.metadata} />
          )}
        </div>
      </div>
    </div>
  );
};
