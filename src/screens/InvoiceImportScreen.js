import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, Table, alert } from '../ui';
import { readPickedFile } from '../fileIO';
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
      const txt = await readPickedFile(a).catch(() => '');
      if (isBillingRegister(txt)) { ingestText(txt); return; }
      if (/\.xlsx?$/i.test(a.name || '')) { alert('Excel on mobile', 'This Excel is not a BILLING_REGISTER export — save it as CSV first (binary Excel imports on the desktop web app).'); return; }
      ingestText(txt);
    } catch (e) { alert('Error', String(e.message || e)); }
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
      alert('Invoice import', (res ? res.created : 0) + ' created' + (res && res.skipped ? ', ' + res.skipped + ' skipped' : '') + '.');
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
          <Btn label="Parse Pasted Text" onPress={() => { if (!paste.trim()) { alert('Nothing to parse'); return; } ingestText(paste); }} />
        </View>
      </Card>

      {plan ? (
        plan.error ? <Card><Empty text={plan.error} /></Card> : (
          <Card title={'Preview — ' + plan.items.length + ' row(s)'}>
            <View style={[S.wrapRow, { marginBottom: 8 }]}>
              <Badge text={okCount + ' READY'} tone="green" />
              {plan.items.length - okCount ? <Badge text={(plan.items.length - okCount) + ' SKIP'} tone="red" /> : null}
            </View>
            <Table
              cols={[
                { key: 'row', label: 'Row', width: 50 },
                { key: 'status', label: 'Status', width: 80 },
                { key: 'invoice', label: 'Invoice', width: 110 },
                { key: 'date', label: 'Date', width: 80 },
                { key: 'client', label: 'Client', width: 160 },
                { key: 'total', label: 'Total', width: 90 },
                { key: 'issues', label: 'Issues', width: 220 }
              ]}
              rows={plan.items.slice(0, 25).map(it => ({
                row: it.row,
                status: <Badge text={it.errors.length ? 'SKIP' : 'OK'} tone={it.errors.length ? 'red' : 'green'} />,
                invoice: it.inv.invNo + (it.autoNo ? ' (auto)' : ''),
                date: fmtDate(it.inv.date),
                client: it.inv.clientId ? clientName(db, it.inv.clientId) : (it.clientNameNew || '—'),
                total: inr(it.inv.total),
                issues: (it.errors.length || it.warns.length)
                  ? <Text style={{ fontSize: 10.5, color: it.errors.length ? C.red : C.mut }}>{it.errors.concat(it.warns).join('; ')}</Text>
                  : '—'
              }))}
            />
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
