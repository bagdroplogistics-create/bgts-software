import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, KV, ModalForm, confirmDo } from '../ui';
import {
  uid, inr, fmtDate, todayISO, byId, removeById, vendorName,
  tdsAmount, lhcPaid, lhcBalance, lhcStatus
} from '../logic';

export default function LHCScreen() {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);
  const [onlyPending, setOnlyPending] = useState(false);
  const list = db.lhcs.slice().reverse().filter(l => !onlyPending || lhcBalance(l) > 0);

  const lhcFields = (l) => [
    { key: 'date', label: 'Date', type: 'date', required: true, value: l ? l.date : todayISO() },
    { key: 'vendorId', label: 'Vendor / Truck Owner', type: 'select', required: true, value: l && l.vendorId, options: db.vendors.map(v => ({ v: v.id, l: v.name })) },
    { key: 'truckNo', label: 'Truck No', required: true, value: l && l.truckNo },
    { key: 'driverName', label: 'Driver Name', value: l && l.driverName },
    { key: 'driverPhone', label: 'Driver Phone', value: l && l.driverPhone },
    { key: 'fromPlace', label: 'From', required: true, value: l && l.fromPlace },
    { key: 'toPlace', label: 'To', required: true, value: l && l.toPlace },
    { key: 'lrNos', label: 'LR No(s) carried', value: l && l.lrNos, hint: 'Comma-separated LR numbers on this trip' },
    { key: 'lorryHire', label: 'Lorry Hire ₹', type: 'number', required: true, value: l && l.lorryHire },
    { key: 'advance', label: 'Advance Paid ₹', type: 'number', value: l && l.advance },
    { key: 'deductions', label: 'Other Deductions ₹', type: 'number', value: l && l.deductions },
    {
      key: 'tdsPct', label: 'TDS % (194C)', type: 'select', value: l ? String(l.tdsPct) : '1',
      options: [{ v: '0', l: '0% — not applicable' }, { v: '1', l: '1% — individual/HUF with PAN' }, { v: '2', l: '2% — firm/company with PAN' }, { v: '20', l: '20% — no PAN' }],
      hint: 'TDS u/s 194C on lorry hire — confirm applicability with your CA'
    },
    { key: 'notes', label: 'Notes', type: 'multiline', value: l && l.notes }
  ];

  const addLHC = () => {
    if (!db.vendors.length) { Alert.alert('No vendors', 'Add the truck vendor in Masters first.'); return; }
    setForm({
      title: 'New LHC (Lorry Hire Contract)', fields: lhcFields(null),
      onSubmit: (v) => update(d => {
        const hire = Number(v.lorryHire) || 0, pct = Number(v.tdsPct) || 0;
        d.lhcs.push({
          id: uid('lh'), lhcNo: 'LHC-' + String(d.seq.lhc).padStart(4, '0'), date: v.date,
          vendorId: v.vendorId, truckNo: v.truckNo, driverName: v.driverName, driverPhone: v.driverPhone,
          fromPlace: v.fromPlace, toPlace: v.toPlace, lrNos: v.lrNos,
          lorryHire: hire, advance: Number(v.advance) || 0, deductions: Number(v.deductions) || 0,
          tdsPct: pct, tdsAmt: tdsAmount(hire, pct), payments: [], notes: v.notes
        });
        d.seq.lhc++;
      })
    });
  };

  const editLHC = (l) => setForm({
    title: 'Edit ' + l.lhcNo, fields: lhcFields(l),
    onSubmit: (v) => update(d => {
      const x = byId(d.lhcs, l.id); if (!x) return;
      const hire = Number(v.lorryHire) || 0, pct = Number(v.tdsPct) || 0;
      x.date = v.date; x.vendorId = v.vendorId; x.truckNo = v.truckNo;
      x.driverName = v.driverName; x.driverPhone = v.driverPhone;
      x.fromPlace = v.fromPlace; x.toPlace = v.toPlace; x.lrNos = v.lrNos;
      x.lorryHire = hire; x.advance = Number(v.advance) || 0; x.deductions = Number(v.deductions) || 0;
      x.tdsPct = pct; x.tdsAmt = tdsAmount(hire, pct); x.notes = v.notes;
    })
  });

  const payBalance = (l) => setForm({
    title: 'LHC Payment — ' + l.lhcNo + ' (balance ' + inr(lhcBalance(l)) + ')',
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
      { key: 'amount', label: 'Amount ₹', type: 'number', required: true, value: lhcBalance(l) },
      { key: 'mode', label: 'Mode', type: 'select', required: true, value: 'NEFT/RTGS', options: ['NEFT/RTGS', 'UPI', 'Cash', 'Cheque'].map(x => ({ v: x, l: x })) },
      { key: 'ref', label: 'UTR / Ref' }
    ],
    onSubmit: (v) => update(d => {
      const x = byId(d.lhcs, l.id); if (!x) return;
      x.payments = x.payments || [];
      x.payments.push({ id: uid('lp'), date: v.date, amount: Number(v.amount) || 0, mode: v.mode, ref: v.ref });
    })
  });

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={[S.wrapRow, { justifyContent: 'space-between', marginBottom: 10 }]}>
        <Btn small tone={onlyPending ? 'amber' : 'ghost'} label={onlyPending ? 'Showing: Pending Balance' : 'Filter: Pending Balance'} onPress={() => setOnlyPending(!onlyPending)} />
        <Btn label="+ New LHC" tone="amber" onPress={addLHC} />
      </View>

      {!list.length ? <Card><Empty text={onlyPending ? 'No LHCs with pending balance.' : 'No LHCs yet. Create one when you hire a market truck.'} /></Card> :
        list.map(l => {
          const bal = lhcBalance(l), st = lhcStatus(l);
          return (
            <Card key={l.id}>
              <View style={[S.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
                <Text style={S.h1}>{l.lhcNo} · {vendorName(db, l.vendorId)}</Text>
                <Badge text={st} tone={st === 'SETTLED' ? 'green' : st === 'PART PAID' ? 'amber' : 'red'} />
              </View>
              <Text style={{ fontSize: 11.5, color: C.mut, marginBottom: 6 }}>
                {fmtDate(l.date)} · {l.truckNo} · {l.fromPlace} → {l.toPlace}{l.lrNos ? ' · LRs: ' + l.lrNos : ''}
              </Text>
              <KV k="Lorry Hire" v={inr(l.lorryHire)} />
              <KV k="Advance" v={inr(l.advance)} />
              {Number(l.deductions) ? <KV k="Deductions" v={inr(l.deductions)} /> : null}
              <KV k={'TDS ' + l.tdsPct + '%'} v={inr(l.tdsAmt)} />
              <KV k="Paid (post-adv)" v={inr(lhcPaid(l))} />
              <View style={[S.row, { justifyContent: 'space-between', marginTop: 6 }]}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: bal > 0 ? C.red : C.green }}>Balance: {inr(bal)}</Text>
              </View>
              <View style={[S.wrapRow, { marginTop: 10 }]}>
                {bal > 0 ? <Btn small tone="green" label="+ Payment" onPress={() => payBalance(l)} /> : null}
                <Btn small tone="ghost" label="Edit" onPress={() => editLHC(l)} />
                <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete ' + l.lhcNo + '?', () => update(d => removeById(d.lhcs, l.id)))} />
              </View>
            </Card>
          );
        })}
      <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 4 }}>
        Balance = Lorry Hire − Advance − Deductions − TDS − Payments. TDS deducted here accrues to TDS Payable — deposit per your CA's calendar.
      </Text>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
