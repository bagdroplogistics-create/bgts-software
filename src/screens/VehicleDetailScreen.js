import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo, Table, renewalStatus, alert } from '../ui';
import {
  byId, removeById, fmtDate, daysTo, inr,
  vehicleEmiOutstanding, vehicleTCO, vehicleDueSoon, vehicleServiceRecords, expenseFields, pushExpense
} from '../logic';

/* New drill-down page reached only via Masters -> Vehicles -> "View" (not in the
   sidebar nav, matching the uploaded reference build's vVehicleDetail() which is
   hide:true / not a nav item). Document expiries (Insurance/Permit/Fitness/PUC/
   Road Tax) are read from the existing db.renewals module instead of new flat
   vehicle fields, so there is only one expiry-tracking system in the app. */
export default function VehicleDetailScreen({ route, navigation }) {
  const { db, update } = useStore();
  const vehicleId = (route.params || {}).vehicleId;
  const v = byId(db.vehicles, vehicleId);
  const [form, setForm] = useState(null);
  const [catFilter, setCatFilter] = useState('');

  if (!v) {
    return (
      <ScrollView style={S.screen} contentContainerStyle={S.pad}>
        <Card><Empty text="Vehicle not found." /></Card>
      </ScrollView>
    );
  }

  const docs = db.renewals.filter(r => r.vehicleId === v.id);
  const emi = vehicleEmiOutstanding(v);
  const tco = vehicleTCO(db, v);
  const due = vehicleDueSoon(db, v);
  const recs = vehicleServiceRecords(db, v.id);
  const allEx = db.expenses.filter(e => e.vehicleId === v.id).slice().sort((a, b) => (a.date || '') < (b.date || '') ? 1 : -1);
  const byCat = {};
  allEx.forEach(e => { const c = e.category || 'Other'; byCat[c] = (byCat[c] || 0) + (Number(e.amount) || 0); });
  const catTotals = Object.keys(byCat).map(c => ({ c, t: byCat[c] })).sort((a, b) => b.t - a.t);
  const totalAllCat = allEx.reduce((t, e) => t + (Number(e.amount) || 0), 0);
  const shownEx = catFilter ? allEx.filter(e => (e.category || '') === catFilter) : allEx;

  const addServiceExpense = () => {
    setForm({
      title: 'Add Service / Expense — ' + v.regNo,
      fields: expenseFields(db.vehicles.filter(x => x.owned), { vehicleId: v.id, category: 'Maintenance' }),
      onSubmit: (vals) => update(d => pushExpense(d, vals))
    });
  };

  const KVRow = ({ k1, v1, k2, v2 }) => (
    <View style={[S.row, { borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 7 }]}>
      <Text style={{ width: 130, fontSize: 11, fontWeight: '700', color: C.mut, textTransform: 'uppercase' }}>{k1}</Text>
      <Text style={{ flex: 1, fontSize: 12.5, color: C.txt, fontWeight: '600' }}>{v1}</Text>
      {k2 ? <Text style={{ width: 130, fontSize: 11, fontWeight: '700', color: C.mut, textTransform: 'uppercase' }}>{k2}</Text> : null}
      {k2 ? <Text style={{ flex: 1, fontSize: 12.5, color: C.txt, fontWeight: '600' }}>{v2}</Text> : null}
    </View>
  );

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <Card title={v.regNo} right={
        <View style={S.wrapRow}>
          <Btn small tone="ghost" label="Edit Vehicle" onPress={() => navigation.navigate('Masters', { tab: 'vehicles', editVehicleId: v.id })} />
          <Btn small tone="ghost" label="← Back to Masters" onPress={() => navigation.navigate('Masters', { tab: 'vehicles' })} />
        </View>
      }>
        <KVRow k1="Make/Model" v1={(v.make || '—') + ' ' + (v.model || '')} k2="Type" v2={v.type || '—'} />
        <KVRow k1="Status" v1={v.status || 'Active'} k2="Ownership" v2={v.owned ? 'OWNED' : 'EMPANELLED'} />
        <KVRow k1="Chassis No." v1={v.chassisNo || '—'} k2="Engine No." v2={v.engineNo || '—'} />
        <KVRow k1="RC No." v1={v.rcNo || '—'} k2="Year of Mfg" v2={v.yearOfMfg || '—'} />
        <KVRow k1="Fuel Type" v1={v.fuelType || '—'} k2="Capacity" v2={(v.capacityTons || '—') + ' Tons / ' + (v.gvw || '—') + ' kg GVW'} />
        <KVRow k1="Odometer" v1={(v.odometerKm || 0) + ' km'} />
      </Card>

      <Card title="Tracked Documents (from Renewals & Compliance)">
        {!docs.length ? <Empty text="No documents tracked for this vehicle yet. Add via Renewals & Compliance." /> : (
          <Table
            cols={[
              { key: 'doc', label: 'Document', width: 140 },
              { key: 'ref', label: 'Ref No.', width: 140 },
              { key: 'expiry', label: 'Expiry', width: 90 },
              { key: 'status', label: 'Status', width: 100 }
            ]}
            rows={docs.map(r => ({
              doc: <Text style={{ fontWeight: '700', color: C.navy }}>{r.docType}</Text>,
              ref: r.ref || 'no ref',
              expiry: fmtDate(r.expiry),
              status: renewalStatus(daysTo(r.expiry))
            }))}
          />
        )}
      </Card>

      <Card title="EMI / Finance Summary">
        <KVRow k1="Financier" v1={v.financier || '—'} k2="Loan Amount" v2={v.loanAmount ? inr(v.loanAmount) : '—'} />
        <KVRow k1="EMI Amount" v1={v.emiAmount ? inr(v.emiAmount) : '—'} k2="Months Remaining" v2={v.emiTenureMonths ? emi.remaining : '—'} />
        <KVRow k1="Outstanding (approx)" v1={emi.outstanding ? inr(emi.outstanding) : '—'} />
      </Card>

      <Card title="Total Cost of Ownership">
        <KVRow k1="Purchase Price" v1={inr(tco.purchase)} />
        <KVRow k1="EMI Paid to Date (approx)" v1={inr(tco.emiPaidToDate)} />
        <KVRow k1="All Logged Expenses to Date" v1={inr(tco.allExpenses)} />
        <View style={[S.row, { paddingVertical: 8 }]}>
          <Text style={{ width: 130, fontSize: 11.5, fontWeight: '800', color: C.navy, textTransform: 'uppercase' }}>Total TCO</Text>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: C.navy }}>{inr(tco.total)}</Text>
        </View>
      </Card>

      <Card title="Due Soon Alerts">
        {!due.length ? <Empty text="Nothing due within 30 days / 1000 km." /> : (
          <View>
            {due.map((r, i) => (
              <View key={i} style={[S.row, { paddingVertical: 4, alignItems: 'center' }]}>
                <Badge text="DUE" tone="amber" />
                <Text style={{ fontSize: 12.5, color: C.txt, marginLeft: 8 }}>{r}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card title="Service / Repair History (Wear & Tear)" right={<Btn small tone="amber" label="+ Add Service/Expense" onPress={addServiceExpense} />}>
        {!recs.length ? <Empty text="No maintenance/repair records yet." /> : (
          <Table
            cols={[
              { key: 'date', label: 'Date', width: 80 },
              { key: 'odo', label: 'Odometer', width: 90 },
              { key: 'type', label: 'Service Type', width: 130 },
              { key: 'vendor', label: 'Vendor', width: 120 },
              { key: 'amount', label: 'Amount', width: 90 },
              { key: 'parts', label: 'Parts Replaced', width: 140 },
              { key: 'nextDue', label: 'Next Due', width: 110 }
            ]}
            rows={recs.map(r => ({
              date: fmtDate(r.date),
              odo: r.odometerAtService || '—',
              type: r.serviceType || r.category,
              vendor: r.vendor || '—',
              amount: inr(r.amount),
              parts: r.partsReplaced || '—',
              nextDue: (r.nextServiceDueKm ? (r.nextServiceDueKm + ' km ') : '') + (r.nextServiceDueDate ? fmtDate(r.nextServiceDueDate) : (r.nextServiceDueKm ? '' : '—'))
            }))}
          />
        )}
      </Card>

      <Card title="Detailed Expense List — This Vehicle" right={<Btn small tone="amber" label="+ Add Expense" onPress={addServiceExpense} />}>
        {catTotals.length ? (
          <Table
            cols={[{ key: 'cat', label: 'Category', width: 160 }, { key: 'total', label: 'Total Spent', width: 110 }]}
            rows={[
              ...catTotals.map(x => ({ cat: x.c, total: inr(x.t) })),
              { cat: <Text style={{ fontWeight: '800', color: C.navy }}>Total (All Categories)</Text>, total: <Text style={{ fontWeight: '800', color: C.navy }}>{inr(totalAllCat)}</Text> }
            ]}
          />
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 4 }}>
          <TouchableOpacity onPress={() => setCatFilter('')} style={{
            backgroundColor: !catFilter ? C.navy : '#fff', borderWidth: 1, borderColor: !catFilter ? C.navy : C.line2,
            borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6
          }}>
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: !catFilter ? '#fff' : C.txt }}>All Categories</Text>
          </TouchableOpacity>
          {catTotals.map(x => (
            <TouchableOpacity key={x.c} onPress={() => setCatFilter(x.c)} style={{
              backgroundColor: catFilter === x.c ? C.navy : '#fff', borderWidth: 1, borderColor: catFilter === x.c ? C.navy : C.line2,
              borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6
            }}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: catFilter === x.c ? '#fff' : C.txt }}>{x.c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {!shownEx.length ? <Empty text="No expenses logged for this vehicle yet." /> : (
          <Table
            cols={[
              { key: 'date', label: 'Date', width: 80 },
              { key: 'category', label: 'Category', width: 120 },
              { key: 'amount', label: 'Amount', width: 90 },
              { key: 'vendor', label: 'Vendor', width: 120 },
              { key: 'notes', label: 'Notes', width: 150 },
              { key: 'actions', label: '', width: 60 }
            ]}
            rows={shownEx.map(e => ({
              date: fmtDate(e.date),
              category: e.category || '—',
              amount: <Text style={{ fontWeight: '700', color: C.navy }}>{inr(e.amount)}</Text>,
              vendor: e.vendor || '—',
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
