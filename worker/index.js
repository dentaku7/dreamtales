const PERSONA_PROMPT = `
[PERSONA]

You are a friendly and knowledgeable bedtime story writer who creates emotionally rich, age-appropriate stories for children ages 3 to 7. You prioritize imaginative storytelling and positive moral lessons. You have a good sense of humor suitable for children in your target audience. 

Your stories are engaging and supportive, allowing your young listeners to find comfort and peace after a day full of emotional and intellectual challenges. You don't judge but do everything possible to extend a helping hand through relaxing narration. 

You are an adult, but remember what it was like being a child and having to deal with a multitude of challenging situations on a daily basis, so you are emphatic and employ a highly relatable "I know how you feel about this" approach in storytelling.

Your native language is English (US). You live in 2025.

[CONTEXT]

Your persona lives and operates within the DreamTales app. The purpose of the app is to:

Provide the creative means for generating unique bedtime stories based on one of the pre-existing templates/choices available in the app's UI, voice input from the child, or a combination of the latter with input from a parent (a specific challenge/problem/situation that the child has recently gone through — it will be embedded into the body of the story and resolved/explained at the end)
Provide a powerful therapeutic tool that will help children understand complex moral and behavioral concepts and assist parents with embedding important moral guidelines and examples of good decisions into the child's mind in a non-intrusive, indirect manner. 

[SPECIAL INSTRUCTIONS FOR FIRST INTERACTIONS]

When a user first arrives (indicated by simple greetings like "Hello", "Hi", "I'd like to hear a bedtime story", etc.), provide a warm, magical welcome that:
- Introduces yourself as their bedtime story companion
- Expresses excitement about creating a personalized story
- Gently asks for their name, age, favorite things, and how they're feeling
- Creates anticipation for the magical story to come
- Uses child-friendly language and emojis to create a warm atmosphere

[TASK]

The user will provide a prompt containing the child's name, age, interests, and an optional emotional theme (e.g., bravery, empathy, or conflict resolution). Use these elements to guide the story's plot and tone.
Upon receiving the user's input, start generating the story.
While generating the story, keep track of individual character lines. Use characters as building material to put the selected storyline into a problem-argumentation-solution framework.
At the end of each story segment (defined by the duration defined in the app settings), you will ask the child three questions about the further development of the story based on its characters and their interactions. None of them will be "right" and will lead to the same positive and educational outcome, but these choices will affect the flow of the story.
If no response is received within 15 seconds, ask again. If no answer is received, stop content generation (the child is likely asleep by now). 

[OUTPUT FORMAT]

Each story will have:
An engaging title
A one-sentence, catchy subtitle providing a summary of what the story is about
Main story body laying out the plot, describing the characters, highlighting the problem, identifying possible solutions, explaining the choice of the final solution, and leading to the moral of the story.
An estimate of the reading time at an average pace (account for the fact that this is a bedtime story for young children, so the overall pace may be somewhat slower)
It is expected that stories will have varying lengths ranging from 15 to 40 minutes. The default choice is 20 minutes (this parameter will be controlled externally and you will be notified of that), so aim for the length of text corresponding to a moderately-paced narration of said duration.

[CONSTRAINTS AND STYLE GUIDELINES]

Your stories will be voiced to listeners through a TTS engine, so try optimizing them for a consistent, soothing voice flow (try to find and use any research materials or papers detailing the best practices of highly readable texts).

Remember that you are writing for 3-7 year-olds, so keep your language simple enough but do not compromise on quality.

In determining the overall style of your narration, feel free to resort to best-selling titles and classics. Use your best judgement attained through your training on literature to determine the most appropriate style for each story. 
`;

// Rate limiting using Cloudflare Workers
class RateLimiter {
  constructor(limit = 10, windowMs = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async isAllowed(identifier, env) {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    const current = await env.CHAT_HISTORY.get(key);
    let requests = current ? JSON.parse(current) : [];
    
    // Filter out old requests
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    if (requests.length >= this.limit) {
      return false;
    }
    
    requests.push(now);
    await env.CHAT_HISTORY.put(key, JSON.stringify(requests), {
      expirationTtl: Math.ceil(this.windowMs / 1000)
    });
    
    return true;
  }
}

const rateLimiter = new RateLimiter(20, 60000); // 20 requests per minute

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Validate input
function validateMessage(message) {
  if (!message || typeof message !== 'string') {
    throw new Error('Message is required and must be a string');
  }
  if (message.length > 2000) {
    throw new Error('Message too long. Please keep it under 2000 characters.');
  }
  if (message.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }
  return message.trim();
}

// Get client IP for rate limiting
function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         'unknown';
}

// Get chat history from KV
async function getChatHistory(sessionId, env) {
  const key = `chat:${sessionId}`;
  const stored = await env.CHAT_HISTORY.get(key);
  return stored ? JSON.parse(stored) : [];
}

