import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/* Supabase project setup for BGTS-OS.
   URL/anon key come from EXPO_PUBLIC_* env vars (Expo inlines these into the
   bundle at build time automatically — no extra babel config needed on
   SDK 49+). The anon key is safe to ship in the client bundle by design;
   Row Level Security (see supabase/migrations/0003_rls.sql) is what actually
   protects the data, not keeping this key secret.

   All BGTS-OS tables live in the "bgts_os" Postgres schema (not "public") so
   they never collide with tables from any other app sharing this same
   Supabase project. db.schema('bgts_os') below is what points every query at
   that schema instead of the default.

   IMPORTANT one-time dashboard step this depends on: Supabase's auto-REST
   API only serves the "public" schema by default. Until "bgts_os" is added
   to Project Settings -> API -> Exposed schemas (Data API settings) in the
   Supabase dashboard, every query through this client will fail with a
   "schema must be one of the following: public" error even though the
   tables exist and the migration ran successfully. */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase env vars missing (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY). ' +
    'The app will fail to reach the database until these are set in .env (local) ' +
    'and in the Vercel project\'s Environment Variables (deployed build).'
  );
}

/* Native (iOS/Android via Expo Go or a dev client) needs an explicit storage
   adapter for session persistence — web uses the browser's own localStorage
   automatically and should NOT be given the AsyncStorage adapter (doing so
   is a common source of "login doesn't persist across refresh" bugs on web). */
const authOptions = Platform.OS === 'web'
  ? { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  : { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false };

export const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '', {
  auth: authOptions,
  db: { schema: 'bgts_os' },
});
