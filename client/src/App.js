import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Get API base URL based on environment
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://dreamtales-worker.tux-spb.workers.dev' 
  : '';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
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

  // Fetch chat history on component mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/history`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setMessages(data);
        setIsConnected(true);
      } catch (error) {
        console.error('Error fetching history:', error);
        setError('Failed to load chat history. You can still start a new conversation.');
        setIsConnected(false);
      }
    };

    fetchHistory();
  }, []);

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

  const handleClear = async () => {
    if (!window.confirm('Are you sure you want to clear all chat history?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/history`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      setMessages([]);
      setError(null);
      setIsConnected(true);
    } catch (error) {
      console.error('Error clearing history:', error);
      setError('Failed to clear chat history.');
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
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <h1>✨ DreamTales</h1>
          <p className="subtitle">Your magical bedtime story companion</p>
        </div>
        <div className="header-actions">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {isConnected ? 'Connected' : 'Offline'}
          </div>
          <button onClick={handleClear} className="clear-button" title="Clear chat history">
            🗑️ Clear
          </button>
        </div>
      </header>

      <div className="chat-container">
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
            <button 
              className="error-dismiss" 
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <div className="messages" role="log" aria-live="polite">
          {messages.length === 0 && !isLoading && (
            <div className="welcome-message">
              <div className="welcome-content">
                <h2>Welcome to DreamTales! 🌙</h2>
                <p>I'm here to create magical bedtime stories just for you. Tell me:</p>
                <ul>
                  <li>Your name and age</li>
                  <li>What you like (animals, adventures, etc.)</li>
                  <li>How you're feeling today</li>
                </ul>
                <p>And I'll weave you a wonderful tale! ✨</p>
              </div>
            </div>
          )}

          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`message ${msg.role} ${msg.isError ? 'error' : ''}`}
            >
              <div className="message-avatar">
                {msg.role === 'user' ? '👤' : '🌟'}
              </div>
              <div className="message-content">
                <div className="message-text">
                  {formatMessage(msg.content)}
                </div>
                <div className="message-time">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message assistant">
              <div className="message-avatar">🌟</div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div className="message-text">Creating your story...</div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="input-form">
          <div className="input-container">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Tell me about yourself or ask for a story..."
              className="input-field"
              disabled={isLoading}
              maxLength={2000}
            />
            <div className="char-counter">
              {inputValue.length}/2000
            </div>
          </div>
          <button 
            type="submit" 
            className="send-button" 
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