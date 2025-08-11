# Active Context

## Current Work Focus
Remove URL-based chat IDs; simplify to single-user session with persisted history

## Recent Changes
1. Simplified routing to a single `/chat` route
2. Removed `ChatWrapper` and all `chatId` URL logic
3. Client no longer sends `chatId`; history endpoints use a single key
4. Worker now persists to a single KV key (`chat:default`)
5. Preserved master prompt editing and welcome message flow

## Next Steps
1. Enhanced UI/UX improvements
2. Story personalization features

## Active Decisions
1. Use simple client-side routing (`/chat`) without session IDs
2. Single persisted chat history (no multi-session management)
3. Master prompt loaded from KV in production, env variable in development
4. Master prompt loaded from KV in production, env variable in development
5. Server architecture mirrors worker architecture for consistency

## Important Patterns
1. **URL Structure**: `/` → redirects to `/chat`
2. **State Management**: initialization guarded by `hasInitialized`
3. **Component Hierarchy**: App → Routes → Chat
4. **Error Handling**: React Router handles invalid URLs with fallback redirects
5. **Development Setup**: npm run dev starts both client and server concurrently

## Preferences
1. Focus on logical correctness over perfect syntax (user will test and fix manually)
2. Import DAG names directly from related files instead of declaring as constants
3. Prefer React Router over manual routing solutions
4. Use environment variables for local development configuration

## Learnings & Insights
1. Previous URL sharing implementation was broken and overcomplicated
2. React Router provides cleaner URL management than manual approaches
3. Server and worker should mirror each other's API patterns for consistency
4. UseEffect dependency arrays must be carefully managed to avoid infinite loops
5. Environment variables provide easier local development than requiring UI configuration
