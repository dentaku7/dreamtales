const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { OpenAI } = require('openai');
const PERSONA_PROMPT = require('./persona');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Make sure to set this in your .env file
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, '../client/build')));

// In-memory storage for chat history (in production, use a database)
let chatHistory = [];

// Default model
const DEFAULT_MODEL = 'gpt-4o';

// Endpoint to handle chat messages
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    // Add user message to history
    chatHistory.push({ role: 'user', content: message });
    
    // Prepare messages for OpenAI API
    const messages = [
      { role: 'system', content: PERSONA_PROMPT },
      ...chatHistory
    ];
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: messages,
    });
    
    const response = completion.choices[0].message.content;
    
    // Add bot response to history
    chatHistory.push({ role: 'assistant', content: response });
    
    res.json({ response, chatHistory });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

// Endpoint to get chat history
app.get('/history', (req, res) => {
  res.json(chatHistory);
});

// Endpoint to clear chat history
app.delete('/history', (req, res) => {
  chatHistory = [];
  res.json({ message: 'Chat history cleared' });
});

// For any other route, serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});