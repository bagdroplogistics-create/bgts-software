import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo } from '../ui';
import { uid, inr, fmtDate, todayISO, byId, removeById, branchName, vehicleReg, vendorName, inqPartyName } from '../logic';

const FILTERS = ['ACTIVE', 'OPEN', 'CONFIRMED', 'CONVERTED', 'LOST', 'ALL'];

export default function InquiriesScreen({ navigation }) {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);
  const [filter, setFilter] = useState('ACTIVE');

  const list = db.inquiries.slice().reverse().filter(q => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') return q.status === 'OPEN' || q.status === 'CONFIRMED';
    return q.status === filter;
  });

  const inquiryFields = (q) => [
    { key: 'date', label: 'Inquiry Date', type: 'date', value: q ? q.date : todayISO() },
    { key: 'branchId', label: 'Branch', type: 'select', value: (q && q.branchId) || (db.branches[0] || {}).id, options: db.branches.map(x => ({ v: x.id, l: x.name })) },
    { key: 'clientId', label: 'Existing Client', type: 'select', value: q && q.clientId, options: db.clients.map(c => ({ v: c.id, l: c.name })) },
    { key: 'partyName', label: 'Party Name (if new)', value: q && q.partyName },
    { key: 'contact', label: 'Contact / Phone', value: q && q.contact },
    { key: 'fromPlace', label: 'From Place', value: q && q.fromPlace },
    { key: 'toPlace', label: 'To Place', value: q && q.toPlace },
    { key: 'vehicleType', label: 'Vehicle Type Needed', value: q && q.vehicleType },
    { key: 'cargo', label: 'Cargo Description', type: 'multiline', value: q && q.cargo },
    { key: 'weightMT', label: 'Weight (MT)', type: 'number', value: q && q.weightMT },
    { key: 'expectedDate', label: 'Expected Loading Date', type: 'date', value: q && q.expectedDate },
    { key: 'rateQuoted', label: 'Rate Quoted ₹', type: 'number', value: q && q.rateQuoted },
    { key: 'ownershipPref', label: 'Plan With', type: 'select', value: (q && q.ownershipPref) || '', options: [{ v: '', l: 'Undecided' }, { v: 'Owned', l: 'Owned' }, { v: 'Hired', l: 'Hired' }] },
    { key: 'notes', label: 'Notes', type: 'multiline', value: q && q.notes }
  ];

  const newInquiry = () => setForm({
    title: 'New Inquiry (nothing mandatory)', fields: inquiryFields(null),
    onSubmit: (v) => update(d => {
      d.inquiries.push({ id: uid('q'), inqNo: 'INQ-' + String(d.seq.inq).padStart(4, '0'), status: 'OPEN',
        assignType: '', assignedVehicleId: '', assignedVendorId: '', assignedTruckNo: '', lrId: '', ...v });
      d.seq.inq++;
    })
  });
  const editInquiry = (q) => setForm({
    title: 'Edit ' + q.inqNo, fields: inquiryFields(q),
    onSubmit: (v) => update(d => { const x = byId(d.inquiries, q.id); if (x) Object.keys(v).forEach(k => { x[k] = v[k]; }); })
  });
  const planVehicle = (q) => setForm({
    title: 'Vehicle Planning — ' + q.inqNo,
    fields: [
      { key: 'assignType', label: 'Place With', type: 'select', required: true, value: q.assignType || q.ownershipPref || 'Owned', options: [{ v: 'Owned', l: 'Owned' }, { v: 'Hired', l: 'Hired' }] },
      { key: 'assignedVehicleId', label: 'Owned Vehicle', type: 'select', value: q.assignedVehicleId, options: db.vehicles.filter(v => v.owned).map(v => ({ v: v.id, l: v.regNo })) },
      { key: 'assignedVendorId', label: 'Hired Vendor', type: 'select', value: q.assignedVendorId, options: db.vendors.map(x => ({ v: x.id, l: x.name })) },
      { key: 'assignedTruckNo', label: 'Hired Truck No.', value: q.assignedTruckNo }
    ],
    onSubmit: (v) => update(d => {
      const x = byId(d.inquiries, q.id); if (!x) return;
      x.assignType = v.assignType;
      if (v.assignType === 'Owned'){ x.assignedVehicleId = v.assignedVehicleId; x.assignedVendorId = ''; x.assignedTruckNo = ''; }
      else { x.assignedVendorId = v.assignedVendorId; x.assignedTruckNo = v.assignedTruckNo; x.assignedVehicleId = ''; }
      if (x.status === 'OPEN') x.status = 'CONFIRMED';
    })
  });
  const setStatus = (q, st) => update(d => { const x = byId(d.inquiries, q.id); if (x) x.status = st; });

  return (
    <View style={S.screen}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 14, paddingBottom: 6 }}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={{
            backgroundColor: filter === f ? C.navy : '#fff', borderWidth: 1, borderColor: filter === f ? C.navy : C.line2,
            borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: filter === f ? '#fff' : C.txt }}>{f}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <Btn small label="+ New" tone="amber" onPress={newInquiry} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: 60 }}>
        {!list.length ? <Card><Empty text="No inquiries here. Every job starts as an inquiry — capture what you have, plan a vehicle, convert to LR." /></Card> :
          list.map(q => (
            <Card key={q.id}>
              <View style={[S.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
                <Text style={S.h1}>{q.inqNo} · {inqPartyName(db, q)}</Text>
                <Badge text={q.status} tone={q.status === 'CONVERTED' ? 'green' : q.status === 'LOST' ? 'red' : q.status === 'CONFIRMED' ? 'amber' : 'purple'} />
              </View>
              <Text style={{ fontSize: 12, color: C.txt }}>
                {fmtDate(q.date)} · {branchName(db, q.branchId)} · {(q.fromPlace || '?') + ' → ' + (q.toPlace || '?')}
                {q.vehicleType ? ' · ' + q.vehicleType : ''}{q.weightMT ? ' · ' + q.weightMT + ' MT' : ''}
              </Text>
              <Text style={{ fontSize: 11.5, color: C.mut, marginTop: 2 }}>
                {q.expectedDate ? 'Loads ' + fmtDate(q.expectedDate) + ' · ' : ''}
                {q.rateQuoted ? 'Quoted ' + inr(q.rateQuoted) + ' · ' : ''}
                {q.assignType === 'Owned' && q.assignedVehicleId ? 'Placed: OWN ' + vehicleReg(db, q.assignedVehicleId)
                  : q.assignType === 'Hired' ? 'Placed: HIRE ' + vendorName(db, q.assignedVendorId) + (q.assignedTruckNo ? ' · ' + q.assignedTruckNo : '')
                  : 'No vehicle planned'}
              </Text>
              <View style={[S.wrapRow, { marginTop: 10 }]}>
                {(q.status === 'OPEN' || q.status === 'CONFIRMED') ? (<>
                  <Btn small label={q.assignType ? 'Re-plan' : 'Plan Vehicle'} onPress={() => planVehicle(q)} />
                  <Btn small tone="amber" label="→ LR" onPress={() => navigation.navigate('LRForm', { inquiryId: q.id })} />
                  <Btn small tone="ghost" label="Edit" onPress={() => editInquiry(q)} />
                  <Btn small tone="ghost" label="Lost" onPress={() => setStatus(q, 'LOST')} />
                </>) : q.status === 'LOST' ? (
                  <Btn small tone="ghost" label="Reopen" onPress={() => setStatus(q, 'OPEN')} />
                ) : (
                  <Btn small tone="ghost" label="View LRs" onPress={() => navigation.navigate('LR')} />
                )}
                <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete ' + q.inqNo + '?', () => update(d => removeById(d.inquiries, q.id)))} />
              </View>
            </Card>
          ))}
      </ScrollView>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </View>
  );
}
