import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, KV, ModalForm, confirmDo } from '../ui';
import { uid, inr, sum, fmtDate, todayISO, vehicleReg, removeById } from '../logic';

export default function FleetScreen() {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);
  const owned = db.vehicles.filter(v => v.owned);

  const addExpense = () => {
    if (!owned.length) { Alert.alert('No vehicles', 'Add an owned vehicle in Masters first.'); return; }
    setForm({
      title: 'Add Fleet Expense',
      fields: [
        { key: 'vehicleId', label: 'Vehicle', type: 'select', required: true, options: owned.map(v => ({ v: v.id, l: v.regNo })) },
        { key: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
        { key: 'category', label: 'Category', type: 'select', required: true, value: 'Fuel', options: ['Fuel', 'Maintenance', 'Toll/FASTag', 'Driver Salary/Bhatta', 'Tyres', 'Insurance/Permit', 'EMI/Finance', 'Other'].map(x => ({ v: x, l: x })) },
        { key: 'amount', label: 'Amount ₹', type: 'number', required: true },
        { key: 'litres', label: 'Litres (fuel only)', type: 'number' },
        { key: 'notes', label: 'Notes', type: 'multiline' }
      ],
      onSubmit: (v) => update(d => {
        d.expenses.push({ id: uid('e'), vehicleId: v.vehicleId, date: v.date, category: v.category, amount: Number(v.amount) || 0, litres: v.litres, notes: v.notes });
      })
    });
  };

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={[S.row, { justifyContent: 'flex-end', marginBottom: 10 }]}>
        <Btn label="+ Add Expense" tone="amber" onPress={addExpense} />
      </View>

      {!owned.length ? <Card><Empty text="No owned vehicles. Add them in Masters → Vehicles." /></Card> :
        owned.map(v => {
          const trips = db.bookings.filter(b => b.vehicleId === v.id);
          const rev = sum(trips, b => b.freight);
          const ex = db.expenses.filter(e => e.vehicleId === v.id);
          const fuel = sum(ex.filter(e => e.category === 'Fuel'), e => e.amount);
          const maint = sum(ex.filter(e => e.category === 'Maintenance'), e => e.amount);
          const other = sum(ex.filter(e => e.category !== 'Fuel' && e.category !== 'Maintenance'), e => e.amount);
          const net = rev - fuel - maint - other;
          const fp = rev > 0 ? Math.round(fuel / rev * 100) : 0;
          const last = trips.length ? trips.map(b => b.date).sort().pop() : null;
          return (
            <Card key={v.id} title={v.regNo}>
              <Text style={{ fontSize: 11, color: C.mut, marginTop: -8, marginBottom: 8 }}>{v.make}</Text>
              <KV k="Trips" v={String(trips.length)} />
              <KV k="Revenue" v={inr(rev)} />
              <KV k="Fuel" v={inr(fuel) + (rev > 0 ? '  (' + fp + '% of revenue)' : '')} />
              <KV k="Maintenance" v={inr(maint)} />
              <KV k="Other expenses" v={inr(other)} />
              <KV k="Last trip" v={last ? fmtDate(last) : '—'} />
              <View style={[S.wrapRow, { marginTop: 8 }]}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: net >= 0 ? C.green : C.red }}>Net: {inr(net)}</Text>
                {rev > 0 ? <Badge text={'Fuel ' + fp + '%'} tone={fp > 32 ? 'red' : 'green'} /> : null}
              </View>
            </Card>
          );
        })}

      <Card title="Expense Log">
        {!db.expenses.length ? <Empty text="No expenses logged." /> :
          db.expenses.slice().reverse().map(e => (
            <View key={e.id} style={[S.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{e.category} · {inr(e.amount)}</Text>
                <Text style={{ fontSize: 11, color: C.mut }}>{vehicleReg(db, e.vehicleId)} · {fmtDate(e.date)}{e.litres ? ' · ' + e.litres + 'L' : ''}{e.notes ? ' · ' + e.notes : ''}</Text>
              </View>
              <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete expense entry?', () => update(d => removeById(d.expenses, e.id)))} />
            </View>
          ))}
      </Card>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
