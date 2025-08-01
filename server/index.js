import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { OpenAI } from 'openai';
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

// In-memory storage for custom master prompt (in production, use KV storage)
let customMasterPrompt = null;

// Default model
const DEFAULT_MODEL = 'gpt-4o';

// Get current master prompt - use custom or env variable
async function getCurrentMasterPrompt() {
  if (customMasterPrompt) {
    return customMasterPrompt;
  }
  
  const envPrompt = process.env.MASTER_PROMPT;
  if (envPrompt) {
    return envPrompt;
  }
  
  throw new Error('Master prompt not configured. Please set MASTER_PROMPT in .env or configure via the UI.');
}

// API Routes with /api prefix
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    // Add user message to history
    chatHistory.push({ role: 'user', content: message });
    
    // Get current master prompt (custom or default)
    const currentPrompt = await getCurrentMasterPrompt();
    
    // Prepare messages for OpenAI API
    const messages = [
      { role: 'system', content: currentPrompt },
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

// Get chat history
app.get('/api/history', (req, res) => {
  res.json(chatHistory);
});

// Clear chat history
app.delete('/api/history', (req, res) => {
  chatHistory = [];
  res.json({ message: 'Chat history cleared' });
});

// Get current master prompt
app.get('/api/prompt', async (req, res) => {
  try {
    const currentPrompt = await getCurrentMasterPrompt();
    const isCustom = customMasterPrompt !== null;
    
    res.json({
      prompt: currentPrompt,
      isCustom: isCustom
    });
  } catch (error) {
    console.error('Error getting master prompt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update master prompt
app.put('/api/prompt', (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required and must be a string' });
    }
    
    if (prompt.length > 10000) {
      return res.status(400).json({ error: 'Prompt too long. Please keep it under 10,000 characters.' });
    }
    
    customMasterPrompt = prompt.trim();
    
    res.json({
      message: 'Master prompt updated successfully',
      prompt: customMasterPrompt
    });
  } catch (error) {
    console.error('Error updating master prompt:', error);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

// Delete master prompt
app.delete('/api/prompt', (req, res) => {
  try {
    customMasterPrompt = null;
    
    res.json({
      message: 'Master prompt deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting master prompt:', error);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

// Serve React app (only in production)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});