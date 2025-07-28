import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { OpenAI } from 'openai';
import PERSONA_PROMPT from './persona.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Only serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// In-memory storage for chat history (in production, use a database)
let chatHistory = [];

// Default model
const DEFAULT_MODEL = 'gpt-4o';

// API Routes with /api prefix
app.post('/api/chat', async (req, res) => {
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
app.get('/api/history', (req, res) => {
  res.json(chatHistory);
});

// Endpoint to clear chat history
app.delete('/api/history', (req, res) => {
  chatHistory = [];
  res.json({ message: 'Chat history cleared' });
});

// For production, serve the React app for any other route
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});