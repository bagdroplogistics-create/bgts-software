import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Kpi, Empty } from '../ui';
import { inr, sum, pad, invOutstanding, invPaid, ageingBuckets } from '../logic';

function Bars({ items, fmt }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <View>
      {items.map((it, idx) => (
        <View key={idx} style={{ marginBottom: 8 }}>
          <View style={[S.row, { justifyContent: 'space-between' }]}>
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: C.txt }}>{it.label}</Text>
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: C.navy }}>{fmt ? fmt(it.value) : it.value}</Text>
          </View>
          <View style={{ backgroundColor: C.line, borderRadius: 5, height: 10, marginTop: 3, overflow: 'hidden' }}>
            <View style={{ backgroundColor: it.color || C.navy3, height: 10, width: Math.max(Math.round(it.value / max * 100), 1) + '%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AccDashScreen() {
  const { db } = useStore();
  const invoiced = sum(db.invoices, i => i.total);
  const collected = sum(db.payments, p => p.amount);
  const outstanding = sum(db.invoices, i => invOutstanding(db, i));
  const bizExp = sum(db.acctExp, e => e.amount);
  const fleetExp = sum(db.expenses, e => e.amount);
  const bk = ageingBuckets(db);
  const unmatched = db.bankTxns.filter(t => t.status === 'UNMATCHED').length;

  const months = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push({ key: m.getFullYear() + '-' + pad(m.getMonth() + 1), label: MN[m.getMonth()] });
  }
  const gMax = Math.max(...months.map(m =>
    Math.max(sum(db.invoices.filter(i => String(i.date).slice(0, 7) === m.key), i => i.total),
      sum(db.payments.filter(p => String(p.date).slice(0, 7) === m.key), p => p.amount))), 1);

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Kpi label="Invoiced" value={inr(invoiced)} sub={db.invoices.length + ' invoices'} />
        <Kpi label="Collected" value={inr(collected)} sub={db.payments.length + ' receipts'} tone="green" />
        <Kpi label="Outstanding" value={inr(outstanding)} sub="receivables" tone={outstanding > 0 ? 'amber' : 'green'} />
        <Kpi label="Expenses" value={inr(bizExp + fleetExp)} sub={'biz ' + inr(bizExp) + ' + fleet ' + inr(fleetExp)} />
        <Kpi label="Net Cash" value={inr(collected - bizExp - fleetExp)} sub="collected − all expenses" tone={collected - bizExp - fleetExp >= 0 ? 'green' : 'red'} />
        <Kpi label="Bank Unmatched" value={String(unmatched)} sub="credits awaiting match" tone={unmatched ? 'amber' : 'green'} />
      </View>

      <Card title="Receivables Ageing (₹)">
        <Bars fmt={inr} items={[
          { label: '0–30 days', value: bk['0-30'], color: C.green },
          { label: '31–60 days', value: bk['31-60'], color: C.amber },
          { label: '61–90 days', value: bk['61-90'], color: C.amberD },
          { label: '90+ days', value: bk['90+'], color: C.red }
        ]} />
      </Card>

      <Card title="Invoiced vs Collected — 6 Months">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 130, gap: 6 }}>
          {months.map(m => {
            const iv = sum(db.invoices.filter(i => String(i.date).slice(0, 7) === m.key), i => i.total);
            const cv = sum(db.payments.filter(p => String(p.date).slice(0, 7) === m.key), p => p.amount);
            return (
              <View key={m.key} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 100 }}>
                  <View style={{ width: 12, height: Math.max(Math.round(iv / gMax * 96), 2), backgroundColor: C.navy3, borderRadius: 3 }} />
                  <View style={{ width: 12, height: Math.max(Math.round(cv / gMax * 96), 2), backgroundColor: C.green, borderRadius: 3 }} />
                </View>
                <Text style={{ fontSize: 10, color: C.mut, marginTop: 3, fontWeight: '600' }}>{m.label}</Text>
              </View>
            );
          })}
        </View>
        <View style={[S.wrapRow, { marginTop: 8 }]}>
          <Text style={{ fontSize: 11 }}><Text style={{ color: C.navy3 }}>■</Text> Invoiced</Text>
          <Text style={{ fontSize: 11 }}><Text style={{ color: C.green }}>■</Text> Collected</Text>
        </View>
      </Card>

      <Card title="Company / Branch-wise Accounts">
        {(db.branches || []).map(br => {
          const invs = db.invoices.filter(i => i.branchId === br.id);
          const it = sum(invs, i => i.total), ct = sum(invs, i => invPaid(db, i));
          const ex = sum(db.acctExp.filter(e => e.branchId === br.id), e => e.amount);
          return (
            <View key={br.id} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.navy }}>{br.name} <Text style={{ fontWeight: '400', fontSize: 11, color: C.mut }}>{br.entityName || db.company.name}</Text></Text>
              <Text style={{ fontSize: 11.5, color: C.txt, marginTop: 2 }}>
                Invoiced {inr(it)} · Collected {inr(ct)} · <Text style={{ fontWeight: '800', color: it - ct > 0 ? C.red : C.green }}>Out {inr(it - ct)}</Text> · Exp {inr(ex)} · Net <Text style={{ fontWeight: '800', color: ct - ex >= 0 ? C.green : C.red }}>{inr(ct - ex)}</Text>
              </Text>
            </View>
          );
        })}
      </Card>

      <Card title="Expenses by Head (top 8)">
        {(() => {
          const byH = {};
          db.acctExp.forEach(e => { byH[e.account] = (byH[e.account] || 0) + Number(e.amount || 0); });
          const heads = Object.keys(byH).sort((a, b) => byH[b] - byH[a]).slice(0, 8);
          return heads.length ? <Bars fmt={inr} items={heads.map(k => ({ label: k, value: byH[k], color: C.amberD }))} /> : <Empty text="No expense entries yet." />;
        })()}
      </Card>
    </ScrollView>
  );
}
