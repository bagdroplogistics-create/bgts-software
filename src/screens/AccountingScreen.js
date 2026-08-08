import React, { useState } from 'react';
import { View, Text, ScrollView, Linking, Alert } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Kpi, Badge, Btn, Empty, ModalForm, confirmDo } from '../ui';
import {
  uid, inr, sum, fmtDate, todayISO, addDaysISO, daysSince, byId, removeById,
  clientName, invPaid, invOutstanding, waLink, EXP_HEADS, PAY_THROUGH
} from '../logic';

export default function AccountingScreen({ navigation }) {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);
  const uninv = db.bookings.filter(b => b.status === 'Delivered' && !b.invoiceId);

  const makeInvoice = (b) => {
    const c = byId(db.clients, b.clientId) || { creditDays: 30 };
    setForm({
      title: 'Create Invoice — ' + b.bkNo,
      fields: [
        { key: 'date', label: 'Invoice Date', type: 'date', required: true, value: todayISO() },
        { key: 'amount', label: 'Taxable Amount ₹', type: 'number', required: true, value: b.freight },
        {
          key: 'gstPct', label: 'GST %', type: 'select', required: true, value: '0',
          options: [{ v: '0', l: '0% RCM' }, { v: '5', l: '5% FCM no ITC' }, { v: '12', l: '12% FCM + ITC' }, { v: '18', l: '18%' }],
          hint: 'GTA taxation — confirm the applicable option with your CA'
        },
        { key: 'notes', label: 'Notes', type: 'multiline' }
      ],
      onSubmit: (v) => update(d => {
        const amt = Number(v.amount) || 0, g = Number(v.gstPct) || 0;
        const total = Math.round(amt * (1 + g / 100) * 100) / 100;
        const inv = {
          id: uid('i'), invNo: 'INV-' + String(d.seq.inv).padStart(4, '0'), date: v.date, branchId: b.branchId || (d.branches[0] || {}).id, clientId: b.clientId,
          bookingIds: [b.id], amount: amt, gstPct: g, total, dueDate: addDaysISO(Number(c.creditDays) || 30), notes: v.notes
        };
        d.seq.inv++; d.invoices.push(inv);
        const x = byId(d.bookings, b.id); if (x) { x.invoiceId = inv.id; x.status = 'Invoiced'; }
      })
    });
  };

  const recordPayment = (inv) => setForm({
    title: 'Record Payment — ' + inv.invNo,
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
      { key: 'amount', label: 'Amount ₹', type: 'number', required: true, value: invOutstanding(db, inv) },
      { key: 'mode', label: 'Mode', type: 'select', required: true, value: 'NEFT/RTGS', options: ['NEFT/RTGS', 'UPI', 'Cheque', 'Cash', 'Other'].map(x => ({ v: x, l: x })) },
      { key: 'ref', label: 'UTR / Cheque Ref' }
    ],
    onSubmit: (v) => update(d => {
      const target = byId(d.invoices, inv.id); if (!target) return;
      d.payments.push({ id: uid('p'), invoiceId: inv.id, date: v.date, amount: Number(v.amount) || 0, mode: v.mode, ref: v.ref });
      const paid = sum(d.payments.filter(p => p.invoiceId === inv.id), p => p.amount);
      if ((Number(target.total) || 0) - paid <= 0.01) {
        (target.bookingIds || []).forEach(bid => { const b = byId(d.bookings, bid); if (b) b.status = 'Paid'; });
      }
    })
  });

  const waRemind = (inv, out) => {
    const c = byId(db.clients, inv.clientId);
    if (!c || !c.phone) { Alert.alert('No phone', 'Add a WhatsApp number for this client in Masters.'); return; }
    const msg = 'BGTS Payment Reminder — Invoice ' + inv.invNo + ' dated ' + fmtDate(inv.date) + '. Outstanding: ' + inr(out) + '. Kindly arrange payment at the earliest. — Baroda Goods Transport Service Pvt. Ltd.';
    Linking.openURL(waLink(c.phone, msg)).catch(() => Alert.alert('Error', 'Could not open WhatsApp.'));
  };

  const delInvoice = (inv) => confirmDo('Delete invoice? Linked bookings revert to Delivered.', () => update(d => {
    const x = byId(d.invoices, inv.id);
    if (x) { (x.bookingIds || []).forEach(bid => { const b = byId(d.bookings, bid); if (b) { b.invoiceId = ''; b.status = 'Delivered'; } }); }
    d.payments = d.payments.filter(p => p.invoiceId !== inv.id);
    removeById(d.invoices, inv.id);
  }));

  const addBizExpense = () => setForm({
    title: 'Record Business Expense',
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
      { key: 'branchId', label: 'Branch', type: 'select', required: true, value: (db.branches[0] || {}).id, options: (db.branches || []).map(x => ({ v: x.id, l: x.name })) },
      { key: 'account', label: 'Account Head', type: 'select', required: true, value: 'Other Expenses', options: EXP_HEADS.map(x => ({ v: x, l: x })) },
      { key: 'amount', label: 'Amount ₹', type: 'number', required: true },
      { key: 'paidThrough', label: 'Paid Through', type: 'select', required: true, value: PAY_THROUGH[0], options: PAY_THROUGH.map(x => ({ v: x, l: x })) },
      { key: 'vendor', label: 'Vendor / Paid To' },
      { key: 'ref', label: 'Bill / Ref No.' },
      { key: 'notes', label: 'Notes', type: 'multiline' }
    ],
    onSubmit: (v) => update(d => {
      d.acctExp.push({ id: uid('ax'), branchId: v.branchId, date: v.date, account: v.account, amount: Number(v.amount) || 0, paidThrough: v.paidThrough, vendor: v.vendor, ref: v.ref, notes: v.notes, src: 'manual' });
    })
  });

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={[S.wrapRow, { marginBottom: 12 }]}>
        <Btn small label="📊 Accounts Dashboard" onPress={() => navigation.navigate('AccDash')} />
        <Btn small label="🏦 Banking / Reco" onPress={() => navigation.navigate('Banking')} />
        <Btn small label="⬆ Import Invoices" onPress={() => navigation.navigate('InvoiceImport')} />
        <Btn small label="🗂 Invoice Backup" onPress={() => navigation.navigate('Backup')} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Kpi label="Invoiced" value={inr(sum(db.invoices, i => i.total))} sub={db.invoices.length + ' invoices'} />
        <Kpi label="Collected" value={inr(sum(db.payments, p => p.amount))} sub={db.payments.length + ' payments'} tone="green" />
        <Kpi label="Outstanding" value={inr(sum(db.invoices, i => invOutstanding(db, i)))} sub="across all clients" tone="amber" />
        <Kpi label="Biz Expenses" value={inr(sum(db.acctExp, e => e.amount))} sub={db.acctExp.length + ' entries (incl. LR expenses)'} />
      </View>

      {uninv.length ? (
        <Card title="Ready to Invoice">
          {uninv.map(b => (
            <View key={b.id} style={[S.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{b.bkNo} · {clientName(db, b.clientId)}</Text>
                <Text style={{ fontSize: 11, color: C.mut }}>{b.origin} → {b.destination} · {inr(b.freight)} · POD {b.podReceived ? '✓' : 'pending'}</Text>
              </View>
              <Btn small tone="amber" label="Invoice" onPress={() => makeInvoice(b)} />
            </View>
          ))}
        </Card>
      ) : null}

      <Card title="Invoices & Receivables Ageing">
        {!db.invoices.length ? <Empty text="No invoices raised yet." /> :
          db.invoices.slice().reverse().map(inv => {
            const out = invOutstanding(db, inv), age = daysSince(inv.date);
            return (
              <View key={inv.id} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8 }}>
                <View style={[S.row, { justifyContent: 'space-between' }]}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.navy }}>{inv.invNo} · {clientName(db, inv.clientId)}</Text>
                  <Badge
                    text={out <= 0 ? 'PAID' : age <= 30 ? '0–30d' : age <= 60 ? '31–60d' : age <= 90 ? '61–90d' : '90+d'}
                    tone={out <= 0 ? 'green' : age <= 30 ? 'green' : age <= 60 ? 'amber' : 'red'} />
                </View>
                <Text style={{ fontSize: 11.5, color: C.mut, marginTop: 2 }}>
                  {fmtDate(inv.date)} · Total {inr(inv.total)} · Paid {inr(invPaid(db, inv))} · Out <Text style={{ fontWeight: '800', color: out > 0 ? C.red : C.green }}>{inr(out)}</Text> · Age {age}d
                </Text>
                <View style={[S.wrapRow, { marginTop: 8 }]}>
                  {out > 0 ? <Btn small tone="green" label="+ Payment" onPress={() => recordPayment(inv)} /> : null}
                  {out > 0 ? <Btn small tone="wa" label="WA Remind" onPress={() => waRemind(inv, out)} /> : null}
                  <Btn small tone="red" label="✕" onPress={() => delInvoice(inv)} />
                </View>
              </View>
            );
          })}
      </Card>

      <Card title="Business Expenses (Zoho-style account heads)"
        right={<Btn small tone="amber" label="+ Expense" onPress={addBizExpense} />}>
        {!db.acctExp.length ? <Text style={S.empty}>No expenses yet. LR expenses post here automatically.</Text> :
          db.acctExp.slice().reverse().slice(0, 15).map(e => (
            <View key={e.id} style={[S.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{e.account} · {inr(e.amount)}</Text>
                <Text style={{ fontSize: 11, color: C.mut }}>{fmtDate(e.date)} · {e.paidThrough || '—'}{e.ref ? ' · ' + e.ref : ''}{e.notes ? ' · ' + e.notes : ''}</Text>
              </View>
              <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete expense entry?', () => update(d => removeById(d.acctExp, e.id)))} />
            </View>
          ))}
      </Card>

      {db.payments.length ? (
        <Card title="Payment Log">
          {db.payments.slice().reverse().map(p => {
            const inv = byId(db.invoices, p.invoiceId) || {};
            return (
              <Text key={p.id} style={{ fontSize: 12, color: C.txt, marginBottom: 5 }}>
                {fmtDate(p.date)} · {inv.invNo || '—'} · <Text style={{ fontWeight: '700' }}>{inr(p.amount)}</Text> · {p.mode}{p.ref ? ' · ' + p.ref : ''}
              </Text>
            );
          })}
        </Card>
      ) : null}
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
