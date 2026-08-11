import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo, Table, alert } from '../ui';
import { uid, inr, fmtDate, daysTo, clientName, byId, removeById } from '../logic';

export default function ContractsScreen() {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);

  const contractFields = (c) => [
    { key: 'type', label: 'Type', type: 'select', required: true, value: (c && c.type) || 'Tender', options: ['Tender', 'Annual Contract', 'Company Contract'].map(x => ({ v: x, l: x })) },
    { key: 'clientId', label: 'Client', type: 'select', required: true, value: c && c.clientId, options: db.clients.map(x => ({ v: x.id, l: x.name })) },
    { key: 'ref', label: 'Contract / Tender Ref', required: true, value: c && c.ref },
    { key: 'validFrom', label: 'Valid From', type: 'date', value: c && c.validFrom },
    { key: 'validTo', label: 'Valid To', type: 'date', required: true, value: c && c.validTo },
    { key: 'emd', label: 'EMD / BG Amount ₹', type: 'number', value: c && c.emd },
    { key: 'bgExpiry', label: 'BG Expiry Date', type: 'date', value: c && c.bgExpiry, hint: 'A lapsed BG can disqualify a live tender' }
  ];

  const addContract = () => {
    if (!db.clients.length) { alert('No clients', 'Add the client in Masters first.'); return; }
    setForm({
      title: 'New Contract / Tender', fields: contractFields(null),
      onSubmit: (v) => update(d => d.contracts.push({ id: uid('ct'), type: v.type, clientId: v.clientId, ref: v.ref, validFrom: v.validFrom, validTo: v.validTo, emd: v.emd, bgExpiry: v.bgExpiry, rates: [] }))
    });
  };
  const editContract = (c) => setForm({
    title: 'Edit ' + c.ref, fields: contractFields(c),
    onSubmit: (v) => update(d => {
      const x = byId(d.contracts, c.id); if (!x) return;
      x.type = v.type; x.clientId = v.clientId; x.ref = v.ref; x.validFrom = v.validFrom; x.validTo = v.validTo; x.emd = v.emd; x.bgExpiry = v.bgExpiry;
    })
  });
  const addRate = (c) => setForm({
    title: 'Add Rate Line — ' + c.ref,
    fields: [
      { key: 'origin', label: 'Origin', required: true },
      { key: 'destination', label: 'Destination', required: true },
      { key: 'vehicleType', label: 'Vehicle Type', hint: 'Leave blank = any vehicle type' },
      { key: 'rate', label: 'Sanctioned Rate ₹/trip', type: 'number', required: true }
    ],
    onSubmit: (v) => update(d => {
      const x = byId(d.contracts, c.id); if (!x) return;
      x.rates.push({ origin: v.origin, destination: v.destination, vehicleType: v.vehicleType, rate: Number(v.rate) || 0 });
    })
  });

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={[S.row, { justifyContent: 'flex-end', marginBottom: 10 }]}>
        <Btn label="+ New Contract / Tender" tone="amber" onPress={addContract} />
      </View>
      {!db.contracts.length ? <Card><Empty text="No contracts yet. Feed tender / annual contract terms once — the rate engine enforces them on every booking." /></Card> :
        db.contracts.map(c => {
          const d = daysTo(c.validTo);
          return (
            <Card key={c.id}>
              <View style={[S.wrapRow, { marginBottom: 4 }]}>
                <Text style={S.h1}>{c.ref}</Text>
                <Badge text={c.type} tone="navy" />
                {d != null ? <Badge text={d < 0 ? 'EXPIRED' : d <= 30 ? 'EXPIRES ' + d + 'd' : 'ACTIVE'} tone={d < 0 ? 'red' : d <= 30 ? 'amber' : 'green'} /> : null}
              </View>
              <Text style={{ fontSize: 11.5, color: C.mut }}>
                {clientName(db, c.clientId)} · Valid {fmtDate(c.validFrom)} – {fmtDate(c.validTo)}
                {c.emd ? ' · EMD/BG ' + inr(c.emd) : ''}{c.bgExpiry ? ' · BG exp ' + fmtDate(c.bgExpiry) : ''}
              </Text>
              {(c.rates && c.rates.length) ? (
                <View style={{ marginTop: 10 }}>
                  <Table
                    cols={[
                      { key: 'origin', label: 'Origin', width: 130 },
                      { key: 'destination', label: 'Destination', width: 130 },
                      { key: 'vehicleType', label: 'Vehicle Type', width: 130 },
                      { key: 'rate', label: 'Rate (₹/trip)', width: 110 },
                      { key: 'actions', label: '', width: 60 }
                    ]}
                    rows={c.rates.map((r, i) => ({
                      origin: r.origin,
                      destination: r.destination,
                      vehicleType: r.vehicleType || 'Any',
                      rate: <Text style={{ fontWeight: '800', color: C.navy }}>{inr(r.rate)}</Text>,
                      actions: <Btn small tone="red" label="✕" onPress={() => confirmDo('Remove this rate line?', () => update(dd => { const x = byId(dd.contracts, c.id); if (x) x.rates.splice(i, 1); }))} />
                    }))}
                  />
                </View>
              ) : <Text style={{ fontSize: 11, color: C.mut, marginTop: 6 }}>No rate lines yet — add lanes so the booking rate guard can enforce them.</Text>}
              <View style={[S.wrapRow, { marginTop: 10 }]}>
                <Btn small tone="ghost" label="+ Rate Line" onPress={() => addRate(c)} />
                <Btn small tone="ghost" label="Edit" onPress={() => editContract(c)} />
                <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete this contract and its rate lines?', () => update(dd => removeById(dd.contracts, c.id)))} />
              </View>
            </Card>
          );
        })}
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
