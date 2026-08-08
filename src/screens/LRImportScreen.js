import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty } from '../ui';
import {
  inr, fmtDate, csvString, parseCSV, buildLRImportPlan, applyLRImportAoa,
  LR_IMPORT_HEADERS, todayISO
} from '../logic';

export default function LRImportScreen({ navigation }) {
  const { db, update } = useStore();
  const [paste, setPaste] = useState('');
  const [aoa, setAoa] = useState(null);
  const plan = aoa ? buildLRImportPlan(db, aoa) : null;

  const shareTemplate = async () => {
    try {
      const rows = [
        LR_IMPORT_HEADERS,
        ['', 'ORIGINAL', todayISO(), 'Owned', 'GJ19X6890', 'Vadodara', 'Mumbai', 'VADODARA', 'USHTA (Sample Client)', '24AAAAA0000A1Z5', 'Receiver Co Ltd', '', 'Consignor', 'TO BE BILLED', 'Industrial castings', '10', '14', '14', '', '', '18500', '', '', '', '0', '0', '0', '', '', '', ''],
        ['', 'ORIGINAL', todayISO(), 'Hired', 'GJ01AB1234', 'Vadodara', 'Ahmedabad', 'VADODARA', 'USHTA (Sample Client)', '', 'Receiver Co Ltd', '', 'Consignor', 'TO BE BILLED', 'Packaged goods', '20', '8', '8', '', '', '7200', '', '', '', '0', '0', '0', 'Sample Transport Vendor', '5600', '2000', '']
      ];
      const uri = FileSystem.cacheDirectory + 'BGTS_LR_Import_Template.csv';
      await FileSystem.writeAsStringAsync(uri, csvString(rows));
      const ok = await Sharing.isAvailableAsync();
      if (ok) await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'LR Import Template' });
      else Alert.alert('Saved', uri);
    } catch (e) { Alert.alert('Error', String(e.message || e)); }
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets || !res.assets.length) return;
      const a = res.assets[0];
      if (/\.xlsx?$/i.test(a.name || '')) { Alert.alert('Excel on mobile', 'On the phone, use CSV (save your Excel sheet as CSV first). Excel files import directly on the desktop web app.'); return; }
      const text = await FileSystem.readAsStringAsync(a.uri);
      setAoa(parseCSV(text));
    } catch (e) { Alert.alert('Could not read file', String(e.message || e)); }
  };

  const parsePasted = () => {
    if (!String(paste).trim()) { Alert.alert('Nothing to parse', 'Paste CSV text first (including the header row).'); return; }
    setAoa(parseCSV(paste));
  };

  const doImport = () => {
    let result = null;
    update(d => { result = applyLRImportAoa(d, aoa); });
    setAoa(null); setPaste('');
    setTimeout(() => {
      Alert.alert('Import complete', (result ? result.created : 0) + ' LR(s) created' + (result && result.skipped ? ', ' + result.skipped + ' row(s) skipped (errors)' : '') + '.');
      navigation.goBack();
    }, 100);
  };

  const okCount = plan ? plan.items.filter(i => !i.errors.length).length : 0;
  const errCount = plan ? plan.items.length - okCount : 0;

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <Card title="Import LRs from CSV">
        <Text style={{ fontSize: 12, color: C.mut, marginBottom: 10 }}>
          Row 1 = headers, one LR per row — use the template for column names (order doesn't matter, unknown columns ignored). Ownership: Owned or Hired; hired rows need hire_vendor, and hire_advance posts to Accounting. Blank lr_no auto-numbers. Dates: YYYY-MM-DD or DD-MM-YYYY. Excel files: use the desktop web app, or save as CSV.
        </Text>
        <View style={S.wrapRow}>
          <Btn label="⬇ Share Template CSV" onPress={shareTemplate} />
          <Btn label="⬆ Pick CSV File" tone="amber" onPress={pickFile} />
        </View>
        <Text style={{ fontSize: 10.5, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginTop: 14, marginBottom: 4 }}>
          Or paste CSV text (from Excel / WhatsApp / email)
        </Text>
        <TextInput value={paste} onChangeText={setPaste} multiline
          placeholder={'lr_no,date,ownership,truck_no,from_place,to_place,consignor_name,consignee_name,freight\n,2026-08-07,Owned,GJ19X6890,Vadodara,Mumbai,USHTA,Receiver Co,18500'}
          placeholderTextColor={C.line2}
          style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 8, padding: 10, fontSize: 11, color: C.txt, backgroundColor: '#fff', minHeight: 90 }} />
        <View style={{ marginTop: 8 }}>
          <Btn label="Parse Pasted CSV" onPress={parsePasted} />
        </View>
      </Card>

      {plan ? (
        plan.error ? <Card><Empty text={plan.error} /></Card> : (
          <Card title={'Preview — ' + plan.items.length + ' row(s)'}>
            <View style={[S.wrapRow, { marginBottom: 8 }]}>
              <Badge text={okCount + ' READY'} tone="green" />
              {errCount ? <Badge text={errCount + ' SKIP (ERRORS)'} tone="red" /> : null}
              {plan.unknownHeaders.length ? <Badge text={plan.unknownHeaders.length + ' cols ignored'} tone="amber" /> : null}
            </View>
            {plan.items.slice(0, 30).map(it => (
              <View key={it.row} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 7 }}>
                <View style={[S.row, { justifyContent: 'space-between' }]}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy, flex: 1 }}>
                    Row {it.row} · {it.lr.lrNo}{it.autoNo ? ' (auto)' : ''} · {it.lr.ownership === 'Hired' ? 'HIRED' : 'OWNED'}
                  </Text>
                  <Badge text={it.errors.length ? 'SKIP' : 'OK'} tone={it.errors.length ? 'red' : 'green'} />
                </View>
                <Text style={{ fontSize: 11.5, color: C.txt }}>
                  {fmtDate(it.lr.date)} · {it.lr.truckNo} · {it.lr.fromPlace} → {it.lr.toPlace} · {inr(it.lr.gross)}
                </Text>
                {(it.errors.length || it.warns.length) ? (
                  <Text style={{ fontSize: 10.5, color: it.errors.length ? C.red : C.mut }}>
                    {it.errors.concat(it.warns).join('; ')}
                  </Text>
                ) : null}
              </View>
            ))}
            {plan.items.length > 30 ? <Text style={{ fontSize: 11, color: C.mut, marginTop: 6 }}>…and {plan.items.length - 30} more rows (all processed on import)</Text> : null}
            <View style={[S.wrapRow, { justifyContent: 'flex-end', marginTop: 12 }]}>
              <Btn label="Cancel" tone="ghost" onPress={() => { setAoa(null); }} />
              {okCount ? <Btn label={'Import ' + okCount + ' LR(s)'} tone="amber" onPress={doImport} /> : null}
            </View>
          </Card>
        )
      ) : null}
    </ScrollView>
  );
}
