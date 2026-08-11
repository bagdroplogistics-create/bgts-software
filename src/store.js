import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { blankDB, seedSample, migrate } from './logic';
import { alert } from './ui';
import { pullDb, pushDb, seedIfEmpty } from './dbSync';

const KEY = 'bgts_os_db';
const Ctx = createContext(null);

/* Every save used to end in .catch(() => {}) — any storage failure (quota exceeded,
   private-browsing restrictions, etc.) was invisible: the screen would still look like
   it saved (in-memory state updates regardless), but the change would silently vanish
   on the next reload with zero indication anything went wrong. Surface it instead, once
   per session so a run of failures doesn't spam the user with repeat alerts. */
let storageWarned = false;
function warnStorageFailure(e) {
  if (storageWarned) return;
  storageWarned = true;
  alert('Data not saving', 'Your last change may not be saved to this device/browser (storage error: ' + String((e && e.message) || e) + '). Export a backup now from Settings to be safe, and avoid closing or refreshing this tab until it\'s resolved.');
}

/* Same idea for the shared database: a Supabase write failure (offline, RLS
   misconfigured, schema not exposed yet, etc.) must not be silent — the
   change stays visible in this tab (optimistic local state + AsyncStorage
   still succeeded) but hasn't reached the shared database other devices
   read from. Warn once per session rather than once per failed write. */
let dbWarned = false;
function warnDbFailure(e) {
  if (dbWarned) return;
  dbWarned = true;
  alert('Change not synced to database', 'Your last change was saved on this device but could not be written to the shared database (' + String((e && e.message) || e) + '). It will keep retrying on your next change — if this keeps happening, check your internet connection and that the Supabase project is reachable.');
}

export function StoreProvider({ children }) {
  const [db, setDb] = useState(null);
  const [syncState, setSyncState] = useState('idle'); // 'idle' | 'saving' | 'error'
  /* Tracks the last db snapshot we successfully pushed to Supabase (or the
     one we just pulled from it), so update()/replace() can diff against the
     right baseline even though React state updates are batched/async. Not
     rendered — a ref is exactly right here. */
  const dbSyncRef = useRef(null);
  const dbLoadedFromServer = useRef(false);

  useEffect(() => {
    (async () => {
      /* Prefer the shared database if it's reachable and already migrated
         (see dbSync.pullDb — returns null until Task 70's one-time seed has
         run). This is what makes the data persistent/shared across devices,
         not just this browser's AsyncStorage. */
      try {
        const remote = await pullDb();
        if (remote) {
          setDb(remote);
          dbSyncRef.current = remote;
          dbLoadedFromServer.current = true;
          AsyncStorage.setItem(KEY, JSON.stringify(remote)).catch(() => {});
          return;
        }
      } catch (e) {
        /* Can't reach Supabase (offline, RLS not exposed yet, etc.) — fall
           through to the AsyncStorage path below so the app still works.
           Surfaced via warnDbFailure the first time a write also fails,
           rather than blocking startup on a read-only hiccup. */
      }

      /* Remote has nothing yet (bgts_os hasn't been migrated into on this
         project, or it's unreachable) — fall back to AsyncStorage exactly as
         before. Deliberately NOT auto-pushing local data to Supabase here:
         a one-time migration of a device's real, existing business data
         should be a visible, confirmable action (Settings → "Sync to
         Database"), not something that fires silently on next app load and
         risks leaving the shared database half-populated if it's
         interrupted partway through. See SettingsScreen.js. */
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const d = migrate(JSON.parse(raw));
          setDb(d);
          dbSyncRef.current = d;
          AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(warnStorageFailure);
          return;
        }
      } catch (e) {
        /* Existing saved data failed to load/parse — falling through to a fresh seed.
           This is the scenario that most looks like "my data disappeared", so flag it
           loudly instead of silently starting over. */
        alert('Could not load saved data', 'Your existing data on this device/browser could not be read (' + String((e && e.message) || e) + '). Starting from a fresh dataset — if you have a backup JSON, restore it from Settings.');
      }
      const d = migrate(seedSample(blankDB()));
      setDb(d);
      dbSyncRef.current = d;
      AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(warnStorageFailure);
    })();
  }, []);

  const syncToDb = useCallback((prev, next) => {
    setSyncState('saving');
    pushDb(prev, next)
      .then(() => setSyncState('idle'))
      .catch(e => { setSyncState('error'); warnDbFailure(e); });
  }, []);

  const update = useCallback((mutator) => {
    setDb(prev => {
      const d = JSON.parse(JSON.stringify(prev));
      mutator(d);
      AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(warnStorageFailure);
      const prevSynced = dbSyncRef.current;
      dbSyncRef.current = d;
      syncToDb(prevSynced, d);
      return d;
    });
  }, [syncToDb]);

  const replace = useCallback((d) => {
    const prevSynced = dbSyncRef.current;
    dbSyncRef.current = d;
    setDb(d);
    AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(warnStorageFailure);
    syncToDb(prevSynced, d);
  }, [syncToDb]);

  /* One-time, explicit push of everything currently on this device up to the
     shared Supabase database — see the comment in the mount effect above for
     why this isn't automatic. Safe to run more than once/retry after a
     partial failure: every underlying write is either an upsert-by-id or a
     delete-then-reinsert of a whole child set, both idempotent. */
  const migrateToDatabase = useCallback(async () => {
    setSyncState('saving');
    try {
      await seedIfEmpty(db);
      dbSyncRef.current = db;
      dbLoadedFromServer.current = true;
      setSyncState('idle');
    } catch (e) {
      setSyncState('error');
      throw e;
    }
  }, [db]);

  if (!db) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a1f38', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#e8a33d', fontSize: 24, fontWeight: '800', marginBottom: 12 }}>BGTS-OS</Text>
        <ActivityIndicator color="#e8a33d" />
      </View>
    );
  }
  return (
    <Ctx.Provider value={{ db, update, replace, syncState, migrateToDatabase, usingSharedDb: dbLoadedFromServer.current }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() { return useContext(Ctx); }