// Save chat history to KV
async function saveChatHistory(sessionId, history, env) {
  const key = `chat:${sessionId}`;
  // Keep only last 50 messages to avoid storage limits
  const trimmed = history.slice(-50);
  await env.CHAT_HISTORY.put(key, JSON.stringify(trimmed), {
    expirationTtl: 86400 * 7 // 7 days
  });
}

// Generate session ID from IP and user agent
function generateSessionId(request) {
  const ip = getClientIP(request);
  const userAgent = request.headers.get('User-Agent') || '';
  return btoa(`${ip}:${userAgent}`).slice(0, 16);
}

// Get master prompt from KV or fallback to default
async function getMasterPrompt(env) {
  try {
    const customPrompt = await env.CHAT_HISTORY.get('master_prompt');
    return customPrompt || PERSONA_PROMPT;
  } catch (error) {
    console.error('Error retrieving master prompt:', error);
    return PERSONA_PROMPT;
  }
}

// Save master prompt to KV
async function saveMasterPrompt(prompt, env) {
  try {
    await env.CHAT_HISTORY.put('master_prompt', prompt);
    return true;
  } catch (error) {
    console.error('Error saving master prompt:', error);
    return false;
  }
}

// Reset to default prompt
async function resetMasterPrompt(env) {
  try {
    await env.CHAT_HISTORY.delete('master_prompt');
    return true;
  } catch (error) {
    console.error('Error resetting master prompt:', error);
    return false;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Rate limiting
    const clientIP = getClientIP(request);
    const allowed = await rateLimiter.isAllowed(clientIP, env);
    if (!allowed) {
      return new Response(JSON.stringify({ 
        error: 'Too many requests. Please wait a moment before trying again.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      if (url.pathname === '/api/chat' && request.method === 'POST') {
        const { message } = await request.json();
        const sessionId = generateSessionId(request);
        
        // Validate input
        const validatedMessage = validateMessage(message);
        
        // Get chat history
        const chatHistory = await getChatHistory(sessionId, env);
        
        // Add user message
        chatHistory.push({ role: 'user', content: validatedMessage });
        
        // Get current master prompt (custom or default)
        const currentPrompt = await getMasterPrompt(env);
        
        // Prepare messages for OpenAI
        const messages = [
          { role: 'system', content: currentPrompt },
          ...chatHistory
        ];
        
        // Call OpenAI API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: messages,
            max_tokens: 2000,
            temperature: 0.7,
          }),
        });
        
        if (!openaiResponse.ok) {
          const errorData = await openaiResponse.text();
          console.error('OpenAI API Error:', errorData);
          throw new Error('Failed to get response from AI service');
        }
        
        const completion = await openaiResponse.json();
        const response = completion.choices[0].message.content;
        
        // Add bot response
        chatHistory.push({ role: 'assistant', content: response });
        
        // Save updated history
        await saveChatHistory(sessionId, chatHistory, env);
        
        return new Response(JSON.stringify({ 
          response, 
          chatHistory: chatHistory.slice(-20) // Return last 20 messages
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (url.pathname === '/api/history' && request.method === 'GET') {
        const sessionId = generateSessionId(request);
        const chatHistory = await getChatHistory(sessionId, env);
        
        return new Response(JSON.stringify(chatHistory.slice(-20)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (url.pathname === '/api/history' && request.method === 'DELETE') {
        const sessionId = generateSessionId(request);
        await env.CHAT_HISTORY.delete(`chat:${sessionId}`);
        
        return new Response(JSON.stringify({ message: 'Chat history cleared' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (url.pathname === '/api/prompt' && request.method === 'GET') {
        // Get current master prompt
        const currentPrompt = await getMasterPrompt(env);
        const isCustom = await env.CHAT_HISTORY.get('master_prompt') !== null;
        
        return new Response(JSON.stringify({ 
          prompt: currentPrompt,
          isCustom: isCustom,
          defaultPrompt: PERSONA_PROMPT
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (url.pathname === '/api/prompt' && request.method === 'PUT') {
        // Update master prompt
        const { prompt } = await request.json();
        
        if (!prompt || typeof prompt !== 'string') {
          throw new Error('Prompt is required and must be a string');
        }
        
        if (prompt.length > 10000) {
          throw new Error('Prompt too long. Please keep it under 10,000 characters.');
        }
        
        const success = await saveMasterPrompt(prompt.trim(), env);
        
        if (!success) {
          throw new Error('Failed to save prompt');
        }
        
        return new Response(JSON.stringify({ 
          message: 'Master prompt updated successfully',
          prompt: prompt.trim()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (url.pathname === '/api/prompt' && request.method === 'DELETE') {
        // Reset to default prompt
        const success = await resetMasterPrompt(env);
        
        if (!success) {
          throw new Error('Failed to reset prompt');
        }
        
        return new Response(JSON.stringify({ 
          message: 'Master prompt reset to default',
          prompt: PERSONA_PROMPT
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else {
        return new Response('Not Found', { 
          status: 404,
          headers: corsHeaders 
        });
      }
      
    } catch (error) {
      console.error('Worker Error:', error);
      return new Response(JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },
}; 