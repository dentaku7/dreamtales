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

// Single-user chat key
const CHAT_KEY = 'chat:default';

// Parent data block key
const PARENT_DATA_KEY = 'parent_data:block';

// Get chat history from KV by key
async function getChatHistory(env, key) {
  const stored = await env.CHAT_HISTORY.get(key);
  return stored ? JSON.parse(stored) : [];
}

// Save chat history to KV by key
async function saveChatHistory(history, env, key) {
  // Keep only last 50 messages to avoid storage limits
  const trimmed = history.slice(-50);
  await env.CHAT_HISTORY.put(key, JSON.stringify(trimmed), {
    expirationTtl: 86400 * 7 // 7 days
  });
}

// Get master prompt from CONFIG KV per mode
async function getMasterPrompt(env, mode = 'child') {
  try {
    if (mode === 'child') {
      let childPrompt = await env.CONFIG.get('master_prompt_child');
      if (!childPrompt) {
        const legacy = await env.CONFIG.get('master_prompt');
        if (legacy) {
          await env.CONFIG.put('master_prompt_child', legacy);
          childPrompt = legacy;
        }
      }
      if (!childPrompt) {
        throw new Error('Master prompt (child) not configured. Please set a master prompt before using the app.');
      }
      return childPrompt;
    } else {
      let parentPrompt = await env.CONFIG.get('master_prompt_parent');
      if (!parentPrompt) {
        parentPrompt = `You are a helpful parenting assistant.\nYour goal is to guide the parent to produce a single structured block that summarizes the situation and the intended lesson for the child.\nAsk clarifying questions as needed, but when ready, output EXACTLY one block using this exact format:\n\n<PARENT_INPUT>\nCore issue: a short description of the conflict or concern\nLesson to be taught to the child: a clear thought to be delivered to the child\n</PARENT_INPUT>\n\nDo not include additional commentary inside the block. Keep the block concise.`;
        await env.CONFIG.put('master_prompt_parent', parentPrompt);
      }
      return parentPrompt;
    }
  } catch (error) {
    console.error('Error retrieving master prompt:', error);
    throw error;
  }
}

// Save master prompt to CONFIG KV per mode
async function saveMasterPrompt(prompt, env, mode = 'child') {
  try {
    const key = mode === 'parent' ? 'master_prompt_parent' : 'master_prompt_child';
    await env.CONFIG.put(key, prompt);
    return true;
  } catch (error) {
    console.error('Error saving master prompt:', error);
    return false;
  }
}

// Delete master prompt from CONFIG KV per mode
async function deleteMasterPrompt(env, mode = 'child') {
  try {
    const key = mode === 'parent' ? 'master_prompt_parent' : 'master_prompt_child';
    await env.CONFIG.delete(key);
    return true;
  } catch (error) {
    console.error('Error deleting master prompt:', error);
    return false;
  }
}

// Parent data helpers
async function getParentData(env) {
  const stored = await env.CONFIG.get(PARENT_DATA_KEY);
  return stored ? JSON.parse(stored) : null;
}

async function saveParentData(block, env) {
  const payload = { block, updatedAt: new Date().toISOString() };
  await env.CONFIG.put(PARENT_DATA_KEY, JSON.stringify(payload));
  return payload;
}

async function deleteParentData(env) {
  await env.CONFIG.delete(PARENT_DATA_KEY);
}

// Basic Auth check
function checkBasicAuth(request) {
  const authorization = request.headers.get('Authorization');
  
  if (!authorization) {
    return false;
  }
  
  const [scheme, credentials] = authorization.split(' ');
  
  if (scheme !== 'Basic' || !credentials) {
    return false;
  }
  
  const decoded = atob(credentials);
  const [username, password] = decoded.split(':');
  
  // Change these credentials as needed
  return username === 'dev' && password === 'dreamtales2025';
}

