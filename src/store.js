import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { blankDB, seedSample, migrate } from './logic';
import { alert } from './ui';

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

export function StoreProvider({ children }) {
  const [db, setDb] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const d = migrate(JSON.parse(raw));
          setDb(d);
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
      AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(warnStorageFailure);
    })();
  }, []);

  const update = useCallback((mutator) => {
    setDb(prev => {
      const d = JSON.parse(JSON.stringify(prev));
      mutator(d);
      AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(warnStorageFailure);
      return d;
    });
  }, []);

  const replace = useCallback((d) => {
    setDb(d);
    AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(warnStorageFailure);
  }, []);

  if (!db) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a1f38', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#e8a33d', fontSize: 24, fontWeight: '800', marginBottom: 12 }}>BGTS-OS</Text>
        <ActivityIndicator color="#e8a33d" />
      </View>
    );
  }
  return <Ctx.Provider value={{ db, update, replace }}>{children}</Ctx.Provider>;
}

export function useStore() { return useContext(Ctx); }
