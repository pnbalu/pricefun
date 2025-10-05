# Pricefun Chat (Expo + Supabase)

A minimal WhatsApp-like chat starter using Expo and Supabase with phone number OTP auth.

## Prerequisites
- Node 18+
- Expo CLI (`npm i -g expo`)
- Supabase project

## Setup
1. Create a Supabase project. In Authentication settings, enable Phone OTP.
2. Create a `.env` file with:
```
EXPO_PUBLIC_SUPABASE_URL=your-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
3. Apply SQL in `src/db/schema.sql` in Supabase SQL editor.
4. In Expo project:
```
npm install
npm run ios   # or android / web
```

## Notes
- Phone number must be in E.164 format (e.g. `+15555550123`).
- Session is persisted via `expo-secure-store`.
- Realtime messages use Supabase Realtime on `messages` table.
