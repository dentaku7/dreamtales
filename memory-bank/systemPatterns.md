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
   - API endpoints in server/index.js handle data requests
   - Worker functions manage background tasks like story processing
   - Client components consume API endpoints via fetch calls

2. **Routing Structure**:
   - React Router for client-side navigation
   - Server routes map to worker functions for data persistence
   - Public routes vs authenticated routes pattern

## Critical Implementation Paths
1. **User Authentication Flow**:
   - Login form → API validation → Session management → Protected routes

2. **Story Creation Process**:
   - Editor component → Branching path validation → API save → Worker processing

3. **Collaboration Workflow**:
   - Real-time updates → Conflict resolution → Version history → Sync mechanism
