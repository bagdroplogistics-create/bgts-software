import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo } from '../ui';
import { uid, fmtDate, vehicleReg, byId, removeById, allRenewalItems } from '../logic';

const DOC_TYPES = ['Insurance', 'Permit (National)', 'Permit (State)', 'Fitness', 'PUC', 'Road Tax', 'RC', 'Goods Carriage Permit', 'Other'];

export default function RenewalsScreen() {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);
  const items = allRenewalItems(db);

  const docFields = (r) => [
    { key: 'vehicleId', label: 'Vehicle', type: 'select', required: true, value: r && r.vehicleId, options: db.vehicles.map(v => ({ v: v.id, l: v.regNo })) },
    { key: 'docType', label: 'Document', type: 'select', required: true, value: (r && r.docType) || 'Insurance', options: DOC_TYPES.map(x => ({ v: x, l: x })) },
    { key: 'ref', label: 'Policy / Ref No.', value: r && r.ref },
    { key: 'expiry', label: 'Expiry Date', type: 'date', required: true, value: r && r.expiry }
  ];

  const addDoc = () => {
    if (!db.vehicles.length) { Alert.alert('No vehicles', 'Add a vehicle in Masters first.'); return; }
    setForm({
      title: 'Track Vehicle Document', fields: docFields(null),
      onSubmit: (v) => update(d => d.renewals.push({ id: uid('rn'), vehicleId: v.vehicleId, docType: v.docType, ref: v.ref, expiry: v.expiry }))
    });
  };
  const editDoc = (r) => setForm({
    title: 'Edit Document', fields: docFields(r),
    onSubmit: (v) => update(d => { const x = byId(d.renewals, r.id); if (x) { x.vehicleId = v.vehicleId; x.docType = v.docType; x.ref = v.ref; x.expiry = v.expiry; } })
  });

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={[S.row, { justifyContent: 'flex-end', marginBottom: 10 }]}>
        <Btn label="+ Track Document" tone="amber" onPress={addDoc} />
      </View>

      <Card title="Compliance Calendar (all expiries)">
        {!items.length ? <Empty text="Nothing tracked yet." /> :
          items.map((r, i) => (
            <View key={r.kind + '-' + r.id + '-' + i} style={[S.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{r.label}</Text>
                <Text style={{ fontSize: 11, color: C.mut }}>{r.detail} · {fmtDate(r.expiry)}</Text>
              </View>
              <Badge
                text={r.days == null ? 'NO DATE' : r.days < 0 ? 'EXPIRED' : r.days <= 7 ? 'URGENT ' + r.days + 'd' : r.days <= 30 ? 'DUE ' + r.days + 'd' : 'OK ' + r.days + 'd'}
                tone={r.days == null ? 'amber' : r.days <= 7 ? 'red' : r.days <= 30 ? 'amber' : 'green'} />
            </View>
          ))}
        <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 6 }}>
          Covers vehicle documents, driver licences, contract validity, and BG/EMD expiry. Bands: ≤30 days amber, ≤7 days red.
        </Text>
      </Card>

      <Card title="Vehicle Documents on File">
        {!db.renewals.length ? <Empty text="No vehicle documents tracked yet." /> :
          db.renewals.map(r => (
            <View key={r.id} style={[S.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{vehicleReg(db, r.vehicleId)} · {r.docType}</Text>
                <Text style={{ fontSize: 11, color: C.mut }}>{r.ref || 'no ref'} · expires {fmtDate(r.expiry)}</Text>
              </View>
              <View style={S.wrapRow}>
                <Btn small tone="ghost" label="Edit" onPress={() => editDoc(r)} />
                <Btn small tone="red" label="✕" onPress={() => confirmDo('Stop tracking this document?', () => update(d => removeById(d.renewals, r.id)))} />
              </View>
            </View>
          ))}
      </Card>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
