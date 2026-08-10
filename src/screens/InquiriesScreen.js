import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo, alert, Table } from '../ui';
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

  /* Confirmed inquiries convert into a Booking (not a direct LR) — mirrors the
     BGTS workflow: Inquiry -> Confirm -> Booking -> (from the Booking) LR. */
  const convertInquiryToBooking = (q) => {
    if (!q.clientId) {
      alert('Client required', 'Select an Existing Client on this inquiry before converting to a booking (Edit → Existing Client). New parties must first be added under Masters → Clients.');
      return;
    }
    let savedBooking = null, inqNo = q.inqNo;
    update(d => {
      const x = byId(d.inquiries, q.id); if (!x) return;
      const b = {
        id: uid('b'), bkNo: 'BK-' + String(d.seq.bk).padStart(4, '0'), date: todayISO(), branchId: x.branchId || (d.branches[0] || {}).id,
        clientId: x.clientId, origin: x.fromPlace || '', destination: x.toPlace || '', mode: 'Road', vehicleType: x.vehicleType || '',
        cargo: x.cargo || '', weightMT: x.weightMT || '', freight: Number(x.rateQuoted) || 0, rateSource: 'From confirmed inquiry ' + x.inqNo,
        assignType: x.assignType || '', vehicleId: x.assignType === 'Owned' ? x.assignedVehicleId : '',
        hiredVendorId: x.assignType === 'Hired' ? x.assignedVendorId : '', hiredVehicleNo: x.assignType === 'Hired' ? x.assignedTruckNo : '',
        hireCost: 0, driverId: '', status: x.assignType ? 'Vehicle Assigned' : 'Booked', lrNo: '', ewayBill: '', podReceived: false, invoiceId: ''
      };
      d.seq.bk++; d.bookings.push(b);
      x.status = 'CONVERTED'; x.bookingId = b.id;
      inqNo = x.inqNo;
      savedBooking = b;
    });
    if (savedBooking) {
      alert(
        'Booking created',
        'Booking ' + savedBooking.bkNo + ' created from ' + inqNo + '.\n\nCreate the LR now and feed the pending details?',
        [
          { text: 'Go to Bookings', style: 'cancel', onPress: () => navigation.navigate('Bookings') },
          { text: 'Create LR now', onPress: () => navigation.navigate('LRForm', { bookingId: savedBooking.id }) }
        ]
      );
    }
  };

  const inquiryRow = (q) => ({
    inqNo: (
      <View>
        <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{q.inqNo}</Text>
        <Text style={{ fontSize: 10, color: C.mut }}>{branchName(db, q.branchId)}</Text>
      </View>
    ),
    date: fmtDate(q.date),
    party: inqPartyName(db, q),
    route: (q.fromPlace || '?') + ' → ' + (q.toPlace || '?'),
    vehicleNeeded: (q.vehicleType || '—') + (q.weightMT ? ' · ' + q.weightMT + ' MT' : ''),
    expected: q.expectedDate ? fmtDate(q.expectedDate) : '—',
    rateQuoted: q.rateQuoted ? inr(q.rateQuoted) : '—',
    placedWith: q.assignType === 'Owned' && q.assignedVehicleId ? <Text style={{ fontSize: 12 }}><Badge text="OWN" tone="navy" /> {vehicleReg(db, q.assignedVehicleId)}</Text>
      : q.assignType === 'Hired' ? <Text style={{ fontSize: 12 }}><Badge text="HIRE" tone="purple" /> {vendorName(db, q.assignedVendorId)}{q.assignedTruckNo ? ' · ' + q.assignedTruckNo : ''}</Text>
      : <Text style={{ fontSize: 11, color: C.mut }}>No vehicle planned</Text>,
    status: <Badge text={q.status} tone={q.status === 'CONVERTED' ? 'green' : q.status === 'LOST' ? 'red' : q.status === 'CONFIRMED' ? 'amber' : 'purple'} />,
    actions: (
      <View style={S.wrapRow}>
        {(q.status === 'OPEN' || q.status === 'CONFIRMED') ? (<>
          <Btn small label={q.assignType ? 'Re-plan' : 'Plan Vehicle'} onPress={() => planVehicle(q)} />
          {q.status === 'CONFIRMED' ? <Btn small tone="amber" label="✓ Confirm → Booking" onPress={() => convertInquiryToBooking(q)} /> : null}
          <Btn small tone="ghost" label="Edit" onPress={() => editInquiry(q)} />
          <Btn small tone="ghost" label="Lost" onPress={() => setStatus(q, 'LOST')} />
        </>) : q.status === 'LOST' ? (
          <Btn small tone="ghost" label="Reopen" onPress={() => setStatus(q, 'OPEN')} />
        ) : q.status === 'CONVERTED' ? (
          <Btn small tone="ghost" label="View Booking" onPress={() => navigation.navigate('Bookings')} />
        ) : null}
        <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete ' + q.inqNo + '?', () => update(d => removeById(d.inquiries, q.id)))} />
      </View>
    )
  });

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
        <Btn small label="+ New Inquiry" tone="amber" onPress={newInquiry} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: 60 }}>
        <Card>
          {!list.length ? <Empty text="No inquiries here. Every new job starts as an inquiry — capture it with whatever details you have, plan the vehicle, then confirm it into a Booking. The LR is generated from the Booking once it's ready." /> : (
            <Table
              cols={[
                { key: 'inqNo', label: 'Inq No', width: 110 },
                { key: 'date', label: 'Date', width: 80 },
                { key: 'party', label: 'Party', width: 140 },
                { key: 'route', label: 'Route', width: 150 },
                { key: 'vehicleNeeded', label: 'Vehicle Needed', width: 130 },
                { key: 'expected', label: 'Expected', width: 80 },
                { key: 'rateQuoted', label: 'Rate Quoted', width: 100 },
                { key: 'placedWith', label: 'Placed With', width: 140 },
                { key: 'status', label: 'Status', width: 100 },
                { key: 'actions', label: 'Actions', width: 340 }
              ]}
              rows={list.map(inquiryRow)}
            />
          )}
        </Card>
      </ScrollView>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </View>
  );
}
