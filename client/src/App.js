import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Get API base URL - with unified Workers, API routes are handled by the same worker
const API_BASE = '';

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
          <button onClick={handleNewStory} className="new-story-button" title="Start a new story">
            🌟 New Story
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
          {messages.length === 0 && !isLoading && hasInitialized && (
            <div className="welcome-message">
              <div className="welcome-content">
                <h2>Welcome to DreamTales! 🌙</h2>
                <p>Something went wrong with the welcome message. Please type "Hello" to get started!</p>
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
                <div className="message-text">
                  {messages.length === 0 ? 'Preparing your magical welcome...' : 'Creating your story...'}
                </div>
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