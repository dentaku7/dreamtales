import React, { useState, useEffect, useRef } from 'react';

// Get API base URL - point to backend server in dev, same origin in production
const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Send initial welcome message
  const sendWelcomeMessage = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: "Hello! I'd like to hear a bedtime story." }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setMessages(data.chatHistory);
      setIsConnected(true);
    } catch (error) {
      console.error('Error sending welcome message:', error);
      setError('Welcome message failed. You can still start typing to begin.');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
      setHasInitialized(true);
    }
  };

  // Fetch chat history on component mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/history`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.length === 0 && !hasInitialized) {
          // No existing chat history, send welcome message
          await sendWelcomeMessage();
        } else {
          setMessages(data);
          setHasInitialized(true);
        }
        setIsConnected(true);
      } catch (error) {
        console.error('Error fetching history:', error);
        setError('Failed to load chat history. You can still start a new conversation.');
        setIsConnected(false);
        setHasInitialized(true);
      }
    };

    if (!hasInitialized) {
      fetchHistory();
    }
  }, [hasInitialized]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    
    // Validate message length
    if (userMessage.length > 2000) {
      setError('Message too long. Please keep it under 2000 characters.');
      return;
    }

    // Add user message to state immediately
    const newUserMessage = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, newUserMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setMessages(data.chatHistory);
      setIsConnected(true);
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error.message);
      setIsConnected(false);
      
      // Add error message to chat
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: `Sorry, I'm having trouble connecting right now. Please try again in a moment.`,
          isError: true
        }
      ]);
    } finally {
      setIsLoading(false);
      // Refocus input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleNewStory = async () => {
    if (!window.confirm('Are you sure you want to start a new story? This will clear the current conversation.')) {
      return;
    }

    try {
      // Clear history on server
      const response = await fetch(`${API_BASE}/api/history`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Reset local state
      setMessages([]);
      setError(null);
      setIsConnected(true);
      setHasInitialized(false);
      
      // Send new welcome message
      await sendWelcomeMessage();
      
    } catch (error) {
      console.error('Error starting new story:', error);
      setError('Failed to start new story. Try refreshing the page.');
      setIsConnected(false);
    }
  };

  const formatMessage = (content) => {
    // Simple formatting for better readability
    return content.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <div className="h-screen flex flex-col bg-transparent">
      {/* Header */}
      <header className="glass-effect px-5 py-4 flex justify-between items-center shadow-lg sticky top-0 z-50">
        <div className="flex flex-col items-start">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent m-0">
            ✨ DreamTales
          </h1>
          <p className="text-gray-600 text-sm mt-1 m-0">Your magical bedtime story companion</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-black/5 ${
            isConnected ? 'text-green-600' : 'text-red-500'
          }`}>
            <span className={`w-2 h-2 rounded-full animate-pulse-glow ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></span>
            {isConnected ? 'Connected' : 'Offline'}
          </div>
          <button 
            onClick={handleNewStory} 
            className="btn-secondary text-sm"
            title="Start a new story"
          >
            🌟 New Story
          </button>
        </div>
      </header>

      {/* Chat Container */}
      <div className="flex-1 flex flex-col p-5 overflow-hidden max-w-4xl mx-auto w-full">
        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 glass-effect p-3 rounded-xl mb-4 text-sm shadow-lg">
            <span className="text-lg">⚠️</span>
            {error}
            <button 
              className="ml-auto text-red-600 hover:opacity-70 transition-opacity p-0 bg-none border-none text-xl cursor-pointer"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* Messages */}
        <div 
          className="flex-1 overflow-y-auto mb-5 p-5 glass-effect rounded-2xl shadow-lg scrollbar-thin scrollbar-thumb-primary-300 scrollbar-track-transparent"
          role="log" 
          aria-live="polite"
        >
          {messages.length === 0 && !isLoading && hasInitialized && (
            <div className="text-center py-10 text-gray-600">
              <div>
                <h2 className="text-xl text-gray-800 mb-4">Welcome to DreamTales! 🌙</h2>
                <p className="mb-4 leading-relaxed">Something went wrong with the welcome message. Please type "Hello" to get started!</p>
              </div>
            </div>
          )}

          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex gap-3 my-4 animate-slide-in ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 shadow-lg ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                  : 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white'
              }`}>
                {msg.role === 'user' ? '👤' : '🌟'}
              </div>
              <div className="flex-1 max-w-[calc(100%-60px)]">
                <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white'
                    : msg.isError
                    ? 'bg-red-50 border border-red-200 text-red-700'
                    : 'bg-gray-50/80'
                }`}>
                  {formatMessage(msg.content)}
                </div>
                <div className={`text-xs text-gray-500 mt-1 ${
                  msg.role === 'user' ? 'text-left' : 'text-right'
                }`}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 my-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white flex items-center justify-center text-xl flex-shrink-0 shadow-lg">
                🌟
              </div>
              <div className="flex-1">
                <div className="p-3 bg-gray-50/80 rounded-2xl">
                  <div className="flex gap-1 p-3 mb-2">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0s'}}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {messages.length === 0 ? 'Preparing your magical welcome...' : 'Creating your story...'}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex gap-3 glass-effect p-4 rounded-2xl shadow-lg">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Tell me about yourself or ask for a story..."
              className="w-full p-3 border-2 border-primary-200 rounded-2xl text-base bg-white transition-all focus:outline-none focus:border-primary-500 focus:ring-3 focus:ring-primary-100 disabled:bg-gray-100 disabled:text-gray-500"
              disabled={isLoading}
              maxLength={2000}
            />
            <div className="absolute right-3 -bottom-5 text-xs text-gray-500">
              {inputValue.length}/2000
            </div>
          </div>
          <button 
            type="submit" 
            className="btn-primary min-w-[56px] text-xl disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            disabled={isLoading || !inputValue.trim()}
            aria-label="Send message"
          >
            {isLoading ? '⏳' : '🚀'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;