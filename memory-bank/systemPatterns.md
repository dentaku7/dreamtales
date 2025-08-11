# System Patterns

## Architecture Overview
DreamTales follows a three-tier architecture pattern:
1. **Client Tier**: React-based frontend with Tailwind CSS (client/)
2. **Server Tier**: Node.js API server with Express (server/)
3. **Worker Tier**: Cloudflare Workers for background processing (worker/)

## Key Technical Decisions
1. **Frontend Framework**: React with Vite for development speed and component architecture
2. **Styling**: Tailwind CSS for utility-first CSS approach
3. **State Management**: Context API for global state with Redux patterns
4. **Serverless Functions**: Cloudflare Workers for scalable backend operations
5. **Data Storage**: JSON-based storage with potential for SQLite/PostgreSQL migration

## Design Patterns
1. **Component Architecture**:
   - Atomic design pattern for React components
   - Container/Presentational component separation
   - Higher-order components for cross-cutting concerns

2. **API Design**:
   - RESTful endpoints with JSON responses
   - Middleware pattern for request processing
   - Error boundary components for UI resilience

3. **State Management**:
   - Single source of truth pattern
   - Immutable data updates
   - Action-based state transitions

## Component Relationships
1. **Client-Server Communication**:
   - API endpoints in server/index.js handle local development requests
   - Worker functions handle production chat processing and persistence
   - Client components consume API endpoints via fetch calls with environment detection

2. **Routing Structure**:
   - React Router with BrowserRouter for client-side navigation
   - Routes: `/` → `/chat`
   - Worker handles client-side routing fallback for production static assets
   - Chat component handles conversations directly

## Critical Implementation Paths
1. **Chat Session Flow**:
   - URL access → Chat → Chat history loading → AI conversation

2. **Message Processing**:
   - User input → Client validation → API call with chat ID → OpenAI processing → Response with updated history

3. **URL Management**:
   - Base URL → Redirect to `/chat` → Chat component mounts → History loads → Ready for conversation
   - New story → Clear history → Send new welcome message
