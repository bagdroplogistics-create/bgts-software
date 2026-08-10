import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Linking } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo, statusTone, Table, alert } from '../ui';
import { printHtml } from '../fileIO';
import {
  uid, inr, todayISO, fmtDate, byId, removeById, clientName, vehicleReg,
  findContractRate, waLink, waBookingMsg, lrHtml
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
    { key: 'branchId', label: 'Branch', type: 'select', required: true, value: (b && b.branchId) || (db.branches[0] || {}).id, options: (db.branches || []).map(x => ({ v: x.id, l: x.name })) },
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
      alert(
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
    if (!db.clients.length) { alert('No clients', 'Add at least one client in Masters first.'); return; }
    setForm({
      title: 'New Booking', fields: bookingFields(null),
      onSubmit: (v) => rateGuard(v, (freight, src) => update(d => {
        d.bookings.push({
          id: uid('b'), bkNo: 'BK-' + String(d.seq.bk).padStart(4, '0'), date: v.date, branchId: v.branchId, clientId: v.clientId,
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
      x.date = v.date; x.branchId = v.branchId; x.clientId = v.clientId; x.mode = v.mode; x.vehicleType = v.vehicleType;
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

  const printLR = async (b) => {
    const l = db.lrs.find(x => x.bookingId === b.id);
    if (!l) { alert('Generate the LR first.'); return; }
    try {
      await printHtml(lrHtml(db, l), l.lrNo);
    } catch (e) { alert('PDF error', String(e.message || e)); }
  };

  const openWA = (b) => {
    const c = byId(db.clients, b.clientId);
    if (!c || !c.phone) { alert('No phone', 'Add a WhatsApp number for this client in Masters.'); return; }
    Linking.openURL(waLink(c.phone, waBookingMsg(db, b))).catch(() => alert('Error', 'Could not open WhatsApp.'));
  };

  const bookingRow = (b) => ({
    bkNo: (
      <View>
        <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{b.bkNo}</Text>
        <Text style={{ fontSize: 10, color: C.mut }}>{b.mode}</Text>
      </View>
    ),
    date: fmtDate(b.date),
    client: clientName(db, b.clientId),
    route: b.origin + ' → ' + b.destination,
    vehicle: b.assignType === 'Owned' ? <Text style={{ fontSize: 12 }}><Badge text="OWN" tone="navy" /> {vehicleReg(db, b.vehicleId)}</Text> :
      b.assignType === 'Hired' ? <Text style={{ fontSize: 12 }}><Badge text="HIRE" tone="purple" /> {b.hiredVehicleNo || ''}</Text> :
        <Badge text="UNASSIGNED" tone="red" />,
    freight: (
      <View>
        <Text style={{ fontSize: 12.5, fontWeight: '800', color: C.navy }}>{inr(b.freight)}</Text>
        <Text style={{ fontSize: 10, color: C.mut }}>{b.rateSource || ''}</Text>
      </View>
    ),
    status: (
      <View>
        <Badge text={b.status} tone={statusTone(b.status)} />
        {b.lrNo ? <Text style={{ fontSize: 10, color: C.txt, marginTop: 2 }}>{b.lrNo}</Text> : null}
        {b.podReceived ? <Badge text="POD ✓" tone="green" /> : null}
      </View>
    ),
    actions: (
      <View style={S.wrapRow}>
        {!b.assignType ? <Btn small label="Assign" onPress={() => assign(b)} /> : null}
        {!b.lrNo ? <Btn small tone="amber" label="Gen LR" onPress={() => genLR(b)} /> : <Btn small tone="ghost" label="Print LR" onPress={() => printLR(b)} />}
        {(b.status === 'In Transit' || b.status === 'Vehicle Assigned') ?
          <Btn small tone="green" label="Delivered" onPress={() => update(d => { const x = byId(d.bookings, b.id); if (x) x.status = 'Delivered'; })} /> : null}
        {(b.status === 'Delivered' && !b.podReceived) ?
          <Btn small tone="ghost" label="POD ✓" onPress={() => update(d => { const x = byId(d.bookings, b.id); if (x) x.podReceived = true; })} /> : null}
        <Btn small tone="wa" label="WA" onPress={() => openWA(b)} />
        <Btn small tone="ghost" label="Edit" onPress={() => editBooking(b)} />
        <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete booking ' + b.bkNo + '?', () => update(d => removeById(d.bookings, b.id)))} />
      </View>
    )
  });

  return (
    <View style={S.screen}>
      <View style={{ padding: 14, paddingBottom: 6, flexDirection: 'row', gap: 8 }}>
        <TextInput value={q} onChangeText={setQ} placeholder="Search bookings…" placeholderTextColor={C.mut}
          style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: 60 }}>
        <Text style={{ fontSize: 11.5, color: C.mut, marginHorizontal: 14, marginBottom: 10 }}>
          Bookings are created only from a confirmed Inquiry (Inquiries → Confirm → Booking). Generate the LR from a booking below once it's ready.
        </Text>
        <Card>
          {!list.length ? <Empty text="No bookings match." /> : (
            <Table
              cols={[
                { key: 'bkNo', label: 'Bk No', width: 90 },
                { key: 'date', label: 'Date', width: 80 },
                { key: 'client', label: 'Client', width: 140 },
                { key: 'route', label: 'Route', width: 160 },
                { key: 'vehicle', label: 'Vehicle', width: 130 },
                { key: 'freight', label: 'Freight', width: 100 },
                { key: 'status', label: 'Status', width: 110 },
                { key: 'actions', label: 'Actions', width: 340 }
              ]}
              rows={list.map(bookingRow)}
            />
          )}
        </Card>
      </ScrollView>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </View>
  );
}
