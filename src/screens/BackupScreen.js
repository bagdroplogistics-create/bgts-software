import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Kpi, Btn, Empty, Table, alert } from '../ui';
import { inr, sum, fmtDate, csvString } from '../logic';
import { downloadFile } from '../fileIO';

export default function BackupScreen({ navigation }) {
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

  const exportBackupCsv = async () => {
    try {
      const rows = [['Bill No', 'Company', 'Date', 'LR No', 'Amount', 'Bill Total']];
      bb.forEach(g => { g.lines.forEach(x => { rows.push([g.no, g.client || '', g.date || '', x[0], x[1], g.total]); }); });
      await downloadFile('BGTS_Invoice_Backup_Register.csv', csvString(rows), 'text/csv');
    } catch (e) { alert('Error', String(e.message || e)); }
  };

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={{ marginBottom: 4 }}>
        <Btn small tone="ghost" label="← Accounting" onPress={() => navigation.navigate('Accounting')} />
      </View>
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
      <Card title="Search Archive" right={<Btn small tone="ghost" label="Export CSV" onPress={exportBackupCsv} />}>
        <Text style={{ fontSize: 11, color: C.mut, marginBottom: 8 }}>
          Company-wise archive (bill no · client · date · LR lines). Post these as live invoices via Accounting → Import Invoices with the same .xls.
        </Text>
        <TextInput value={q} onChangeText={setQ} placeholder="Search LR no, e.g. BRD/06452…" placeholderTextColor={C.mut}
          style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, backgroundColor: '#fff', marginBottom: 10 }} />
        {hits ? (
          !hits.length ? <Empty text={'No LR matching "' + q + '" in the archive.'} /> : (
            <>
              <Table
                cols={[
                  { key: 'lr', label: 'LR No', width: 120 },
                  { key: 'amt', label: 'Amount', width: 100 },
                  { key: 'inBill', label: 'In Bill', width: 160 },
                  { key: 'billTotal', label: 'Bill Total', width: 100 }
                ]}
                rows={hits.slice(0, 50).map((x, i) => ({
                  lr: <Text style={{ fontWeight: '700', color: C.navy }}>{x.lr}</Text>,
                  amt: inr(x.amt),
                  inBill: (
                    <View>
                      <Text style={{ fontSize: 12.5, color: C.txt }}>{x.bill}</Text>
                      {x.client ? <Text style={{ fontSize: 10, color: C.mut }}>{x.client}</Text> : null}
                    </View>
                  ),
                  billTotal: inr(x.billTotal)
                }))}
              />
              {hits.length > 50 ? <Text style={{ fontSize: 11, color: C.mut, marginTop: 6 }}>…{hits.length - 50} more matches</Text> : null}
            </>
          )
        ) : !bb.length ? <Empty text="No archive data yet." /> : (
          <>
            <Table
              cols={[
                { key: 'bill', label: 'Bill No', width: 120 },
                { key: 'company', label: 'Company', width: 220 },
                { key: 'date', label: 'Date', width: 90 },
                { key: 'lines', label: 'LR Lines', width: 80 },
                { key: 'total', label: 'Total', width: 100 },
                { key: 'actions', label: '', width: 90 }
              ]}
              rows={bb.map((g, i) => ({
                bill: <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{g.no}</Text>,
                company: g.client || '—',
                date: fmtDate(g.date),
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
