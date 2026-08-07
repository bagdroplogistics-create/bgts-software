import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, Linking, Alert } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo, statusTone } from '../ui';
import {
  uid, inr, todayISO, fmtDate, byId, removeById, clientName, vehicleReg,
  findContractRate, waLink, waBookingMsg
} from '../logic';

export default function BookingsScreen({ navigation }) {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);
  const [q, setQ] = useState('');

  const list = db.bookings.slice().reverse().filter(b => {
    const s = (b.bkNo + ' ' + clientName(db, b.clientId) + ' ' + b.origin + ' ' + b.destination + ' ' + b.status + ' ' + (b.lrNo || '')).toLowerCase();
    return s.indexOf(q.toLowerCase()) >= 0;
  });

  const bookingFields = (b) => [
    { key: 'date', label: 'Booking Date', type: 'date', required: true, value: b ? b.date : todayISO() },
    { key: 'clientId', label: 'Client', type: 'select', required: true, value: b && b.clientId, options: db.clients.map(c => ({ v: c.id, l: c.name })) },
    { key: 'mode', label: 'Mode', type: 'select', required: true, value: (b && b.mode) || 'Road', options: ['Road', 'Rail', 'Air'].map(x => ({ v: x, l: x })) },
    { key: 'vehicleType', label: 'Vehicle / Unit Type', value: b && b.vehicleType, hint: 'e.g. Open Body 18ft — must match contract rate lines' },
    { key: 'origin', label: 'Origin', required: true, value: b && b.origin },
    { key: 'destination', label: 'Destination', required: true, value: b && b.destination },
    { key: 'cargo', label: 'Cargo Description', type: 'multiline', value: b && b.cargo },
    { key: 'weightMT', label: 'Weight (MT)', type: 'number', value: b && b.weightMT },
    { key: 'freight', label: 'Freight ₹ (0 = pull contract rate)', type: 'number', required: true, value: b ? b.freight : '0' }
  ];

  /* Rate guard: enforce contract rate, warn on underbilling */
  const rateGuard = (v, done) => {
    const cr = findContractRate(db, v.clientId, v.origin, v.destination, v.vehicleType);
    const entered = Number(v.freight) || 0;
    if (!cr) { done(entered, 'Manual'); return; }
    const src = cr.type + ' ' + cr.ref;
    if (entered === 0) { done(cr.rate, src); return; }
    if (entered < cr.rate) {
      Alert.alert(
        'RATE GUARD ⚑',
        'Contract rate for this lane is ' + inr(cr.rate) + ' (' + cr.ref + ').\nYou entered ' + inr(entered) + ' — BELOW contract.',
        [
          { text: 'Use contract ' + inr(cr.rate), onPress: () => done(cr.rate, src) },
          { text: 'Keep ' + inr(entered), style: 'destructive', onPress: () => done(entered, 'Manual (BELOW contract ' + cr.ref + ')') }
        ]
      );
      return;
    }
    done(entered, src);
  };

  const newBooking = () => {
    if (!db.clients.length) { Alert.alert('No clients', 'Add at least one client in Masters first.'); return; }
    setForm({
      title: 'New Booking', fields: bookingFields(null),
      onSubmit: (v) => rateGuard(v, (freight, src) => update(d => {
        d.bookings.push({
          id: uid('b'), bkNo: 'BK-' + String(d.seq.bk).padStart(4, '0'), date: v.date, clientId: v.clientId,
          origin: v.origin, destination: v.destination, mode: v.mode, vehicleType: v.vehicleType,
          cargo: v.cargo, weightMT: v.weightMT, freight, rateSource: src,
          assignType: '', vehicleId: '', hiredVendorId: '', hiredVehicleNo: '', hireCost: 0,
          driverId: '', status: 'Booked', lrNo: '', ewayBill: '', podReceived: false, invoiceId: ''
        });
        d.seq.bk++;
      }))
    });
  };

  const editBooking = (b) => setForm({
    title: 'Edit ' + b.bkNo, fields: bookingFields(b),
    onSubmit: (v) => rateGuard(v, (freight, src) => update(d => {
      const x = byId(d.bookings, b.id); if (!x) return;
      x.date = v.date; x.clientId = v.clientId; x.mode = v.mode; x.vehicleType = v.vehicleType;
      x.origin = v.origin; x.destination = v.destination; x.cargo = v.cargo; x.weightMT = v.weightMT;
      x.freight = freight; x.rateSource = src;
    }))
  });

  const assign = (b) => setForm({
    title: 'Assign Vehicle — ' + b.bkNo,
    fields: [
      { key: 'assignType', label: 'Assignment', type: 'select', required: true, value: 'Owned', options: [{ v: 'Owned', l: 'Owned' }, { v: 'Hired', l: 'Hired / Market' }] },
      { key: 'vehicleId', label: 'Owned Vehicle', type: 'select', options: db.vehicles.filter(v => v.owned).map(v => ({ v: v.id, l: v.regNo })), hint: 'For OWNED assignment' },
      { key: 'driverId', label: 'Driver', type: 'select', options: db.drivers.map(d => ({ v: d.id, l: d.name })) },
      { key: 'hiredVendorId', label: 'Hired Vendor', type: 'select', options: db.vendors.map(x => ({ v: x.id, l: x.name })), hint: 'For HIRED assignment' },
      { key: 'hiredVehicleNo', label: 'Hired Vehicle No.' },
      { key: 'hireCost', label: 'Hire Cost ₹ (paid to vendor)', type: 'number' }
    ],
    onSubmit: (v) => update(d => {
      const x = byId(d.bookings, b.id); if (!x) return;
      x.assignType = v.assignType;
      if (v.assignType === 'Owned') { x.vehicleId = v.vehicleId; x.driverId = v.driverId; x.hiredVendorId = ''; x.hiredVehicleNo = ''; x.hireCost = 0; }
      else { x.hiredVendorId = v.hiredVendorId; x.hiredVehicleNo = v.hiredVehicleNo; x.hireCost = Number(v.hireCost) || 0; x.vehicleId = ''; x.driverId = v.driverId || ''; }
      if (x.status === 'Booked') x.status = 'Vehicle Assigned';
    })
  });

  const genLR = (b) => navigation.navigate('LRForm', { bookingId: b.id });

  const openWA = (b) => {
    const c = byId(db.clients, b.clientId);
    if (!c || !c.phone) { Alert.alert('No phone', 'Add a WhatsApp number for this client in Masters.'); return; }
    Linking.openURL(waLink(c.phone, waBookingMsg(db, b))).catch(() => Alert.alert('Error', 'Could not open WhatsApp.'));
  };

  const renderItem = ({ item: b }) => (
    <Card>
      <View style={[S.row, { justifyContent: 'space-between', marginBottom: 6 }]}>
        <Text style={S.h1}>{b.bkNo}  <Text style={{ color: C.mut, fontWeight: '400', fontSize: 12 }}>{fmtDate(b.date)} · {b.mode}</Text></Text>
        <Badge text={b.status} tone={statusTone(b.status)} />
      </View>
      <Text style={{ fontSize: 13, color: C.txt, fontWeight: '600' }}>{clientName(db, b.clientId)}</Text>
      <Text style={{ fontSize: 12.5, color: C.txt, marginTop: 2 }}>{b.origin} → {b.destination}</Text>
      <View style={[S.wrapRow, { marginTop: 6 }]}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: C.navy }}>{inr(b.freight)}</Text>
        <Text style={{ fontSize: 10.5, color: C.mut }}>{b.rateSource || ''}</Text>
      </View>
      <View style={[S.wrapRow, { marginTop: 4 }]}>
        {b.assignType === 'Owned' ? <Badge text={'OWN ' + vehicleReg(db, b.vehicleId)} tone="navy" /> :
          b.assignType === 'Hired' ? <Badge text={'HIRE ' + (b.hiredVehicleNo || '')} tone="purple" /> :
            <Badge text="UNASSIGNED" tone="red" />}
        {b.lrNo ? <Badge text={b.lrNo} tone="teal" /> : null}
        {b.podReceived ? <Badge text="POD ✓" tone="green" /> : null}
      </View>
      <View style={[S.wrapRow, { marginTop: 10 }]}>
        {!b.assignType ? <Btn small label="Assign" onPress={() => assign(b)} /> : null}
        {!b.lrNo ? <Btn small tone="amber" label="Gen LR" onPress={() => genLR(b)} /> : null}
        {(b.status === 'In Transit' || b.status === 'Vehicle Assigned') ?
          <Btn small tone="green" label="Delivered" onPress={() => update(d => { const x = byId(d.bookings, b.id); if (x) x.status = 'Delivered'; })} /> : null}
        {(b.status === 'Delivered' && !b.podReceived) ?
          <Btn small tone="ghost" label="POD ✓" onPress={() => update(d => { const x = byId(d.bookings, b.id); if (x) x.podReceived = true; })} /> : null}
        <Btn small tone="wa" label="WA" onPress={() => openWA(b)} />
        <Btn small tone="ghost" label="Edit" onPress={() => editBooking(b)} />
        <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete booking ' + b.bkNo + '?', () => update(d => removeById(d.bookings, b.id)))} />
      </View>
    </Card>
  );

  return (
    <View style={S.screen}>
      <View style={{ padding: 14, paddingBottom: 6, flexDirection: 'row', gap: 8 }}>
        <TextInput value={q} onChangeText={setQ} placeholder="Search bookings…" placeholderTextColor={C.mut}
          style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 }} />
        <Btn label="+ New" tone="amber" onPress={newBooking} />
      </View>
      <FlatList data={list} keyExtractor={b => b.id} renderItem={renderItem}
        contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: 60 }}
        ListEmptyComponent={<Empty text="No bookings match." />} />
      <ModalForm form={form} onClose={() => setForm(null)} />
    </View>
  );
}
