# 🚀 DreamTales Deployment Guide

Complete step-by-step guide for deploying DreamTales from https://github.com/dentaku7/dreamtales to Cloudflare Pages + Workers.

## 📋 Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com) (free tier sufficient)
2. **OpenAI API Key**: Get one from [platform.openai.com](https://platform.openai.com/api-keys)
3. **Node.js 16+**: Download from [nodejs.org](https://nodejs.org)
4. **GitHub Repository**: Repository is already available at `git@github.com:dentaku7/dreamtales.git`

## 🛠️ Setup

### 1. Install Wrangler CLI

```bash
npm install -g wrangler@latest
wrangler login
```

### 2. Clone Repository

```bash
git clone git@github.com:dentaku7/dreamtales.git
cd dreamtales
```

### 3. Create KV Namespace

```bash
wrangler kv:namespace create "CHAT_HISTORY"
```

Copy the namespace ID from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CHAT_HISTORY"
id = "your-actual-namespace-id-here"
```

### 4. Configure Secrets

```bash
wrangler secret put OPENAI_API_KEY
# Paste your OpenAI API key when prompted
```

## 🔄 Cloudflare Automatic Deployment

### Option A: Automated Deployment Script

```bash
./deploy.sh
```

This will deploy the worker and give you instructions for Pages setup.

### Option B: Manual Cloudflare Pages Setup

#### Step 1: Deploy Worker First

```bash
# Install dependencies and deploy worker
npm install
wrangler publish
```

#### Step 2: Automatic Pages Deployment

1. **Go to Cloudflare Dashboard**: 
   - Visit [dash.cloudflare.com](https://dash.cloudflare.com)
   - Navigate to **Pages** → **Create a project**

2. **Connect Repository**:
   - Click **"Connect to Git"**
   - Choose **GitHub** as provider
   - Select repository: **`dentaku7/dreamtales`**
   - Choose branch: **`main`**

3. **Configure Build Settings**:
   ```
   Project name: dreamtales
   Production branch: main
   Build command: cd client && npm run build
   Build output directory: client/build
   Root directory: (leave empty)
   ```

4. **Environment Variables**:
   ```
   NODE_VERSION = 18
   ```

5. **Deploy**: Click **"Save and Deploy"**

## 🔧 Post-Deployment Configuration

### 1. Get Your Worker URL

After worker deployment, note your worker URL (format: `https://dreamtales-worker.[subdomain].workers.dev`)

### 2. Update Frontend Configuration

**Update `client/src/App.js` line 6:**
```javascript
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://dreamtales-worker.[YOUR_ACTUAL_SUBDOMAIN].workers.dev' 
  : '';
```

**Update `_redirects` file:**
```
/api/* https://dreamtales-worker.[YOUR_ACTUAL_SUBDOMAIN].workers.dev/api/:splat 200
/* /index.html 200
```

### 3. Redeploy Pages

Push the updated files to trigger a new Pages deployment:

```bash
git add .
git commit -m "Update worker URLs"
git push origin main
```

Cloudflare Pages will automatically redeploy.

## 🧪 Testing

### Test Worker Endpoints

Replace `[YOUR_SUBDOMAIN]` with your actual subdomain:

```bash
# Test chat
curl -X POST https://dreamtales-worker.[YOUR_SUBDOMAIN].workers.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, tell me a story!"}'
```

### Test Frontend

1. Visit your Pages URL: `https://dreamtales.[your-pages-subdomain].pages.dev`
2. Try sending a message
3. Check browser console for errors
4. Test on mobile devices

## 🔍 Troubleshooting

### Common Issues

#### Worker Not Responding
- Check `wrangler tail` for real-time logs
- Verify OPENAI_API_KEY is set: `wrangler secret list`
- Check KV namespace binding in `wrangler.toml`

#### CORS Errors
- Ensure worker URL is correct in frontend
- Check `_redirects` file is in build output
- Verify API routes start with `/api/`

#### Pages Build Failures
- Check Node.js version is set to 18 in Pages environment
- Verify build command: `cd client && npm run build`
- Check build output directory: `client/build`

#### Chat History Not Persisting
- Verify KV namespace is created and bound
- Check worker logs for KV errors
- Ensure namespace ID matches in `wrangler.toml`

### Debug Commands

```bash
# View worker logs
wrangler tail

# Check current deployment
wrangler status

# View KV contents
wrangler kv:key list --binding CHAT_HISTORY

# Test worker locally
wrangler dev
```

## 📊 Monitoring

### Cloudflare Analytics
- Check your Cloudflare dashboard for:
  - Worker request volume
  - Error rates
  - Response times
  - Geographic distribution

### Performance Optimization
- Enable Cloudflare's optimization features
- Use Cloudflare Images for any assets
- Monitor Core Web Vitals

## 🔒 Security Checklist

- ✅ API keys stored as secrets (not in code)
- ✅ Rate limiting enabled (20 req/min per IP)
- ✅ CORS properly configured
- ✅ Input validation in place
- ✅ No sensitive data in logs
- ✅ Security headers configured

## 🔄 Updates

### Updating Worker
```bash
wrangler publish
```

### Updating Frontend
- Push changes to GitHub repository
- Cloudflare Pages will automatically rebuild and deploy

### Rolling Back
- Use Cloudflare Pages deployment history
- For workers: deploy previous version manually

## 💰 Cost Estimation

**Free Tier Limits** (generous for most personal projects):
- Workers: 100,000 requests/day
- Pages: Unlimited sites, 500 builds/month  
- KV: 100,000 reads/day, 1,000 writes/day

**Typical Costs for Production**:
- Workers: $5/month (10M requests)
- Pages: Free for most usage
- KV: $0.50/million operations

## 📞 Support

- **Cloudflare Community**: [community.cloudflare.com](https://community.cloudflare.com)
- **Cloudflare Docs**: [developers.cloudflare.com](https://developers.cloudflare.com)
- **Repository Issues**: https://github.com/dentaku7/dreamtales/issues

---

*Happy deploying! 🎉* 