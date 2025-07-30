# Project Brief

## Project Overview
DreamTales is an AI-powered bedtime story chat application designed for children ages 3-7. Using OpenAI's GPT models, it creates personalized, therapeutic bedtime stories that help children process emotions, learn valuable lessons, and transition to sleep in a calming, engaging way.

## Core Requirements
1. **AI Chat System**: Real-time conversation with OpenAI integration for story generation
2. **URL-based Sessions**: Each chat has unique URLs for easy session management
3. **Master Prompt Management**: Configurable AI behavior for different storytelling approaches
4. **Chat Persistence**: Session history stored and retrievable via chat IDs
5. **Responsive Design**: Works seamlessly on tablets and phones for bedtime use
6. **Rate Limiting**: Protects against abuse while allowing natural conversation flow

## Goals
- Create a magical, therapeutic bedtime experience for children
- Provide parents with a reliable, age-appropriate storytelling companion
- Ensure conversations feel natural and engaging, not robotic
- Build a scalable system that can handle multiple simultaneous chats
- Maintain child safety through content filtering and appropriate responses

## Constraints
- **Child Safety**: All content must be age-appropriate and therapeutic
- **Performance**: Response times under 3 seconds for good conversation flow
- **Deployment**: Must run on Cloudflare Workers for global edge performance
- **Accessibility**: Clear, readable interface suitable for children and tired parents
- **Cost Control**: Rate limiting and efficient API usage to control OpenAI costs
