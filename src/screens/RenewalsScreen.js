import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo, Table, RenewalsTable } from '../ui';
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
        <RenewalsTable items={items} />
        <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 6 }}>
          Covers vehicle documents, driver licences, contract validity, and BG/EMD expiry. Bands: ≤30 days amber, ≤7 days red.
        </Text>
      </Card>

      <Card title="Vehicle Documents on File">
        {!db.renewals.length ? <Empty text="No vehicle documents tracked yet." /> : (
          <Table
            cols={[
              { key: 'vehicle', label: 'Vehicle', width: 120 },
              { key: 'doc', label: 'Document', width: 140 },
              { key: 'ref', label: 'Ref No.', width: 150 },
              { key: 'expiry', label: 'Expiry', width: 90 },
              { key: 'actions', label: '', width: 150 }
            ]}
            rows={db.renewals.map(r => ({
              vehicle: <Text style={{ fontWeight: '700', color: C.navy }}>{vehicleReg(db, r.vehicleId)}</Text>,
              doc: r.docType,
              ref: r.ref || 'no ref',
              expiry: fmtDate(r.expiry),
              actions: (
                <View style={S.wrapRow}>
                  <Btn small tone="ghost" label="Edit" onPress={() => editDoc(r)} />
                  <Btn small tone="red" label="✕" onPress={() => confirmDo('Stop tracking this document?', () => update(d => removeById(d.renewals, r.id)))} />
                </View>
              )
            }))}
          />
        )}
      </Card>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
