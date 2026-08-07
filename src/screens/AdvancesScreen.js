import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo } from '../ui';
import { uid, inr, fmtDate, todayISO, daysSince, byId, removeById, driverName, sum } from '../logic';

export default function AdvancesScreen() {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);
  const list = db.advances.slice().reverse();
  const openTotal = sum(db.advances, a => (Number(a.amount) || 0) - (Number(a.settledAmount) || 0));

  const addAdvance = () => {
    if (!db.drivers.length) { Alert.alert('No drivers', 'Add drivers in Masters first.'); return; }
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
      {!list.length ? <Card><Empty text="No driver advances recorded." /></Card> :
        list.map(a => {
          const open = (Number(a.amount) || 0) - (Number(a.settledAmount) || 0);
          const age = daysSince(a.date);
          return (
            <Card key={a.id}>
              <View style={[S.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
                <Text style={S.h1}>{driverName(db, a.driverId)}</Text>
                <Badge text={open <= 0 ? 'SETTLED' : age > 10 ? 'OPEN ' + age + 'd ⚑' : 'OPEN'} tone={open <= 0 ? 'green' : age > 10 ? 'red' : 'amber'} />
              </View>
              <Text style={{ fontSize: 11.5, color: C.mut }}>
                {fmtDate(a.date)} · {a.purpose || 'advance'} · Given {inr(a.amount)} · Settled {inr(a.settledAmount)}
              </Text>
              <Text style={{ fontSize: 13.5, fontWeight: '800', color: open > 0 ? C.red : C.green, marginTop: 4 }}>
                Open: {inr(open)}
              </Text>
              <View style={[S.wrapRow, { marginTop: 8 }]}>
                {open > 0 ? <Btn small tone="green" label="Settle" onPress={() => settle(a)} /> : null}
                <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete this advance record?', () => update(d => removeById(d.advances, a.id)))} />
              </View>
            </Card>
          );
        })}
      <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 4 }}>
        Advances open beyond 10 days flag on the dashboard — the driver khata is where trip cash leaks.
      </Text>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
