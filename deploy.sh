#!/bin/bash

# DreamTales Deployment Script for Cloudflare Pages + Workers
# Repository: https://github.com/dentaku7/dreamtales

set -e

echo "🚀 Starting DreamTales deployment for dentaku7/dreamtales..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "npm install -g wrangler@latest"
    exit 1
fi

# Check if user is logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please login to Cloudflare first:"
    echo "wrangler login"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install
cd client && npm install && cd ..

# Create KV namespace if not exists
echo "🗄️ Setting up KV namespace..."
echo "Creating KV namespace for chat history..."
wrangler kv:namespace create "CHAT_HISTORY" || echo "KV namespace might already exist"

# Build the React app
echo "🏗️ Building React app..."
cd client && npm run build && cd ..

# Deploy Worker
echo "☁️ Deploying Cloudflare Worker..."
wrangler publish

# Get worker URL
WORKER_URL=$(wrangler status 2>/dev/null | grep "https://" | head -1 | awk '{print $1}' || echo "")

echo ""
echo "✨ Worker deployed successfully!"
echo ""
echo "📄 Cloudflare Pages Setup:"
echo "Repository: https://github.com/dentaku7/dreamtales"
echo "1. Go to Cloudflare Dashboard → Pages → Create project"
echo "2. Connect to Git → Select GitHub → dentaku7/dreamtales"
echo "3. Configure build settings:"
echo "   - Build command: cd client && npm run build"
echo "   - Build output directory: client/build"
echo "   - Environment variables: NODE_VERSION = 18"
echo ""
echo "🔗 After Pages deployment, update these URLs:"
echo "- Worker URL in client/src/App.js (line 5)"
echo "- Worker URL in _redirects file"
if [ ! -z "$WORKER_URL" ]; then
    echo "- Your worker URL: $WORKER_URL"
fi
echo ""
echo "⚙️ Don't forget to:"
echo "- Update KV namespace ID in wrangler.toml (check output above)"
echo "- Set OPENAI_API_KEY: wrangler secret put OPENAI_API_KEY"
echo "- Update worker URL in frontend after Pages deployment"
echo ""
echo "🎉 Deployment complete!" 