function unauthorizedResponse() {
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="DreamTales Dev Access"',
      'Content-Type': 'text/plain'
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Check basic auth for all requests (except CORS preflight)
    if (request.method !== 'OPTIONS' && !checkBasicAuth(request)) {
      return unauthorizedResponse();
    }
    
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
      if (url.pathname === '/api/story/start' && request.method === 'POST') {
        const mode = url.searchParams.get('mode') === 'parent' ? 'parent' : 'child';

        // Clear history
        const chatKey = mode === 'parent' ? 'chat:parents' : 'chat:child';
        await env.CHAT_HISTORY.delete(chatKey);
        const chatHistory = [];

        // Compose prompt with optional parent injection for child
        let currentPrompt = await getMasterPrompt(env, mode);
        let appliedFromParent = false;
        if (mode === 'child') {
          const parentData = await getParentData(env);
          if (parentData && parentData.block) {
            currentPrompt = `${currentPrompt}\n\n<FROM_PARENT>\n${parentData.block}\n</FROM_PARENT>`;
            appliedFromParent = true;
          }
        }

        const starterMessage = mode === 'parent'
          ? 'Hello, I want help describing my parenting situation and desired outcome.'
          : "Hello! I'd like to hear a bedtime story.";

        const messages = [
          { role: 'system', content: currentPrompt },
          { role: 'user', content: starterMessage },
        ];

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages,
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
        const assistantReply = completion.choices[0].message.content;

        // Persist history
        chatHistory.push({ role: 'user', content: starterMessage });
        chatHistory.push({ role: 'assistant', content: assistantReply });
        await saveChatHistory(chatHistory, env, chatKey);

        return new Response(JSON.stringify({ chatHistory: chatHistory.slice(-20), appliedFromParent }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } else if (url.pathname === '/api/chat' && request.method === 'POST') {
        const { message } = await request.json();
        const mode = url.searchParams.get('mode') === 'parent' ? 'parent' : 'child';
        
        // Validate input
        const validatedMessage = validateMessage(message);
        
        // Get chat history by mode
        const chatKey = mode === 'parent' ? 'chat:parents' : 'chat:child';
        const chatHistory = await getChatHistory(env, chatKey);
        
        // Add user message
        chatHistory.push({ role: 'user', content: validatedMessage });
        
        // Get current master prompt per mode
        let currentPrompt = await getMasterPrompt(env, mode);

        // For child mode, inject parent data only when starting a new story
        if (mode === 'child' && chatHistory.length === 1) {
          const parentData = await getParentData(env);
          if (parentData && parentData.block) {
            currentPrompt = `${currentPrompt}\n\n<FROM_PARENT>\n${parentData.block}\n</FROM_PARENT>`;
          }
        }
        
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
        await saveChatHistory(chatHistory, env, chatKey);
        
        const responsePayload = { 
          response, 
          chatHistory: chatHistory.slice(-20)
        };

        // If parent mode, try to capture a <PARENT_INPUT> block from either user or assistant
        if (mode === 'parent') {
          const regex = /<PARENT_INPUT>[\s\S]*?<\/PARENT_INPUT>/i;
          const fromUser = typeof validatedMessage === 'string' ? validatedMessage.match(regex) : null;
          const fromAssistant = typeof response === 'string' ? response.match(regex) : null;
          const match = fromUser?.[0] || fromAssistant?.[0] || null;
          if (match) {
            const saved = await saveParentData(match, env);
            responsePayload.consumed = true;
            responsePayload.parentData = saved;
          }
        }

        return new Response(JSON.stringify(responsePayload), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (url.pathname === '/api/history' && request.method === 'GET') {
        const mode = url.searchParams.get('mode') === 'parent' ? 'parent' : 'child';
        const chatKey = mode === 'parent' ? 'chat:parents' : 'chat:child';
        const chatHistory = await getChatHistory(env, chatKey);
        
        return new Response(JSON.stringify(chatHistory.slice(-20)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (url.pathname === '/api/history' && request.method === 'DELETE') {
        const mode = url.searchParams.get('mode') === 'parent' ? 'parent' : 'child';
        const chatKey = mode === 'parent' ? 'chat:parents' : 'chat:child';
        await env.CHAT_HISTORY.delete(chatKey);
        
        return new Response(JSON.stringify({ message: 'Chat history cleared' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (url.pathname === '/api/prompt' && request.method === 'GET') {
        // Get current master prompt per mode
        const mode = url.searchParams.get('mode') === 'parent' ? 'parent' : 'child';
        const currentPrompt = await getMasterPrompt(env, mode);
        
        return new Response(JSON.stringify({ 
          prompt: currentPrompt
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (url.pathname === '/api/prompt' && request.method === 'PUT') {
        // Update master prompt per mode
        const mode = url.searchParams.get('mode') === 'parent' ? 'parent' : 'child';
        const { prompt } = await request.json();
        
        if (!prompt || typeof prompt !== 'string') {
          throw new Error('Prompt is required and must be a string');
        }
        
        if (prompt.length > 10000) {
          throw new Error('Prompt too long. Please keep it under 10,000 characters.');
        }
        
        const success = await saveMasterPrompt(prompt.trim(), env, mode);
        
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
        // Delete master prompt per mode
        const mode = url.searchParams.get('mode') === 'parent' ? 'parent' : 'child';
        const success = await deleteMasterPrompt(env, mode);
        
        if (!success) {
          throw new Error('Failed to delete prompt');
        }
        
        return new Response(JSON.stringify({ 
          message: 'Master prompt deleted successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else if (url.pathname === '/api/parent-data' && request.method === 'GET') {
        const parentData = await getParentData(env);
        return new Response(JSON.stringify(parentData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else if (url.pathname === '/api/parent-data' && request.method === 'DELETE') {
        await deleteParentData(env);
        return new Response(JSON.stringify({ message: 'Parent data cleared' }), {
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
