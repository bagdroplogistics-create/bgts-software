import React, { useState } from 'react';
import { View, Text, ScrollView, Linking, Alert } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Kpi, Badge, Btn, Empty, ModalForm } from '../ui';
import { uid, inr, fmtDate, todayISO, daysSince, byId, sum, invPaid, invOutstanding, waLink } from '../logic';

export default function CompanyScreen({ route }) {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);
  const c = byId(db.clients, (route.params || {}).clientId);
  if (!c) return <View style={S.screen}><Card><Empty text="Company not found." /></Card></View>;

  const invs = db.invoices.filter(i => i.clientId === c.id);
  const billed = sum(invs, i => i.total);
  const collected = sum(invs, i => invPaid(db, i));
  const out = billed - collected;
  const openInvs = invs.filter(i => invOutstanding(db, i) > 0).sort((a, b) => a.date < b.date ? -1 : 1);
  let oldest = null;
  openInvs.forEach(i => { const a = daysSince(i.date); if (oldest == null || a > oldest) oldest = a; });
  const bk = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  invs.forEach(inv => {
    const o = invOutstanding(db, inv); if (o <= 0) return;
    const a = daysSince(inv.date);
    if (a <= 30) bk['0-30'] += o; else if (a <= 60) bk['31-60'] += o; else if (a <= 90) bk['61-90'] += o; else bk['90+'] += o;
  });
  const bkMax = Math.max(...Object.values(bk), 1);

  const recordPayment = (inv) => setForm({
    title: 'Record Payment — ' + inv.invNo,
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
      { key: 'amount', label: 'Amount ₹', type: 'number', required: true, value: invOutstanding(db, inv) },
      { key: 'mode', label: 'Mode', type: 'select', required: true, value: 'NEFT/RTGS', options: ['NEFT/RTGS', 'UPI', 'Cheque', 'Cash'].map(x => ({ v: x, l: x })) },
      { key: 'ref', label: 'UTR / Ref' }
    ],
    onSubmit: (v) => update(d => {
      const target = byId(d.invoices, inv.id); if (!target) return;
      d.payments.push({ id: uid('p'), mrNo: 'MR-' + String(d.seq.mr).padStart(4, '0'), invoiceId: inv.id, date: v.date, amount: Number(v.amount) || 0, mode: v.mode, ref: v.ref });
      d.seq.mr++;
    })
  });
  const waRemind = (inv, o) => {
    if (!c.phone) { Alert.alert('No phone', 'Add a WhatsApp number in the client master.'); return; }
    Linking.openURL(waLink(c.phone, 'BGTS Payment Reminder — Bill ' + inv.invNo + ' dated ' + fmtDate(inv.date) + ', balance ' + inr(o) + '. Kindly arrange payment. — Baroda Goods Transport Service Pvt. Ltd.')).catch(() => {});
  };

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <Card title={c.name}>
        <Text style={{ fontSize: 11.5, color: C.mut }}>
          {c.gstin || 'GSTIN not on file'}{c.addr ? ' · ' + c.addr : ''} · Credit {c.creditDays || '—'} days
        </Text>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Kpi label="Total Billed" value={inr(billed)} sub={invs.length + ' bills'} />
        <Kpi label="Collected" value={inr(collected)} sub="receipts recorded" tone="green" />
        <Kpi label="Outstanding" value={inr(out)} sub={openInvs.length + ' open bills'} tone={out > 0 ? 'amber' : 'green'} />
        <Kpi label="Oldest Due" value={oldest == null ? '—' : oldest + 'd'} sub="age of oldest open bill" tone={oldest != null && oldest > 60 ? 'red' : ''} />
      </View>

      <Card title="Outstanding Ageing">
        {[['0-30', C.green], ['31-60', C.amber], ['61-90', C.amberD], ['90+', C.red]].map(([k, col]) => (
          <View key={k} style={{ marginBottom: 8 }}>
            <View style={[S.row, { justifyContent: 'space-between' }]}>
              <Text style={{ fontSize: 11.5, fontWeight: '600', color: C.txt }}>{k} days</Text>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: C.navy }}>{inr(bk[k])}</Text>
            </View>
            <View style={{ backgroundColor: C.line, borderRadius: 5, height: 10, marginTop: 3, overflow: 'hidden' }}>
              <View style={{ backgroundColor: col, height: 10, width: Math.max(Math.round(bk[k] / bkMax * 100), 1) + '%' }} />
            </View>
          </View>
        ))}
      </Card>

      <Card title={'Open Bills (' + openInvs.length + ')'}>
        {!openInvs.length ? <Empty text="No dues — account clear. 🏁" /> :
          openInvs.map(inv => {
            const o = invOutstanding(db, inv), age = daysSince(inv.date);
            return (
              <View key={inv.id} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8 }}>
                <View style={[S.row, { justifyContent: 'space-between' }]}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.navy }}>{inv.invNo}</Text>
                  <Badge text={age + 'd'} tone={age > 60 ? 'red' : age > 30 ? 'amber' : 'green'} />
                </View>
                <Text style={{ fontSize: 11.5, color: C.txt, marginTop: 2 }}>
                  {fmtDate(inv.date)} · Bill {inr(inv.total)} · Recd {inr(invPaid(db, inv))} · <Text style={{ fontWeight: '800', color: C.red }}>Bal {inr(o)}</Text>
                </Text>
                <View style={[S.wrapRow, { marginTop: 8 }]}>
                  <Btn small tone="green" label="+ Payment" onPress={() => recordPayment(inv)} />
                  <Btn small tone="wa" label="WA Remind" onPress={() => waRemind(inv, o)} />
                </View>
              </View>
            );
          })}
      </Card>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
