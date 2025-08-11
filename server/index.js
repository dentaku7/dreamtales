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

// In-memory storage for chat histories (dev only; production uses Worker KV)
let chatHistoryChild = [];
let chatHistoryParent = [];

// In-memory storage for custom master prompts (dev only)
let customMasterPromptChild = null;
let customMasterPromptParent = null;

// In-memory storage for captured parent data block (dev only)
// Shape: { block: string, updatedAt: string } | null
let parentDataBlock = null;

// Default model
const DEFAULT_MODEL = 'gpt-4o';

// Default parent prompt (guides toward producing <PARENT_INPUT> block)
const DEFAULT_PARENT_PROMPT = `You are a helpful parenting assistant.
Your goal is to guide the parent to produce a single structured block that summarizes the situation and the intended lesson for the child.
Ask clarifying questions as needed, but when ready, output EXACTLY one block using this exact format:

<PARENT_INPUT>
Core issue: a short description of the conflict or concern
Lesson to be taught to the child: a clear thought to be delivered to the child
</PARENT_INPUT>

Do not include additional commentary inside the block. Keep the block concise.`;

// Get current master prompt per mode - use custom or env variable
async function getCurrentMasterPrompt(mode = 'child') {
  if (mode === 'parent') {
    if (customMasterPromptParent) {
      return customMasterPromptParent;
    }
    return DEFAULT_PARENT_PROMPT;
  }

  // child
  if (customMasterPromptChild) {
    return customMasterPromptChild;
  }

  const envPrompt = process.env.MASTER_PROMPT;
  if (envPrompt) {
    return envPrompt;
  }

  throw new Error('Master prompt not configured. Please set MASTER_PROMPT in .env or configure via the UI.');
}

function getHistoryByMode(mode = 'child') {
  return mode === 'parent' ? chatHistoryParent : chatHistoryChild;
}

function setHistoryByMode(mode = 'child', newHistoryArray) {
  if (mode === 'parent') {
    chatHistoryParent = newHistoryArray;
  } else {
    chatHistoryChild = newHistoryArray;
  }
}

// API Routes with /api prefix
// Start a new story (clears history, applies parent injection for child, creates initial assistant turn)
app.post('/api/story/start', async (req, res) => {
  try {
    const mode = (req.query.mode === 'parent') ? 'parent' : 'child';
    // Clear history
    setHistoryByMode(mode, []);
    const history = getHistoryByMode(mode);

    // Compose prompt (inject parent block for child)
    let currentPrompt = await getCurrentMasterPrompt(mode);
    let appliedFromParent = false;
    if (mode === 'child' && parentDataBlock && parentDataBlock.block) {
      currentPrompt = `${currentPrompt}\n\n<FROM_PARENT>\n${parentDataBlock.block}\n</FROM_PARENT>`;
      appliedFromParent = true;
    }

    // Seed conversation with a starter user message to elicit assistant welcome
    const starterMessage = mode === 'parent'
      ? 'Hello, I want help describing my parenting situation and desired outcome.'
      : "Hello! I'd like to hear a bedtime story.";

    const messages = [
      { role: 'system', content: currentPrompt },
      { role: 'user', content: starterMessage }
    ];

    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
    });

    const assistantReply = completion.choices[0].message.content;

    // Persist history (user + assistant)
    history.push({ role: 'user', content: starterMessage });
    history.push({ role: 'assistant', content: assistantReply });
    setHistoryByMode(mode, history);

    return res.json({ chatHistory: history, appliedFromParent });
  } catch (error) {
    console.error('Error starting new story:', error);
    res.status(500).json({ error: 'Failed to start new story' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const mode = (req.query.mode === 'parent') ? 'parent' : 'child';

    // Select history and determine if this is a new story (empty history)
    const history = getHistoryByMode(mode);
    const wasNewStory = history.length === 0;

    // Add user message to history
    history.push({ role: 'user', content: message });

    // Get current master prompt (custom or default)
    let currentPrompt = await getCurrentMasterPrompt(mode);

    // For child mode, inject parent data block only on new story
    if (mode === 'child' && wasNewStory && parentDataBlock && parentDataBlock.block) {
      currentPrompt = `${currentPrompt}\n\n<FROM_PARENT>\n${parentDataBlock.block}\n</FROM_PARENT>`;
    }

    // Prepare messages for OpenAI API
    const messages = [
      { role: 'system', content: currentPrompt },
      ...history
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: messages,
    });

    const response = completion.choices[0].message.content;

    // Add bot response to history
    history.push({ role: 'assistant', content: response });

    // Persist back
    setHistoryByMode(mode, history);

    const responseBody = { response, chatHistory: history };

    // If parent mode, try to capture a <PARENT_INPUT> block from either user or assistant
    if (mode === 'parent') {
      const regex = /<PARENT_INPUT>[\s\S]*?<\/PARENT_INPUT>/i;
      const fromUser = typeof message === 'string' ? message.match(regex) : null;
      const fromAssistant = typeof response === 'string' ? response.match(regex) : null;
      const match = fromUser?.[0] || fromAssistant?.[0] || null;
      if (match) {
        parentDataBlock = { block: match, updatedAt: new Date().toISOString() };
        responseBody.consumed = true;
        responseBody.parentData = parentDataBlock;
      }
    }

    res.json(responseBody);
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

// Get chat history
app.get('/api/history', (req, res) => {
  const mode = (req.query.mode === 'parent') ? 'parent' : 'child';
  const history = getHistoryByMode(mode);
  res.json(history);
});

// Clear chat history
app.delete('/api/history', (req, res) => {
  const mode = (req.query.mode === 'parent') ? 'parent' : 'child';
  setHistoryByMode(mode, []);
  res.json({ message: 'Chat history cleared' });
});

// Get current master prompt
app.get('/api/prompt', async (req, res) => {
  try {
    const mode = (req.query.mode === 'parent') ? 'parent' : 'child';
    const currentPrompt = await getCurrentMasterPrompt(mode);
    const isCustom = mode === 'parent' ? (customMasterPromptParent !== null) : (customMasterPromptChild !== null);
    
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
    const mode = (req.query.mode === 'parent') ? 'parent' : 'child';
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required and must be a string' });
    }
    
    if (prompt.length > 10000) {
      return res.status(400).json({ error: 'Prompt too long. Please keep it under 10,000 characters.' });
    }
    
    if (mode === 'parent') {
      customMasterPromptParent = prompt.trim();
    } else {
      customMasterPromptChild = prompt.trim();
    }
    
    res.json({
      message: 'Master prompt updated successfully',
      prompt: prompt.trim()
    });
  } catch (error) {
    console.error('Error updating master prompt:', error);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

// Delete master prompt
app.delete('/api/prompt', (req, res) => {
  try {
    const mode = (req.query.mode === 'parent') ? 'parent' : 'child';
    if (mode === 'parent') {
      customMasterPromptParent = null;
    } else {
      customMasterPromptChild = null;
    }
    
    res.json({
      message: 'Master prompt deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting master prompt:', error);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

// Parent data endpoints
app.get('/api/parent-data', (req, res) => {
  res.json(parentDataBlock);
});

app.delete('/api/parent-data', (req, res) => {
  parentDataBlock = null;
  res.json({ message: 'Parent data cleared' });
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