import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { blankDB, seedSample, migrate } from './logic';

const KEY = 'bgts_os_db';
const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [db, setDb] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const d = migrate(JSON.parse(raw));
          setDb(d);
          AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {});
          return;
        }
      } catch (e) { /* fall through to seed */ }
      const d = migrate(seedSample(blankDB()));
      setDb(d);
      AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {});
    })();
  }, []);

  const update = useCallback((mutator) => {
    setDb(prev => {
      const d = JSON.parse(JSON.stringify(prev));
      mutator(d);
      AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {});
      return d;
    });
  }, []);

  const replace = useCallback((d) => {
    setDb(d);
    AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {});
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
