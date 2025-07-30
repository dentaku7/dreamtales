# Active Context

## Current Work Focus
Completed proper chat URL routing system implementation

## Recent Changes
1. Implemented React Router for client-side routing with ChatWrapper and Chat components
2. Refactored App.js to handle routing via Routes instead of direct chat rendering
3. Added automatic chat ID generation and URL redirection for base URLs
4. Implemented URL-based chat history loading for specific chat IDs
5. Updated New Story and prompt editing to create new chat IDs and update URLs
6. Removed share button since URL always reflects current chat state
7. Updated worker to handle client-side routing for React Router
8. Fixed server to handle master prompt from env or UI configuration
9. Added MASTER_PROMPT to env.example for easier local development
10. Fixed infinite loop in chat history fetching by removing hasInitialized from useEffect dependencies

## Next Steps
1. Continue with planned authentication system implementation
2. Enhanced UI/UX improvements
3. Story personalization features

## Active Decisions
1. Using React Router for proper client-side routing instead of manual URL manipulation
2. Chat IDs generated using random strings + timestamp for uniqueness
3. URLs automatically reflect current chat state - no separate sharing needed
4. Master prompt loaded from KV in production, env variable in development
5. Server architecture mirrors worker architecture for consistency

## Important Patterns
1. **URL Structure**: `/` → redirects to `/chat/{newId}`, `/chat/{id}` → loads specific chat
2. **State Management**: useEffect with chatId dependency for history loading
3. **Component Hierarchy**: App → Routes → ChatWrapper → Chat
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
