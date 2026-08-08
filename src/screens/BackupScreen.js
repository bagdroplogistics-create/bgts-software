import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Kpi, Btn, Empty } from '../ui';
import { inr, sum } from '../logic';

export default function BackupScreen() {
  const { db } = useStore();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const bb = db.billingBackup || [];
  const totalLines = bb.reduce((a, g) => a + g.lines.length, 0);
  const total = sum(bb, g => g.total);

  const query = q.trim().toUpperCase();
  const hits = query
    ? bb.flatMap(g => g.lines.filter(x => String(x[0]).toUpperCase().includes(query) || String(g.client || '').toUpperCase().includes(query)).map(x => ({ bill: g.no, client: g.client, lr: x[0], amt: x[1], billTotal: g.total })))
    : null;
  const comps = {};
  bb.forEach(g => { const k = g.client || '(unknown)'; comps[k] = comps[k] || { bills: 0, total: 0 }; comps[k].bills++; comps[k].total += g.total; });

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Kpi label="Backup Bills" value={String(bb.length)} sub="from BILLING_REGISTER excel" />
        <Kpi label="Companies" value={String(Object.keys(comps).length)} sub="clients in register" />
        <Kpi label="LR Lines" value={String(totalLines)} sub="billing lines archived" />
        <Kpi label="Total Value" value={inr(total)} sub="archived billing value" tone="green" />
      </View>
      <Card title="Company-wise Summary">
        {Object.keys(comps).sort((a, b) => comps[b].total - comps[a].total).map(k => (
          <View key={k} style={[S.row, { justifyContent: 'space-between', marginBottom: 6 }]}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: C.txt, flex: 1 }}>{k}</Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: C.navy }}>{comps[k].bills} · {inr(comps[k].total)}</Text>
          </View>
        ))}
      </Card>
      <Card title="Search Archive">
        <Text style={{ fontSize: 11, color: C.mut, marginBottom: 8 }}>
          Company-wise archive (bill no · client · date · LR lines). Post these as live invoices via Accounting → Import Invoices with the same .xls.
        </Text>
        <TextInput value={q} onChangeText={setQ} placeholder="Search LR no or company, e.g. BRD/06452 or RAJKOT…" placeholderTextColor={C.mut}
          style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, backgroundColor: '#fff', marginBottom: 10 }} />
        {hits ? (
          !hits.length ? <Empty text={'No LR matching "' + q + '".'} /> :
            hits.slice(0, 40).map((x, i) => (
              <View key={i} style={{ marginBottom: 7 }}>
                <View style={[S.row, { justifyContent: 'space-between' }]}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{x.lr}</Text>
                  <Text style={{ fontSize: 12, color: C.txt }}>{inr(x.amt)} · {x.bill}</Text>
                </View>
                {x.client ? <Text style={{ fontSize: 10.5, color: C.mut }}>{x.client}</Text> : null}
              </View>
            ))
        ) : (
          bb.map((g, i) => (
            <View key={g.no} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 6 }}>
              <View style={[S.row, { justifyContent: 'space-between' }]}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy, flex: 1 }}>{g.no} · {(g.client || '').slice(0, 22)}{g.client && g.client.length > 22 ? '…' : ''} · {g.lines.length} LRs</Text>
                <View style={S.wrapRow}>
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: C.navy }}>{inr(g.total)}</Text>
                  <Btn small tone="ghost" label={open === i ? 'Hide' : 'Lines'} onPress={() => setOpen(open === i ? null : i)} />
                </View>
              </View>
              {open === i ? g.lines.map((x, j) => (
                <View key={j} style={[S.row, { justifyContent: 'space-between', paddingLeft: 10, marginTop: 3 }]}>
                  <Text style={{ fontSize: 11.5, color: C.txt }}>{x[0]}</Text>
                  <Text style={{ fontSize: 11.5, color: C.txt }}>{inr(x[1])}</Text>
                </View>
              )) : null}
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
