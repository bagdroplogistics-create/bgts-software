import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Kpi, Btn, Empty, Table } from '../ui';
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
        {!Object.keys(comps).length ? <Empty text="No archive data yet." /> : (
          <Table
            cols={[
              { key: 'company', label: 'Company', width: 200 },
              { key: 'bills', label: 'Bills', width: 80 },
              { key: 'total', label: 'Total Billed', width: 110 }
            ]}
            rows={Object.keys(comps).sort((a, b) => comps[b].total - comps[a].total).map(k => ({
              company: <Text style={{ fontWeight: '700', color: C.navy }}>{k}</Text>,
              bills: comps[k].bills,
              total: <Text style={{ fontWeight: '800', color: C.navy }}>{inr(comps[k].total)}</Text>
            }))}
          />
        )}
      </Card>
      <Card title="Search Archive">
        <Text style={{ fontSize: 11, color: C.mut, marginBottom: 8 }}>
          Company-wise archive (bill no · client · date · LR lines). Post these as live invoices via Accounting → Import Invoices with the same .xls.
        </Text>
        <TextInput value={q} onChangeText={setQ} placeholder="Search LR no or company, e.g. BRD/06452 or RAJKOT…" placeholderTextColor={C.mut}
          style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, backgroundColor: '#fff', marginBottom: 10 }} />
        {hits ? (
          !hits.length ? <Empty text={'No LR matching "' + q + '".'} /> : (
            <Table
              cols={[
                { key: 'lr', label: 'LR No', width: 120 },
                { key: 'amt', label: 'Amount', width: 100 },
                { key: 'bill', label: 'Bill', width: 100 },
                { key: 'client', label: 'Client', width: 160 }
              ]}
              rows={hits.slice(0, 40).map((x, i) => ({
                lr: <Text style={{ fontWeight: '700', color: C.navy }}>{x.lr}</Text>,
                amt: inr(x.amt),
                bill: x.bill,
                client: x.client || '—'
              }))}
            />
          )
        ) : !bb.length ? <Empty text="No archive data yet." /> : (
          <>
            <Table
              cols={[
                { key: 'bill', label: 'Bill No / Company', width: 220 },
                { key: 'lines', label: 'LR Lines', width: 80 },
                { key: 'total', label: 'Total', width: 100 },
                { key: 'actions', label: '', width: 90 }
              ]}
              rows={bb.map((g, i) => ({
                bill: (
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>
                    {g.no} · {(g.client || '').slice(0, 22)}{g.client && g.client.length > 22 ? '…' : ''}
                  </Text>
                ),
                lines: g.lines.length,
                total: <Text style={{ fontWeight: '800', color: C.navy }}>{inr(g.total)}</Text>,
                actions: <Btn small tone="ghost" label={open === i ? 'Hide' : 'Lines'} onPress={() => setOpen(open === i ? null : i)} />
              }))}
            />
            {open != null && bb[open] ? (
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginBottom: 6 }}>
                  {bb[open].no} — LR Lines
                </Text>
                <Table
                  cols={[
                    { key: 'lr', label: 'LR No', width: 160 },
                    { key: 'amount', label: 'Amount', width: 120 }
                  ]}
                  rows={bb[open].lines.map((x, j) => ({ lr: x[0], amount: inr(x[1]) }))}
                />
              </View>
            ) : null}
          </>
        )}
      </Card>
    </ScrollView>
  );
}
