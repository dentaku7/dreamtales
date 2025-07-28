# DreamTales Deployment Guide

## Required Setup Steps

### 1. Cloudflare KV Namespaces

You need to create TWO KV namespaces in your Cloudflare dashboard:

1. **CHAT_HISTORY** - for storing user chat sessions (already configured)
2. **CONFIG** - for storing configuration data like the master prompt

**Steps:**
1. Go to Cloudflare Dashboard → Workers & Pages → KV
2. Create a new namespace called "dreamtales-config" 
3. Copy the namespace ID
4. Replace `REPLACE_WITH_CONFIG_KV_NAMESPACE_ID` in `wrangler.toml` with the actual ID

### 2. Environment Variables

Set these in Cloudflare Dashboard → Workers & Pages → Your Worker → Settings → Variables:

- **OPENAI_API_KEY** (secret) - Your OpenAI API key

### 3. Initial Master Prompt Setup

After deployment, set the master prompt via API:

```bash
curl -X PUT https://your-worker-domain.workers.dev/api/prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Your master prompt content here..."}'
```

**The app will not function until both OPENAI_API_KEY and master prompt are configured.**

### 4. Git-Based Deployment

This project uses Cloudflare's automatic Git integration:
- Push to `main` branch triggers production deployment
- Other branches get preview URLs
- No local `wrangler deploy` needed

## Testing

After setup, testers can modify the master prompt using:
- **GET** `/api/prompt` - View current prompt
- **PUT** `/api/prompt` - Update prompt  
- **DELETE** `/api/prompt` - Delete prompt (will break the app until reset) 