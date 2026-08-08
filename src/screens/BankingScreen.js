import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, Table } from '../ui';
import {
  inr, fmtDate, byId, parseCSV, importBankAoa, bankSuggest, matchBankTxn,
  invOutstanding, clientName, receiptHtml, csvString, todayISO
} from '../logic';

export default function BankingScreen() {
  const { db, update } = useStore();
  const [paste, setPaste] = useState('');
  const [form, setForm] = useState(null);

  const runImport = (aoa) => {
    let res = null;
    update(d => { res = importBankAoa(d, aoa); });
    setPaste('');
    setTimeout(() => Alert.alert('Bank import',
      (res ? res.added : 0) + ' credit(s) added' + (res && res.dupes ? ', ' + res.dupes + ' duplicate(s) skipped' : '') + (res && res.debits ? ', ' + res.debits + ' debit(s) ignored' : '') + '.'), 100);
  };
  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets || !res.assets.length) return;
      const a = res.assets[0];
      if (/\.xlsx?$/i.test(a.name || '')) { Alert.alert('Excel on mobile', 'Save the statement as CSV first (Excel imports directly on the desktop web app).'); return; }
      runImport(parseCSV(await FileSystem.readAsStringAsync(a.uri)));
    } catch (e) { Alert.alert('Error', String(e.message || e)); }
  };

  const doMatch = (t) => {
    const sugg = bankSuggest(db, t);
    if (!sugg.length) { Alert.alert('No open invoices', 'There are no invoices with outstanding balance to match against.'); return; }
    setForm({
      title: 'Match ' + inr(t.amount) + ' — ' + (t.narration || t.ref || 'bank credit').slice(0, 40),
      fields: [{
        key: 'invoiceId', label: 'Against Invoice', type: 'select', required: true, value: sugg[0].id,
        options: sugg.map(inv => ({
          v: inv.id,
          l: inv.invNo + ' · ' + clientName(db, inv.clientId) + ' · ' + inr(invOutstanding(db, inv)) + ' due' + (Math.abs(invOutstanding(db, inv) - t.amount) < 0.01 ? ' ✓ exact' : '')
        }))
      }],
      submitLabel: 'Match → Create Receipt',
      onSubmit: (v) => update(d => { matchBankTxn(d, t.id, v.invoiceId); })
    });
  };
  const shareReceipt = async (p) => {
    try {
      const { uri } = await Print.printToFileAsync({ html: receiptHtml(db, p) });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: p.mrNo });
    } catch (e) { Alert.alert('Error', String(e.message || e)); }
  };

  const shareTemplate = async () => {
    try {
      const rows = [['date', 'narration', 'ref', 'debit', 'credit'], [todayISO(), 'NEFT-USHTA SAMPLE PAYMENT', 'UTR12345', '', '18500']];
      const uri = FileSystem.cacheDirectory + 'Bank_Statement_Template.csv';
      await FileSystem.writeAsStringAsync(uri, csvString(rows));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Bank_Statement_Template.csv' });
      else Alert.alert('Saved', uri);
    } catch (e) { Alert.alert('Error', String(e.message || e)); }
  };

  const un = db.bankTxns.filter(t => t.status === 'UNMATCHED').slice().reverse();
  const done = db.bankTxns.filter(t => t.status !== 'UNMATCHED').slice().reverse();

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <Card title="Import Bank Statement (credits → match → receipt)">
        <Text style={{ fontSize: 11.5, color: C.mut, marginBottom: 10 }}>
          Only CREDIT rows are taken (inward payments); duplicates auto-skip so overlapping periods are safe. Columns: date, narration, ref/UTR, debit, credit (or amount + Dr/Cr).
        </Text>
        <View style={S.wrapRow}>
          <Btn label="⬆ Pick Statement CSV" tone="amber" onPress={pickFile} />
          <Btn label="Template" tone="ghost" onPress={shareTemplate} />
        </View>
        <Text style={{ fontSize: 10.5, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginTop: 12, marginBottom: 4 }}>Or paste statement CSV</Text>
        <TextInput value={paste} onChangeText={setPaste} multiline placeholderTextColor={C.line2}
          placeholder={'date,narration,ref,debit,credit\n06-08-2026,NEFT USHTA PAYMENT,UTR123,,18500'}
          style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 8, padding: 10, fontSize: 11, color: C.txt, backgroundColor: '#fff', minHeight: 70 }} />
        <View style={{ marginTop: 8 }}>
          <Btn label="Parse Pasted Statement" onPress={() => { if (!paste.trim()) { Alert.alert('Nothing to parse'); return; } runImport(parseCSV(paste)); }} />
        </View>
      </Card>

      <Card title={'Unmatched Credits (' + un.length + ')'}>
        {!un.length ? <Empty text="Nothing to match. Import a statement above." /> : (
          <Table
            cols={[
              { key: 'date', label: 'Date', width: 80 },
              { key: 'narration', label: 'Narration', width: 200 },
              { key: 'ref', label: 'Ref / UTR', width: 110 },
              { key: 'amount', label: 'Amount', width: 90 },
              { key: 'actions', label: 'Match Against Invoice', width: 200 }
            ]}
            rows={un.map(t => ({
              date: fmtDate(t.date),
              narration: t.narration || '—',
              ref: t.ref || '—',
              amount: <Text style={{ fontWeight: '800', color: C.navy }}>{inr(t.amount)}</Text>,
              actions: (
                <View style={S.wrapRow}>
                  <Btn small tone="green" label="Match → Receipt" onPress={() => doMatch(t)} />
                  <Btn small tone="ghost" label="Ignore" onPress={() => update(d => { const x = byId(d.bankTxns, t.id); if (x) x.status = 'IGNORED'; })} />
                </View>
              )
            }))}
          />
        )}
      </Card>

      {done.length ? (
        <Card title={'Matched / Ignored (' + done.length + ')'}>
          <Table
            cols={[
              { key: 'date', label: 'Date', width: 80 },
              { key: 'narration', label: 'Narration', width: 200 },
              { key: 'amount', label: 'Amount', width: 90 },
              { key: 'status', label: 'Status', width: 90 },
              { key: 'receipt', label: 'Receipt', width: 100 },
              { key: 'actions', label: '', width: 100 }
            ]}
            rows={done.slice(0, 25).map(t => {
              const p = t.paymentId ? byId(db.payments, t.paymentId) : null;
              return {
                date: fmtDate(t.date),
                narration: (t.narration || '—').slice(0, 50),
                amount: <Text style={{ fontWeight: '700', color: C.navy }}>{inr(t.amount)}</Text>,
                status: <Badge text={t.status} tone={t.status === 'MATCHED' ? 'green' : 'amber'} />,
                receipt: p ? (
                  <View style={S.wrapRow}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.navy }}>{p.mrNo}</Text>
                    <Btn small tone="ghost" label="Print" onPress={() => shareReceipt(p)} />
                  </View>
                ) : '—',
                actions: t.status === 'IGNORED' ? <Btn small tone="ghost" label="Restore" onPress={() => update(d => { const x = byId(d.bankTxns, t.id); if (x) x.status = 'UNMATCHED'; })} /> : null
              };
            })}
          />
        </Card>
      ) : null}
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
