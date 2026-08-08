import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty } from '../ui';
import {
  inr, fmtDate, parseCSV, buildInvImportPlan, applyInvImportAoa, clientName,
  isBillingRegister, parseBillingRegister, registerToInvoiceAoa
} from '../logic';

export default function InvoiceImportScreen({ navigation }) {
  const { db, update } = useStore();
  const [paste, setPaste] = useState('');
  const [aoa, setAoa] = useState(null);
  const [regBills, setRegBills] = useState(null);
  const plan = aoa ? buildInvImportPlan(db, aoa) : null;

  const ingestText = (txt) => {
    if (isBillingRegister(txt)) {
      const bills = parseBillingRegister(txt);
      setRegBills(bills);
      setAoa(registerToInvoiceAoa(bills));
    } else {
      setRegBills(null);
      setAoa(parseCSV(txt));
    }
  };
  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets || !res.assets.length) return;
      const a = res.assets[0];
      const txt = await FileSystem.readAsStringAsync(a.uri).catch(() => '');
      if (isBillingRegister(txt)) { ingestText(txt); return; }
      if (/\.xlsx?$/i.test(a.name || '')) { Alert.alert('Excel on mobile', 'This Excel is not a BILLING_REGISTER export — save it as CSV first (binary Excel imports on the desktop web app).'); return; }
      ingestText(txt);
    } catch (e) { Alert.alert('Error', String(e.message || e)); }
  };
  const doImport = () => {
    let res = null;
    const bills = regBills;
    update(d => {
      res = applyInvImportAoa(d, aoa);
      if (bills) d.billingBackup = bills.map(b => ({ no: b.billNo, client: b.client, date: b.date, lines: b.lines, total: b.total }));
    });
    setAoa(null); setPaste(''); setRegBills(null);
    setTimeout(() => {
      Alert.alert('Invoice import', (res ? res.created : 0) + ' created' + (res && res.skipped ? ', ' + res.skipped + ' skipped' : '') + '.');
      navigation.goBack();
    }, 100);
  };

  const okCount = plan ? plan.items.filter(i => !i.errors.length).length : 0;

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <Card title="Import Invoices from CSV">
        <Text style={{ fontSize: 11.5, color: C.mut, marginBottom: 10 }}>
          Two formats: (1) CSV — invoice_no (blank = auto), date, client_name, taxable_amount, gst_pct…; (2) your software's BILLING_REGISTER .xls export — detected automatically, each bill posts company-wise (client · bill no · date · amount) and the archive updates alongside.
        </Text>
        <Btn label="⬆ Pick CSV File" tone="amber" onPress={pickFile} />
        <Text style={{ fontSize: 10.5, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginTop: 12, marginBottom: 4 }}>Or paste CSV</Text>
        <TextInput value={paste} onChangeText={setPaste} multiline placeholderTextColor={C.line2}
          placeholder={'invoice_no,date,client_name,taxable_amount,gst_pct\n,2026-08-07,USHTA (Sample Client),18500,0'}
          style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 8, padding: 10, fontSize: 11, color: C.txt, backgroundColor: '#fff', minHeight: 80 }} />
        <View style={{ marginTop: 8 }}>
          <Btn label="Parse Pasted Text" onPress={() => { if (!paste.trim()) { Alert.alert('Nothing to parse'); return; } ingestText(paste); }} />
        </View>
      </Card>

      {plan ? (
        plan.error ? <Card><Empty text={plan.error} /></Card> : (
          <Card title={'Preview — ' + plan.items.length + ' row(s)'}>
            <View style={[S.wrapRow, { marginBottom: 8 }]}>
              <Badge text={okCount + ' READY'} tone="green" />
              {plan.items.length - okCount ? <Badge text={(plan.items.length - okCount) + ' SKIP'} tone="red" /> : null}
            </View>
            {plan.items.slice(0, 25).map(it => (
              <View key={it.row} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 7 }}>
                <View style={[S.row, { justifyContent: 'space-between' }]}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy, flex: 1 }}>
                    Row {it.row} · {it.inv.invNo}{it.autoNo ? ' (auto)' : ''}
                  </Text>
                  <Badge text={it.errors.length ? 'SKIP' : 'OK'} tone={it.errors.length ? 'red' : 'green'} />
                </View>
                <Text style={{ fontSize: 11.5, color: C.txt }}>
                  {fmtDate(it.inv.date)} · {it.inv.clientId ? clientName(db, it.inv.clientId) : (it.clientNameNew || '—')} · {inr(it.inv.total)}
                </Text>
                {(it.errors.length || it.warns.length) ? (
                  <Text style={{ fontSize: 10.5, color: it.errors.length ? C.red : C.mut }}>{it.errors.concat(it.warns).join('; ')}</Text>
                ) : null}
              </View>
            ))}
            <View style={[S.wrapRow, { justifyContent: 'flex-end', marginTop: 12 }]}>
              <Btn label="Cancel" tone="ghost" onPress={() => setAoa(null)} />
              {okCount ? <Btn label={'Import ' + okCount} tone="amber" onPress={doImport} /> : null}
            </View>
          </Card>
        )
      ) : null}
    </ScrollView>
  );
}
