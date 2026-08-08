import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo, Table, alert } from '../ui';
import { uid, inr, fmtDate, todayISO, daysSince, byId, removeById, driverName, sum } from '../logic';

export default function AdvancesScreen() {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);
  const list = db.advances.slice().reverse();
  const openTotal = sum(db.advances, a => (Number(a.amount) || 0) - (Number(a.settledAmount) || 0));

  const addAdvance = () => {
    if (!db.drivers.length) { alert('No drivers', 'Add drivers in Masters first.'); return; }
    setForm({
      title: 'New Driver Advance',
      fields: [
        { key: 'driverId', label: 'Driver', type: 'select', required: true, options: db.drivers.map(d => ({ v: d.id, l: d.name })) },
        { key: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
        { key: 'amount', label: 'Amount ₹', type: 'number', required: true },
        { key: 'purpose', label: 'Purpose', value: 'Trip advance' }
      ],
      onSubmit: (v) => update(d => {
        d.advances.push({ id: uid('ad'), driverId: v.driverId, date: v.date, amount: Number(v.amount) || 0, purpose: v.purpose, settledAmount: 0, settledAt: '' });
      })
    });
  };

  const settle = (a) => {
    const open = (Number(a.amount) || 0) - (Number(a.settledAmount) || 0);
    setForm({
      title: 'Settle — ' + driverName(db, a.driverId) + ' (' + inr(open) + ' open)',
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
        { key: 'amount', label: 'Settlement Amount ₹', type: 'number', required: true, value: open, hint: 'Expense receipts + cash returned' }
      ],
      onSubmit: (v) => update(d => {
        const x = byId(d.advances, a.id); if (!x) return;
        x.settledAmount = (Number(x.settledAmount) || 0) + (Number(v.amount) || 0);
        if (x.settledAmount >= Number(x.amount)) x.settledAt = v.date;
      })
    });
  };

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={[S.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: openTotal > 0 ? C.red : C.green }}>
          Open khata: {inr(openTotal)}
        </Text>
        <Btn label="+ New Advance" tone="amber" onPress={addAdvance} />
      </View>
      <Card>
        {!list.length ? <Empty text="No driver advances recorded." /> : (
          <Table
            cols={[
              { key: 'driver', label: 'Driver', width: 130 },
              { key: 'date', label: 'Date', width: 80 },
              { key: 'purpose', label: 'Purpose', width: 130 },
              { key: 'given', label: 'Given', width: 90 },
              { key: 'settled', label: 'Settled', width: 90 },
              { key: 'open', label: 'Open', width: 90 },
              { key: 'status', label: 'Status', width: 110 },
              { key: 'actions', label: '', width: 150 }
            ]}
            rows={list.map(a => {
              const open = (Number(a.amount) || 0) - (Number(a.settledAmount) || 0);
              const age = daysSince(a.date);
              return {
                driver: <Text style={{ fontWeight: '700', color: C.navy }}>{driverName(db, a.driverId)}</Text>,
                date: fmtDate(a.date),
                purpose: a.purpose || 'advance',
                given: inr(a.amount),
                settled: inr(a.settledAmount),
                open: <Text style={{ fontWeight: '800', color: open > 0 ? C.red : C.green }}>{inr(open)}</Text>,
                status: <Badge text={open <= 0 ? 'SETTLED' : age > 10 ? 'OPEN ' + age + 'd ⚑' : 'OPEN'} tone={open <= 0 ? 'green' : age > 10 ? 'red' : 'amber'} />,
                actions: (
                  <View style={S.wrapRow}>
                    {open > 0 ? <Btn small tone="green" label="Settle" onPress={() => settle(a)} /> : null}
                    <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete this advance record?', () => update(d => removeById(d.advances, a.id)))} />
                  </View>
                )
              };
            })}
          />
        )}
      </Card>
      <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 4 }}>
        Advances open beyond 10 days flag on the dashboard — the driver khata is where trip cash leaks.
      </Text>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
