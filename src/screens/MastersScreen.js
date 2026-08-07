import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo } from '../ui';
import { uid, fmtDate, daysTo, driverName, byId, removeById } from '../logic';

const TABS = [['clients', 'Clients'], ['vehicles', 'Vehicles'], ['drivers', 'Drivers'], ['vendors', 'Vendors'], ['routes', 'Routes']];

export default function MastersScreen() {
  const { db, update } = useStore();
  const [tab, setTab] = useState('clients');
  const [form, setForm] = useState(null);

  /* ----- field configs ----- */
  const clientFields = (c) => [
    { key: 'name', label: 'Client Name', required: true, value: c && c.name },
    { key: 'gstin', label: 'GSTIN', value: c && c.gstin },
    { key: 'phone', label: 'WhatsApp Phone (with 91)', value: c && c.phone, hint: 'e.g. 919825012345' },
    { key: 'email', label: 'Email', value: c && c.email },
    { key: 'creditDays', label: 'Credit Period (days)', type: 'number', value: c ? c.creditDays : 30 },
    { key: 'addr', label: 'Address / City', value: c && c.addr }
  ];
  const vehicleFields = (v) => [
    { key: 'regNo', label: 'Registration No.', required: true, value: v && v.regNo },
    { key: 'make', label: 'Make / Model', value: v && v.make },
    { key: 'type', label: 'Body / Type', value: v && v.type, hint: 'e.g. Open Body 18ft — must match contract rate lines' },
    { key: 'owned', label: 'Ownership', type: 'select', required: true, value: v ? (v.owned ? 'yes' : 'no') : 'yes', options: [{ v: 'yes', l: 'Owned by BGTS' }, { v: 'no', l: 'Empanelled / Market' }] },
    { key: 'gvw', label: 'GVW (kg)', value: v && v.gvw },
    { key: 'driverId', label: 'Default Driver', type: 'select', value: v && v.driverId, options: db.drivers.map(d => ({ v: d.id, l: d.name })) }
  ];
  const driverFields = (d) => [
    { key: 'name', label: 'Driver Name', required: true, value: d && d.name },
    { key: 'phone', label: 'Phone (with 91)', value: d && d.phone },
    { key: 'licNo', label: 'Licence No.', value: d && d.licNo },
    { key: 'licExpiry', label: 'Licence Expiry', type: 'date', value: d && d.licExpiry }
  ];
  const vendorFields = (v) => [
    { key: 'name', label: 'Vendor Name', required: true, value: v && v.name },
    { key: 'phone', label: 'Phone', value: v && v.phone },
    { key: 'city', label: 'City', value: v && v.city },
    { key: 'rating', label: 'Rating', type: 'select', value: (v && v.rating) || 'B', options: ['A', 'B', 'C'].map(x => ({ v: x, l: x })) }
  ];
  const routeFields = () => [
    { key: 'origin', label: 'Origin', required: true },
    { key: 'destination', label: 'Destination', required: true },
    { key: 'km', label: 'Distance (km)', type: 'number' }
  ];

  /* ----- add/edit dispatch ----- */
  const add = () => {
    if (tab === 'clients') setForm({ title: 'Add Client', fields: clientFields(null), onSubmit: v => update(d => d.clients.push({ ...v, id: uid('c') })) });
    else if (tab === 'vehicles') setForm({ title: 'Add Vehicle', fields: vehicleFields(null), onSubmit: v => update(d => d.vehicles.push({ id: uid('v'), regNo: v.regNo, make: v.make, type: v.type, owned: v.owned === 'yes', gvw: v.gvw, driverId: v.driverId })) });
    else if (tab === 'drivers') setForm({ title: 'Add Driver', fields: driverFields(null), onSubmit: v => update(d => d.drivers.push({ ...v, id: uid('d') })) });
    else if (tab === 'vendors') setForm({ title: 'Add Vendor', fields: vendorFields(null), onSubmit: v => update(d => d.vendors.push({ ...v, id: uid('ve') })) });
    else setForm({ title: 'Add Route', fields: routeFields(), onSubmit: v => update(d => d.routes.push({ ...v, id: uid('r') })) });
  };
  const editClient = (c) => setForm({ title: 'Edit Client', fields: clientFields(c), onSubmit: v => update(d => { const x = byId(d.clients, c.id); if (x) Object.keys(v).forEach(k => { x[k] = v[k]; }); }) });
  const editVehicle = (vv) => setForm({ title: 'Edit Vehicle', fields: vehicleFields(vv), onSubmit: v => update(d => { const x = byId(d.vehicles, vv.id); if (x) { x.regNo = v.regNo; x.make = v.make; x.type = v.type; x.owned = v.owned === 'yes'; x.gvw = v.gvw; x.driverId = v.driverId; } }) });
  const editDriver = (dd) => setForm({ title: 'Edit Driver', fields: driverFields(dd), onSubmit: v => update(d => { const x = byId(d.drivers, dd.id); if (x) Object.keys(v).forEach(k => { x[k] = v[k]; }); }) });
  const editVendor = (vv) => setForm({ title: 'Edit Vendor', fields: vendorFields(vv), onSubmit: v => update(d => { const x = byId(d.vendors, vv.id); if (x) Object.keys(v).forEach(k => { x[k] = v[k]; }); }) });

  const Row = ({ title, sub, onEdit, onDel, badge }) => (
    <View style={[S.row, { justifyContent: 'space-between', marginBottom: 9 }]}>
      <View style={{ flex: 1 }}>
        <View style={S.wrapRow}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.navy }}>{title}</Text>
          {badge}
        </View>
        {sub ? <Text style={{ fontSize: 11, color: C.mut }}>{sub}</Text> : null}
      </View>
      {onEdit ? <Btn small tone="ghost" label="Edit" onPress={onEdit} style={{ marginRight: 6 }} /> : null}
      <Btn small tone="red" label="✕" onPress={onDel} />
    </View>
  );

  return (
    <View style={S.screen}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 14, paddingBottom: 6 }}>
        {TABS.map(t => (
          <TouchableOpacity key={t[0]} onPress={() => setTab(t[0])} style={{
            backgroundColor: tab === t[0] ? C.navy : '#fff', borderWidth: 1,
            borderColor: tab === t[0] ? C.navy : C.line2, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 6
          }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tab === t[0] ? '#fff' : C.txt }}>{t[1]}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <Btn small label="+ Add" tone="amber" onPress={add} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: 60 }}>
        <Card>
          {tab === 'clients' && (!db.clients.length ? <Empty text="No clients." /> : db.clients.map(c => (
            <Row key={c.id} title={c.name} sub={(c.gstin || 'no GSTIN') + ' · ' + (c.phone || 'no phone') + ' · credit ' + (c.creditDays || '—') + 'd'}
              onEdit={() => editClient(c)} onDel={() => confirmDo('Delete client?', () => update(d => removeById(d.clients, c.id)))} />
          )))}
          {tab === 'vehicles' && (!db.vehicles.length ? <Empty text="No vehicles." /> : db.vehicles.map(v => (
            <Row key={v.id} title={v.regNo} sub={(v.make || '—') + ' · ' + (v.type || '—') + ' · driver: ' + driverName(db, v.driverId)}
              badge={<Badge text={v.owned ? 'OWNED' : 'EMPANELLED'} tone={v.owned ? 'navy' : 'purple'} />}
              onEdit={() => editVehicle(v)} onDel={() => confirmDo('Delete vehicle?', () => update(d => removeById(d.vehicles, v.id)))} />
          )))}
          {tab === 'drivers' && (!db.drivers.length ? <Empty text="No drivers." /> : db.drivers.map(dd => {
            const dl = daysTo(dd.licExpiry);
            return <Row key={dd.id} title={dd.name} sub={(dd.phone || 'no phone') + ' · lic ' + (dd.licNo || '—') + ' · exp ' + fmtDate(dd.licExpiry)}
              badge={dl != null && dl <= 30 ? <Badge text={dl < 0 ? 'LIC EXPIRED' : 'LIC ' + dl + 'd'} tone="red" /> : null}
              onEdit={() => editDriver(dd)} onDel={() => confirmDo('Delete driver?', () => update(d => removeById(d.drivers, dd.id)))} />;
          }))}
          {tab === 'vendors' && (!db.vendors.length ? <Empty text="No vendors." /> : db.vendors.map(v => (
            <Row key={v.id} title={v.name} sub={(v.city || '—') + ' · ' + (v.phone || 'no phone') + ' · rating ' + (v.rating || '—')}
              onEdit={() => editVendor(v)} onDel={() => confirmDo('Delete vendor?', () => update(d => removeById(d.vendors, v.id)))} />
          )))}
          {tab === 'routes' && (!db.routes.length ? <Empty text="No routes." /> : db.routes.map(r => (
            <Row key={r.id} title={r.origin + ' → ' + r.destination} sub={(r.km || '—') + ' km'}
              onDel={() => confirmDo('Delete route?', () => update(d => removeById(d.routes, r.id)))} />
          )))}
        </Card>
      </ScrollView>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </View>
  );
}
