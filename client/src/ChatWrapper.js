import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Chat from './Chat';

// Generate a unique chat ID
function generateChatId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function ChatWrapper() {
  const { chatId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // If no chatId in URL, redirect to new chat
    if (!chatId) {
      const newChatId = generateChatId();
      navigate(`/chat/${newChatId}`, { replace: true });
    }
  }, [chatId, navigate]);

  // Don't render until we have a chatId
  if (!chatId) {
    return (
      <div className="h-screen flex items-center justify-center bg-transparent">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-4">✨</div>
          <p className="text-gray-600">Starting your magical journey...</p>
        </div>
      </div>
    );
  }

  return <Chat chatId={chatId} />;
}

export default ChatWrapper;