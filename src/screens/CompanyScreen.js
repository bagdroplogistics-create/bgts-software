import React, { useState } from 'react';
import { View, Text, ScrollView, Linking } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Kpi, Badge, Btn, Empty, ModalForm, Table, alert } from '../ui';
import { uid, inr, fmtDate, todayISO, daysSince, byId, sum, pad, invPaid, invOutstanding, waLink, receiptHtml } from '../logic';
import { printHtml } from '../fileIO';
import { getLogoDataUri } from '../logoAsset';

const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CompanyScreen({ route, navigation }) {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);
  const c = byId(db.clients, (route.params || {}).clientId);
  if (!c) return (
    <View style={S.screen}>
      <Card><Empty text="Company not found." /></Card>
      <View style={{ paddingHorizontal: 14 }}><Btn tone="ghost" label="← Dashboard" onPress={() => navigation.navigate('Dashboard')} /></View>
    </View>
  );

  const invs = db.invoices.filter(i => i.clientId === c.id);
  const billed = sum(invs, i => i.total);
  const collected = sum(invs, i => invPaid(db, i));
  const out = billed - collected;
  const openInvs = invs.filter(i => invOutstanding(db, i) > 0).sort((a, b) => a.date < b.date ? -1 : 1);
  const bks = db.bookings.filter(b => b.clientId === c.id);
  let oldest = null;
  openInvs.forEach(i => { const a = daysSince(i.date); if (oldest == null || a > oldest) oldest = a; });
  const bk = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  invs.forEach(inv => {
    const o = invOutstanding(db, inv); if (o <= 0) return;
    const a = daysSince(inv.date);
    if (a <= 30) bk['0-30'] += o; else if (a <= 60) bk['31-60'] += o; else if (a <= 90) bk['61-90'] += o; else bk['90+'] += o;
  });
  const bkMax = Math.max(...Object.values(bk), 1);

  const months = [];
  const today = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({ key: m.getFullYear() + '-' + pad(m.getMonth() + 1), label: MN[m.getMonth()] });
  }
  const mBilled = months.map(m => sum(invs.filter(i => String(i.date).slice(0, 7) === m.key), i => i.total));
  const mCollected = months.map(m => sum(db.payments.filter(p => { const inv = byId(db.invoices, p.invoiceId); return inv && inv.clientId === c.id && String(p.date).slice(0, 7) === m.key; }), p => p.amount));
  const gMax = Math.max(...mBilled, ...mCollected, 1);

  const pays = db.payments.filter(p => { const inv = byId(db.invoices, p.invoiceId); return inv && inv.clientId === c.id; }).slice().reverse();

  const printReceipt = async (p) => {
    try {
      const logoUri = await getLogoDataUri();
      await printHtml(receiptHtml(db, p, logoUri), p.mrNo);
    } catch (e) { alert('Error', String(e.message || e)); }
  };

  const editMaster = () => setForm({
    title: 'Edit Client',
    fields: [
      { key: 'name', label: 'Client Name', required: true, value: c.name },
      { key: 'gstin', label: 'GSTIN', value: c.gstin },
      { key: 'phone', label: 'WhatsApp Phone (with 91)', value: c.phone, hint: 'e.g. 919825012345' },
      { key: 'email', label: 'Email', value: c.email },
      { key: 'creditDays', label: 'Credit Period (days)', type: 'number', value: c.creditDays != null ? c.creditDays : 30 },
      { key: 'addr', label: 'Address / City', value: c.addr }
    ],
    onSubmit: (v) => update(d => { const x = byId(d.clients, c.id); if (x) Object.keys(v).forEach(k => { x[k] = v[k]; }); })
  });

  const waSummary = () => {
    if (!c.phone) { alert('No phone', 'Add a WhatsApp number in the client master.'); return; }
    const msg = 'Dear Sir/Madam, please find your account summary with Baroda Goods Transport Service: billed ' + inr(billed) + ', received ' + inr(collected) + ', outstanding ' + inr(out) + '. Kindly arrange payment of dues at the earliest. — BGTS';
    Linking.openURL(waLink(c.phone, msg)).catch(() => alert('Error', 'Could not open WhatsApp.'));
  };

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
  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <Card title={c.name}
        right={
          <View style={S.wrapRow}>
            {c.phone ? <Btn small tone="wa" label="WA Summary" onPress={waSummary} /> : null}
            <Btn small tone="ghost" label="Edit Master" onPress={editMaster} />
            <Btn small tone="ghost" label="← Dashboard" onPress={() => navigation.navigate('Dashboard')} />
          </View>
        }>
        <Text style={{ fontSize: 11.5, color: C.mut }}>
          {c.gstin || 'GSTIN not on file'}{c.addr ? ' · ' + c.addr : ''}{c.phone ? ' · ' + c.phone : ''} · Credit {c.creditDays || '—'} days
        </Text>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Kpi label="Total Turnover" value={inr(billed)} sub={invs.length + ' bills'} />
        <Kpi label="Payment Receipt" value={inr(collected)} sub="receipts recorded" tone="green" />
        <Kpi label="Outstanding" value={inr(out)} sub={openInvs.length + ' open bills'} tone={out > 0 ? 'amber' : 'green'} />
        <Kpi label="Oldest Due" value={oldest == null ? '—' : oldest + 'd'} sub="age of oldest open bill" tone={oldest != null && oldest > 60 ? 'red' : ''} />
        <Kpi label="Bookings" value={String(bks.length)} sub="operational bookings" />
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

      <Card title="Billed vs Collected — Last 6 Months">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 130, gap: 6 }}>
          {months.map((m, i) => (
            <View key={m.key} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 100 }}>
                <View style={{ width: 12, height: Math.max(Math.round(mBilled[i] / gMax * 96), 2), backgroundColor: C.navy3, borderRadius: 3 }} />
                <View style={{ width: 12, height: Math.max(Math.round(mCollected[i] / gMax * 96), 2), backgroundColor: C.green, borderRadius: 3 }} />
              </View>
              <Text style={{ fontSize: 10, color: C.mut, marginTop: 3, fontWeight: '600' }}>{m.label}</Text>
            </View>
          ))}
        </View>
        <View style={[S.wrapRow, { marginTop: 8 }]}>
          <Text style={{ fontSize: 11 }}><Text style={{ color: C.navy3 }}>■</Text> Billed</Text>
          <Text style={{ fontSize: 11 }}><Text style={{ color: C.green }}>■</Text> Collected</Text>
        </View>
      </Card>

      <Card title={'Open Bills (' + openInvs.length + ')'}>
        {!openInvs.length ? <Empty text="No dues — account clear. 🏁" /> : (
          <Table
            cols={[
              { key: 'invoice', label: 'Bill / Invoice', width: 100 },
              { key: 'date', label: 'Date', width: 80 },
              { key: 'amount', label: 'Amount', width: 90 },
              { key: 'received', label: 'Received', width: 90 },
              { key: 'balance', label: 'Balance', width: 90 },
              { key: 'age', label: 'Age', width: 70 },
              { key: 'actions', label: 'Actions', width: 220 }
            ]}
            rows={openInvs.map(inv => {
              const o = invOutstanding(db, inv), age = daysSince(inv.date);
              return {
                invoice: <Text style={{ fontWeight: '700', color: C.navy }}>{inv.invNo}</Text>,
                date: fmtDate(inv.date),
                amount: inr(inv.total),
                received: inr(invPaid(db, inv)),
                balance: <Text style={{ fontWeight: '800', color: C.red }}>{inr(o)}</Text>,
                age: <Badge text={age + 'd'} tone={age > 60 ? 'red' : age > 30 ? 'amber' : 'green'} />,
                actions: (
                  <View style={S.wrapRow}>
                    <Btn small tone="green" label="+ Payment" onPress={() => recordPayment(inv)} />
                  </View>
                )
              };
            })}
          />
        )}
      </Card>

      <Card title="Recent Receipts">
        {!pays.length ? <Empty text="No receipts yet." /> : (
          <Table
            cols={[
              { key: 'receipt', label: 'Receipt', width: 100 },
              { key: 'date', label: 'Date', width: 80 },
              { key: 'bill', label: 'Bill', width: 100 },
              { key: 'amount', label: 'Amount', width: 90 },
              { key: 'modeRef', label: 'Mode / Ref', width: 150 },
              { key: 'actions', label: '', width: 110 }
            ]}
            rows={pays.slice(0, 12).map(p => {
              const inv = byId(db.invoices, p.invoiceId) || {};
              return {
                receipt: <Text style={{ fontWeight: '700', color: C.navy }}>{p.mrNo || '—'}</Text>,
                date: fmtDate(p.date),
                bill: inv.invNo || '—',
                amount: inr(p.amount),
                modeRef: (p.mode || '') + (p.ref ? ' · ' + String(p.ref).slice(0, 40) : ''),
                actions: <Btn small tone="ghost" label="Receipt" onPress={() => printReceipt(p)} />
              };
            })}
          />
        )}
      </Card>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
