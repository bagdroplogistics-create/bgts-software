import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Btn, Empty, confirmDo, Table, PickerField, alert } from '../ui';
import { inr, fmtDate, byId, removeById, sum, importLegacyBills, LEGACY_BILLS } from '../logic';

/* "VIEW BILL DETAILS" register — the Bill module's own list/detail screen,
   reached from BillFormScreen's top-right button (and after SAVE & LIST).
   Independent of LRScreen.js; only reads db.bills / db.vendorDirectory. */
export default function BillListScreen({ navigation }) {
  const { db, update } = useStore();
  const [q, setQ] = useState('');
  const [vendorId, setVendorId] = useState('');

  const vendorNameOf = (id) => { const v = byId(db.vendorDirectory || [], id); return v ? (v.name || '(blank name)') : '—'; };

  const list = (db.bills || []).slice()
    .filter(b => !vendorId || b.vendorId === vendorId)
    .filter(b => {
      if (!q) return true;
      const hay = (b.invoiceNo + ' ' + vendorNameOf(b.vendorId) + ' ' + (b.poNo || '')).toLowerCase();
      return hay.indexOf(q.toLowerCase()) >= 0;
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));

  const listNet = sum(list, b => b.netAmount);

  const del = (b) => confirmDo('Delete Bill ' + (b.invoiceNo || '') + '?', () => update(d => removeById(d.bills, b.id)));

  const doImportLegacyBills = () => update(d => {
    const { added, skippedNoVendor } = importLegacyBills(d);
    setTimeout(() => {
      let msg = added + ' bill(s) added';
      msg += (added < LEGACY_BILLS.length - skippedNoVendor) ? ', ' + (LEGACY_BILLS.length - skippedNoVendor - added) + ' already on file (skipped).' : '.';
      if (skippedNoVendor) msg += ' ' + skippedNoVendor + ' bill(s) skipped — their vendor isn’t in Vendor Directory yet. Import Masters → Vendor Directory first, then re-run this.';
      alert('Billing Summary imported', msg);
    }, 100);
  });

  const vendorOptions = [{ v: '', l: 'All Vendors' }, ...(db.vendorDirectory || [])
    .slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .map(v => ({ v: v.id, l: v.name || '(blank name)' }))];

  return (
    <View style={S.screen}>
      <View style={{ padding: 14, paddingBottom: 6, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <Btn label="Import Billing Summary (148 bills)" tone="ghost" onPress={doImportLegacyBills} />
        <Btn label="+ ADD NEW BILL" tone="amber" onPress={() => navigation.navigate('Bill', {})} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: 60 }}>
        <Card title="Bill Details">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <View style={{ minWidth: 220, gap: 4 }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: C.mut, textTransform: 'uppercase' }}>Vendor</Text>
              <PickerField value={vendorId} onChange={setVendorId} options={vendorOptions} />
            </View>
            <View style={{ minWidth: 220, flexGrow: 1, gap: 4 }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: C.mut, textTransform: 'uppercase' }}>Search (Invoice No / Vendor / PO No)</Text>
              <TextInput value={q} onChangeText={setQ} placeholder="Type to search…" placeholderTextColor={C.mut}
                style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 7, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: C.txt }} />
            </View>
            <Btn small tone="ghost" label="Reset" onPress={() => { setQ(''); setVendorId(''); }} />
          </View>

          {!list.length ? (
            <Empty text={(db.bills || []).length ? 'No bills match this search.' : 'No bills yet. Tap + ADD NEW BILL.'} />
          ) : (<>
            <Text style={{ fontSize: 11.5, color: C.mut, marginBottom: 8 }}>{list.length} bill(s) · Net {inr(listNet)}</Text>
            <Table
              cols={[
                { key: 'invoiceNo', label: 'Invoice No', width: 100 },
                { key: 'vendor', label: 'Vendor', width: 170 },
                { key: 'date', label: 'Date', width: 90 },
                { key: 'poNo', label: 'PO No', width: 90 },
                { key: 'gross', label: 'Gross', width: 100 },
                { key: 'net', label: 'Net Amount', width: 100 },
                { key: 'balance', label: 'Balance', width: 100 },
                { key: 'actions', label: '', width: 150 }
              ]}
              rows={list.map(b => ({
                invoiceNo: <Text style={{ fontWeight: '700', color: C.navy }}>{b.invoiceNo}</Text>,
                vendor: vendorNameOf(b.vendorId),
                date: fmtDate(b.date),
                poNo: b.poNo || '—',
                gross: inr(b.totalAmount),
                net: <Text style={{ fontWeight: '800', color: C.navy }}>{inr(b.netAmount)}</Text>,
                balance: <Text style={{ fontWeight: '700', color: Number(b.balanceAmount) > 0 ? C.red : C.green }}>{inr(b.balanceAmount)}</Text>,
                actions: (
                  <View style={S.wrapRow}>
                    <Btn small tone="ghost" label="Edit" onPress={() => navigation.navigate('Bill', { billId: b.id })} />
                    <Btn small tone="red" label="✕" onPress={() => del(b)} />
                  </View>
                )
              }))}
            />
          </>)}
        </Card>
      </ScrollView>
    </View>
  );
}
