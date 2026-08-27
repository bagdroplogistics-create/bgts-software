import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Btn, Empty, confirmDo, Table, PickerField, alert } from '../ui';
import {
  inr, fmtDate, removeById, sum, LHC_AGENTS,
  importLegacyLhcPayments, LEGACY_LHC_PAYMENTS
} from '../logic';

/* "VIEW LHC BALANCE PAYMENT DETAILS" register — the new LHC Balance Payment
   module's list screen. Independent of LHCTripListScreen.js; reads
   db.lhcPayments (each row a single payment against one LHC trip) and only
   reads db.lhcTrips for filter options / display, never writes to it. */
export default function LHCPaymentListScreen({ navigation }) {
  const { db, update } = useStore();
  const [q, setQ] = useState('');
  const [agent, setAgent] = useState('');

  const list = (db.lhcPayments || []).slice()
    .filter(p => !agent || p.agentName === agent || (p.agentName || '').trim().toLowerCase() === agent.trim().toLowerCase())
    .filter(p => {
      if (!q) return true;
      const hay = (p.lhcNo + ' ' + (p.ownerName || '') + ' ' + (p.agentName || '') + ' ' + (p.voucherNo || '')).toLowerCase();
      return hay.indexOf(q.toLowerCase()) >= 0;
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));

  const listAmount = sum(list, p => p.amount);

  const del = (p) => confirmDo('Delete this payment (' + inr(p.amount) + ' against ' + (p.lhcNo || '') + ')?', () => update(d => removeById(d.lhcPayments, p.id)));

  const doImportLegacyLhcPayments = () => update(d => {
    const { added, skippedNoTrip } = importLegacyLhcPayments(d);
    setTimeout(() => alert('LHC Balance Payment register imported',
      added + ' payment(s) added'
      + (skippedNoTrip ? ', ' + skippedNoTrip + ' skipped (LHC not found — import the LHC register first).' : '')
      + (added < LEGACY_LHC_PAYMENTS.length && !skippedNoTrip ? ', ' + (LEGACY_LHC_PAYMENTS.length - added) + ' already on file (skipped).' : '.')
    ), 100);
  });

  const agentOptions = [{ v: '', l: 'All Agents' }, ...LHC_AGENTS.map(a => ({ v: a, l: a.trim() || '(blank)' }))];

  return (
    <View style={S.screen}>
      <View style={{ padding: 14, paddingBottom: 6, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <Btn label="Import ATTrans Payment Register (24)" tone="ghost" onPress={doImportLegacyLhcPayments} />
        <Btn label="+ ADD NEW LHC BALANCE PAYMENT" tone="amber" onPress={() => navigation.navigate('LHCPayment', {})} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: 60 }}>
        <Card title="LHC Balance Payment Details">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <View style={{ minWidth: 220, gap: 4 }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: C.mut, textTransform: 'uppercase' }}>Agent</Text>
              <PickerField value={agent} onChange={setAgent} options={agentOptions} />
            </View>
            <View style={{ minWidth: 220, flexGrow: 1, gap: 4 }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: C.mut, textTransform: 'uppercase' }}>Search (LHC No / Owner / Agent / Voucher No)</Text>
              <TextInput value={q} onChangeText={setQ} placeholder="Type to search…" placeholderTextColor={C.mut}
                style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 7, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: C.txt }} />
            </View>
            <Btn small tone="ghost" label="Reset" onPress={() => { setQ(''); setAgent(''); }} style={{ alignSelf: 'flex-end' }} />
          </View>

          {!list.length ? (
            <Empty text={(db.lhcPayments || []).length ? 'No payments match this search.' : 'No LHC payments yet. Tap + ADD NEW LHC BALANCE PAYMENT.'} />
          ) : (<>
            <Text style={{ fontSize: 11.5, color: C.mut, marginBottom: 8 }}>{list.length} payment(s) · Total {inr(listAmount)}</Text>
            <Table
              cols={[
                { key: 'voucherNo', label: 'Voucher No', width: 90 },
                { key: 'lhcNo', label: 'LHC No', width: 100 },
                { key: 'date', label: 'Date', width: 90 },
                { key: 'ownerName', label: 'Owner Name', width: 130 },
                { key: 'agentName', label: 'Agent Name', width: 130 },
                { key: 'amount', label: 'Amount', width: 100 },
                { key: 'otherAdd', label: 'Other Add', width: 90 },
                { key: 'otherLess', label: 'Other Less', width: 90 },
                { key: 'payTo', label: 'Paid To', width: 90 },
                { key: 'mode', label: 'Mode', width: 80 },
                { key: 'createdBy', label: 'Created By', width: 100 },
                { key: 'actions', label: '', width: 80 }
              ]}
              rows={list.map(p => ({
                voucherNo: p.voucherNo || '—',
                lhcNo: <Text style={{ fontWeight: '700', color: C.navy }}>{p.lhcNo}</Text>,
                date: fmtDate(p.date),
                ownerName: p.ownerName || '—',
                agentName: p.agentName || '—',
                amount: <Text style={{ fontWeight: '800', color: C.navy }}>{inr(p.amount)}</Text>,
                otherAdd: p.otherAdd ? inr(p.otherAdd) : '—',
                otherLess: p.otherLess ? inr(p.otherLess) : '—',
                payTo: p.payTo || '—',
                mode: p.mode || '—',
                createdBy: p.createdBy || '—',
                actions: <Btn small tone="red" label="✕" onPress={() => del(p)} />
              }))}
            />
          </>)}
        </Card>
      </ScrollView>
    </View>
  );
}
