import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useStore } from '../store';
import { C, S, Card, Btn, confirmDo } from '../ui';
import { blankDB, migrate, todayISO } from '../logic';

const FIELDS = [['name', 'Company Name'], ['gstin', 'GSTIN'], ['addr', 'Address'], ['phone', 'Phone'], ['email', 'Email'], ['lrPrefix', 'LR Number Prefix']];

export default function SettingsScreen() {
  const { db, update, replace } = useStore();
  const [co, setCo] = useState({ ...db.company });
  const [paste, setPaste] = useState('');

  const saveCompany = () => {
    update(d => { FIELDS.forEach(f => { d.company[f[0]] = co[f[0]] || ''; }); });
    Alert.alert('Saved', 'Company profile updated. New LRs use these details.');
  };

  const exportBackup = async () => {
    try {
      const uri = FileSystem.cacheDirectory + 'BGTS_OS_Backup_' + todayISO() + '.json';
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(db, null, 2));
      const ok = await Sharing.isAvailableAsync();
      if (ok) await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'BGTS-OS Backup' });
      else Alert.alert('Saved', 'Backup written to:\n' + uri);
    } catch (e) { Alert.alert('Backup error', String(e.message || e)); }
  };

  const restore = () => {
    try {
      const d = JSON.parse(paste);
      if (!d || !d.company || !Array.isArray(d.bookings)) { Alert.alert('Invalid', 'Not a valid BGTS-OS backup.'); return; }
      const md = migrate(d);   /* older backups get v2 keys (lrs, lhcs, advances, acctExp) */
      confirmDo('Replace ALL current data with the pasted backup?', () => { replace(md); setCo({ ...md.company }); setPaste(''); Alert.alert('Done', 'Backup restored.'); });
    } catch (e) { Alert.alert('Invalid JSON', String(e.message || e)); }
  };

  const wipe = () => confirmDo('Erase ALL data on this device? Export a backup first.', () =>
    confirmDo('Final confirmation — erase everything?', () => { const d = blankDB(); replace(d); setCo({ ...d.company }); }));


  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <Card title="Company Profile (prints on LR)">
        {FIELDS.map(f => (
          <View key={f[0]} style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 10.5, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginBottom: 4 }}>{f[1]}</Text>
            <TextInput value={co[f[0]] || ''} onChangeText={t => setCo(p => ({ ...p, [f[0]]: t }))}
              style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13.5, color: C.txt, backgroundColor: '#fff' }} />
          </View>
        ))}
        <Btn label="Save Profile" tone="amber" onPress={saveCompany} />
      </Card>

      <Card title="Data & Backup">
        <Text style={{ fontSize: 12, color: C.mut, marginBottom: 10 }}>
          Data lives on this device (AsyncStorage). Export a JSON backup regularly — it is your off-device safety copy until the hosted multi-user backend is built.
        </Text>
        <View style={[S.wrapRow]}>
          <Btn label="⬇ Export Backup (JSON)" onPress={exportBackup} />
          <Btn label="Erase ALL Data" tone="red" onPress={wipe} />
        </View>
        <Text style={{ fontSize: 10.5, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginTop: 14, marginBottom: 4 }}>Restore: paste backup JSON</Text>
        <TextInput value={paste} onChangeText={setPaste} multiline placeholder='{"company":{...}}' placeholderTextColor={C.line2}
          style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 8, padding: 10, fontSize: 11, color: C.txt, backgroundColor: '#fff', minHeight: 80 }} />
        <View style={{ marginTop: 8 }}>
          <Btn label="⬆ Restore Backup" onPress={restore} />
        </View>
      </Card>

      <Card title="About This Build">
        <Text style={{ fontSize: 12, color: C.mut }}>
          BGTS-OS Mobile v1.0 (React Native / Expo) — same data model and modules as the web build: Bookings, LR/CN with PDF share, Masters, Owned & Hired Fleet, Renewals, Contracts/Tenders rate engine, Accounting, Reports, WhatsApp/Email triggers. The hosted multi-user backend (shared database, logins, e-way bill API, Zoho Books sync) is the Phase 1 server build in BGTS_TMS_System_Design.md.
        </Text>
      </Card>
    </ScrollView>
  );
}
