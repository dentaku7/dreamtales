# Tech Context

## Technologies Used
1. **Frontend**:
   - React with Vite (client/)
   - Tailwind CSS (postcss.config.js, tailwind.config.js)
   - React Router for navigation
   - JSON for client-side state persistence

2. **Backend**:
   - Node.js with Express (server/)
   - Cloudflare Workers (worker/)
   - RESTful API architecture
   - JWT for authentication tokens

3. **Development Tools**:
   - npm for package management
   - ESLint for code quality
   - Prettier for code formatting
   - Git for version control

## Development Setup
1. **Environment Requirements**:
   - Node.js v20.x (specified in package.json engines)
   - npm (for package management)
   - OpenAI API key (for chat functionality)
   - Cloudflare Wrangler CLI (for production deployment)

2. **Project Structure**:
   - client/ - React frontend with Tailwind CSS and React Router
   - server/ - Express API server for local development  
   - worker/ - Cloudflare Worker for production
   - memory-bank/ - Project documentation and context
   - .env file - Local environment configuration (OPENAI_API_KEY, MASTER_PROMPT)

## Technical Constraints
1. **Cloudflare Workers Limitations**:
   - 10 minute execution timeout
   - 32MB memory limit
   - No persistent storage (requires external DB)

2. **Browser Compatibility**:
   - ES2021+ features with Babel transpilation
   - Web Component support for cross-framework compatibility

## Dependencies
1. **Frontend Dependencies**:
   - React, ReactDOM
   - React Router DOM (for URL routing)
   - Tailwind CSS (for styling)
   - Native fetch for API calls

2. **Backend Dependencies**:
   - Express (local development server)
   - OpenAI SDK (for AI chat functionality)
   - CORS middleware (for cross-origin requests)
   - dotenv (for environment configuration)

## Tool Usage Patterns
1. **Build Process**:
   - Vite for development server and bundling
   - PostCSS with Tailwind plugin
   - npm scripts for build/deploy

2. **Deployment**:
   - Cloudflare Workers via Wrangler CLI
   - Static asset deployment through Cloudflare Pages
   - CI/CD via GitHub Actions (implied by .gitignore)

3. **Code Quality**:
   - ESLint with React-specific rules
   - Prettier for consistent formatting
   - Git hooks for pre-commit checks
