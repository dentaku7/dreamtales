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
async function getChatHistory(chatId, env) {
  const key = `chat:${chatId}`;
  const stored = await env.CHAT_HISTORY.get(key);
  return stored ? JSON.parse(stored) : [];
}

// Save chat history to KV
async function saveChatHistory(chatId, history, env) {
  const key = `chat:${chatId}`;
  // Keep only last 50 messages to avoid storage limits
  const trimmed = history.slice(-50);
  await env.CHAT_HISTORY.put(key, JSON.stringify(trimmed), {
    expirationTtl: 86400 * 7 // 7 days
  });
}

// Generate session ID from IP and user agent
function generateSessionId(request, chatId = null) {
  const ip = getClientIP(request);
  const userAgent = request.headers.get('User-Agent') || '';
  return chatId ? chatId : btoa(`${ip}:${userAgent}`).slice(0, 16);
}

// Get master prompt from CONFIG KV (required, no fallback)
async function getMasterPrompt(env) {
  try {
    const masterPrompt = await env.CONFIG.get('master_prompt');
    if (!masterPrompt) {
      throw new Error('Master prompt not configured. Please set a master prompt before using the app.');
    }
    return masterPrompt;
  } catch (error) {
    console.error('Error retrieving master prompt:', error);
    throw error;
  }
}

// Save master prompt to CONFIG KV
async function saveMasterPrompt(prompt, env) {
  try {
    await env.CONFIG.put('master_prompt', prompt);
    return true;
  } catch (error) {
    console.error('Error saving master prompt:', error);
    return false;
  }
}

// Delete master prompt from CONFIG KV
async function deleteMasterPrompt(env) {
  try {
    await env.CONFIG.delete('master_prompt');
    return true;
  } catch (error) {
    console.error('Error deleting master prompt:', error);
    return false;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
        const { message, chatId } = await request.json();
        const sessionId = generateSessionId(request, chatId);
        
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
          chatHistory: chatHistory.slice(-20), // Return last 20 messages
          chatId: sessionId // Return the chat ID for client-side routing
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (url.pathname === '/api/history' && request.method === 'GET') {
        const chatId = url.searchParams.get('chatId');
        const sessionId = generateSessionId(request, chatId);
        const chatHistory = await getChatHistory(sessionId, env);
        
        return new Response(JSON.stringify(chatHistory.slice(-20)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (url.pathname === '/api/history' && request.method === 'DELETE') {
        const chatId = url.searchParams.get('chatId');
        const sessionId = generateSessionId(request, chatId);
        await env.CHAT_HISTORY.delete(`chat:${sessionId}`);
        
        return new Response(JSON.stringify({ message: 'Chat history cleared' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (url.pathname === '/api/prompt' && request.method === 'GET') {
        // Get current master prompt
        const currentPrompt = await getMasterPrompt(env);
        
        return new Response(JSON.stringify({ 
          prompt: currentPrompt
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
        // Delete master prompt
        const success = await deleteMasterPrompt(env);
        
        if (!success) {
          throw new Error('Failed to delete prompt');
        }
        
        return new Response(JSON.stringify({ 
          message: 'Master prompt deleted successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else {
        // Handle static assets and React Router client-side routing
        // For any non-API route, serve the React app (index.html)
        // This allows React Router to handle client-side routing
        const request_url = new URL(request.url);
        
        // If it's a static asset request (js, css, images, etc.), pass it through
        if (request_url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
          return env.ASSETS.fetch(request);
        }
        
        // For all other routes (including /chat, /chat/:id), serve the React app
        // React Router will handle the routing on the client side
        const indexRequest = new Request(new URL('/', request.url), request);
        return env.ASSETS.fetch(indexRequest);
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
