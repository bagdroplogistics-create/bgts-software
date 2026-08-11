import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo, Table, alert } from '../ui';
import { uid, inr, sum, fmtDate, todayISO, vehicleReg, removeById } from '../logic';

export default function FleetScreen() {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);
  const owned = db.vehicles.filter(v => v.owned);

  const addExpense = () => {
    if (!owned.length) { alert('No vehicles', 'Add an owned vehicle in Masters first.'); return; }
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

      <Card title="Owned Fleet">
        {!owned.length ? <Empty text="No owned vehicles. Add them in Masters → Vehicles." /> : (
          <Table
            cols={[
              { key: 'vehicle', label: 'Vehicle', width: 150 },
              { key: 'trips', label: 'Trips', width: 60 },
              { key: 'revenue', label: 'Revenue', width: 90 },
              { key: 'fuel', label: 'Fuel', width: 90 },
              { key: 'fuelPct', label: 'Fuel %', width: 70 },
              { key: 'maint', label: 'Maint.', width: 90 },
              { key: 'other', label: 'Other Exp', width: 90 },
              { key: 'net', label: 'Net Contribution', width: 110 },
              { key: 'last', label: 'Last Trip', width: 90 }
            ]}
            rows={owned.map(v => {
              const trips = db.bookings.filter(b => b.vehicleId === v.id);
              const rev = sum(trips, b => b.freight);
              const ex = db.expenses.filter(e => e.vehicleId === v.id);
              const fuel = sum(ex.filter(e => e.category === 'Fuel'), e => e.amount);
              const maint = sum(ex.filter(e => e.category === 'Maintenance'), e => e.amount);
              const other = sum(ex.filter(e => e.category !== 'Fuel' && e.category !== 'Maintenance'), e => e.amount);
              const net = rev - fuel - maint - other;
              const fp = rev > 0 ? Math.round(fuel / rev * 100) : 0;
              const last = trips.length ? trips.map(b => b.date).sort().pop() : null;
              return {
                vehicle: (
                  <View>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{v.regNo}</Text>
                    <Text style={{ fontSize: 10, color: C.mut }}>{v.make}</Text>
                  </View>
                ),
                trips: trips.length,
                revenue: inr(rev),
                fuel: inr(fuel),
                fuelPct: rev > 0 ? <Badge text={fp + '%'} tone={fp > 32 ? 'red' : 'green'} /> : '—',
                maint: inr(maint),
                other: inr(other),
                net: <Text style={{ fontWeight: '800', color: net >= 0 ? C.green : C.red }}>{inr(net)}</Text>,
                last: last ? fmtDate(last) : '—'
              };
            })}
          />
        )}
      </Card>

      <Card title="Expense Log">
        {!db.expenses.length ? <Empty text="No expenses logged." /> : (
          <Table
            cols={[
              { key: 'date', label: 'Date', width: 80 },
              { key: 'vehicle', label: 'Vehicle', width: 100 },
              { key: 'category', label: 'Category', width: 110 },
              { key: 'amount', label: 'Amount', width: 90 },
              { key: 'litres', label: 'Litres', width: 70 },
              { key: 'notes', label: 'Notes', width: 150 },
              { key: 'actions', label: '', width: 60 }
            ]}
            rows={db.expenses.slice().reverse().map(e => ({
              date: fmtDate(e.date),
              vehicle: vehicleReg(db, e.vehicleId),
              category: e.category,
              amount: <Text style={{ fontWeight: '700', color: C.navy }}>{inr(e.amount)}</Text>,
              litres: e.litres || '—',
              notes: e.notes || '—',
              actions: <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete expense entry?', () => update(d => removeById(d.expenses, e.id)))} />
            }))}
          />
        )}
      </Card>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
