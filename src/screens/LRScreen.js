import React, { useState } from 'react';
import { View, Text, FlatList, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo } from '../ui';
import {
  uid, inr, fmtDate, todayISO, byId, removeById, lrHtml, vendorName,
  lrHireBalance, lrTripExpTotal, truckToVehicleId, TRIP_EXP_CATS
} from '../logic';

export default function LRScreen({ navigation }) {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);
  const list = db.lrs.slice().reverse();

  const sharePdf = async (l) => {
    try {
      const { uri } = await Print.printToFileAsync({ html: lrHtml(db, l) });
      const ok = await Sharing.isAvailableAsync();
      if (ok) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: l.lrNo });
      else Alert.alert('Saved', 'PDF created at:\n' + uri);
    } catch (e) {
      Alert.alert('PDF error', String(e.message || e));
    }
  };

  const markPOD = (l) => update(d => {
    const x = byId(d.lrs, l.id); if (!x) return;
    x.pod = true;
    if (x.bookingId) {
      const b = byId(d.bookings, x.bookingId);
      if (b) { b.podReceived = true; if (b.status === 'In Transit') b.status = 'Delivered'; }
    }
  });

  const del = (l) => confirmDo('Delete LR ' + l.lrNo + '? Linked postings (hire advance/payments, trip expenses) are removed too.', () => update(d => {
    const x = byId(d.lrs, l.id);
    if (x && x.bookingId) { const b = byId(d.bookings, x.bookingId); if (b) b.lrNo = ''; }
    d.acctExp = d.acctExp.filter(e => e.lrId !== l.id);
    d.expenses = d.expenses.filter(e => e.lrId !== l.id);
    removeById(d.lrs, l.id);
  }));

  const addHirePay = (l) => {
    const bal = lrHireBalance(l);
    setForm({
      title: 'Hire Payment — ' + l.lrNo + ' (' + vendorName(db, (l.hire || {}).vendorId) + ', balance ' + inr(bal) + ')',
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
        { key: 'amount', label: 'Amount ₹', type: 'number', required: true, value: bal > 0 ? bal : '' },
        { key: 'mode', label: 'Mode', type: 'select', required: true, value: 'NEFT/RTGS', options: ['NEFT/RTGS', 'UPI', 'Cash', 'Cheque'].map(x => ({ v: x, l: x })) },
        { key: 'ref', label: 'UTR / Ref' }
      ],
      onSubmit: (v) => update(d => {
        const x = byId(d.lrs, l.id); if (!x) return;
        const p = { id: uid('hp'), date: v.date, amount: Number(v.amount) || 0, mode: v.mode, ref: v.ref };
        x.hire.payments = x.hire.payments || [];
        x.hire.payments.push(p);
        d.acctExp.push({ id: 'hpay_' + p.id, lrId: x.id, branchId: x.branchId, date: p.date, account: 'Hired Vehicle / Subcontractor', amount: p.amount, paidThrough: (v.mode === 'Cash' ? 'Petty Cash' : 'Bank — Current A/c'), vendor: vendorName(d, x.hire.vendorId), ref: 'LR ' + x.lrNo + ' — hire balance payment', notes: v.ref || '', src: 'hire' });
      })
    });
  };

  const addTripExp = (l) => {
    let vid = l.vehicleId || truckToVehicleId(db, l.truckNo);
    if (!vid) { Alert.alert('No vehicle link', 'Truck ' + l.truckNo + ' does not match an OWNED vehicle in Masters. Add/correct the vehicle first so trip expenses hit vehicle-wise P&L.'); return; }
    setForm({
      title: 'Trip Expense — ' + l.lrNo + ' (' + l.truckNo + ')',
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
        { key: 'category', label: 'Category', type: 'select', required: true, value: 'Fuel', options: TRIP_EXP_CATS.map(x => ({ v: x, l: x })) },
        { key: 'amount', label: 'Amount ₹', type: 'number', required: true },
        { key: 'litres', label: 'Litres (fuel only)', type: 'number' },
        { key: 'notes', label: 'Notes', type: 'multiline' }
      ],
      onSubmit: (v) => update(d => {
        const x = byId(d.lrs, l.id); if (!x) return;
        if (!x.vehicleId) x.vehicleId = vid;
        const exp = { id: uid('e'), vehicleId: vid, lrId: x.id, date: v.date, category: v.category, amount: Number(v.amount) || 0, litres: v.litres, notes: (v.notes ? v.notes + ' · ' : '') + 'LR ' + x.lrNo };
        d.expenses.push(exp);
        x.tripExpenses = x.tripExpenses || [];
        x.tripExpenses.push({ expId: exp.id, date: v.date, category: v.category, amount: exp.amount });
      })
    });
  };

  const renderItem = ({ item: l }) => {
    const hired = l.ownership === 'Hired';
    const bal = hired ? lrHireBalance(l) : 0;
    const te = !hired ? lrTripExpTotal(l) : 0;
    return (
      <Card>
        <View style={[S.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
          <Text style={S.h1}>{l.lrNo}</Text>
          <View style={S.wrapRow}>
            <Badge text={hired ? 'HIRED' : 'OWNED'} tone={hired ? 'purple' : 'navy'} />
            <Badge text={l.lrType} tone={l.lrType === 'DUMMY' ? 'amber' : 'green'} />
            {l.pod ? <Badge text="POD ✓" tone="green" /> : <Badge text="POD Pending" tone="red" />}
          </View>
        </View>
        <Text style={{ fontSize: 12.5, color: C.txt, fontWeight: '600' }}>
          {fmtDate(l.date)} · {l.truckNo} · {l.fromPlace} → {l.toPlace}
        </Text>
        <Text style={{ fontSize: 11.5, color: C.mut, marginTop: 2 }}>
          {(l.consignor || {}).name || '—'} → {(l.consignee || {}).name || '—'} · {l.payTerms}
        </Text>
        <View style={[S.wrapRow, { marginTop: 4 }]}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: C.navy }}>{inr(l.gross)}</Text>
          {hired ? (
            <Text style={{ fontSize: 11.5, color: C.mut }}>
              · {vendorName(db, (l.hire || {}).vendorId)} · Hire {inr((l.hire || {}).amount)} · <Text style={{ fontWeight: '800', color: bal > 0 ? C.red : C.green }}>Bal {inr(bal)}</Text>
            </Text>
          ) : (
            <Text style={{ fontSize: 11.5, color: C.mut }}>
              {(l.tripExpenses && l.tripExpenses.length) ? '· ' + l.tripExpenses.length + ' trip exp · ' + inr(te) : '· no trip exp yet'}
            </Text>
          )}
        </View>
        <View style={[S.wrapRow, { marginTop: 10 }]}>
          {hired && bal > 0 ? <Btn small tone="green" label="+ Hire Pay" onPress={() => addHirePay(l)} /> : null}
          {!hired ? <Btn small label="+ Trip Exp" onPress={() => addTripExp(l)} /> : null}
          <Btn small tone="ghost" label="Share PDF" onPress={() => sharePdf(l)} />
          <Btn small tone="ghost" label="Edit" onPress={() => navigation.navigate('LRForm', { lrId: l.id })} />
          {!l.pod ? <Btn small tone="green" label="POD ✓" onPress={() => markPOD(l)} /> : null}
          <Btn small tone="red" label="✕" onPress={() => del(l)} />
        </View>
      </Card>
    );
  };

  return (
    <View style={S.screen}>
      <View style={{ padding: 14, paddingBottom: 6, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <Btn label="⬆ Import CSV" onPress={() => navigation.navigate('LRImport')} />
        <Btn label="+ ADD NEW LR" tone="amber" onPress={() => navigation.navigate('LRForm', {})} />
      </View>
      <FlatList data={list} keyExtractor={l => l.id} renderItem={renderItem}
        contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: 60 }}
        ListEmptyComponent={<Empty text="No LRs yet. Tap + ADD NEW LR." />} />
      <ModalForm form={form} onClose={() => setForm(null)} />
    </View>
  );
}
