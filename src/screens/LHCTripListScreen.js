import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Btn, Empty, confirmDo, Table, PickerField } from '../ui';
import { inr, fmtDate, removeById, sum, LHC_AGENTS } from '../logic';

/* "VIEW LHC DETAILS" register — the new LHC module's own list screen,
   reached from LHCTripFormScreen's top-right button (and after SAVE &
   LIST). Independent of LRScreen.js and of the older LHCScreen.js; only
   reads/writes db.lhcTrips. */
export default function LHCTripListScreen({ navigation }) {
  const { db, update } = useStore();
  const [q, setQ] = useState('');
  const [agent, setAgent] = useState('');

  const list = (db.lhcTrips || []).slice()
    .filter(t => !agent || t.agent === agent)
    .filter(t => {
      if (!q) return true;
      const hay = (t.lhcNo + ' ' + (t.truckNo || '') + ' ' + (t.fromPlace || '') + ' ' + (t.toPlace || '')).toLowerCase();
      return hay.indexOf(q.toLowerCase()) >= 0;
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));

  const listNet = sum(list, t => t.netAmount);

  const del = (t) => confirmDo('Delete LHC ' + (t.lhcNo || '') + '?', () => update(d => removeById(d.lhcTrips, t.id)));

  const agentOptions = [{ v: '', l: 'All Agents' }, ...LHC_AGENTS.map(a => ({ v: a, l: a.trim() || '(blank)' }))];

  return (
    <View style={S.screen}>
      <View style={{ padding: 14, paddingBottom: 6, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <Btn label="+ ADD NEW LHC" tone="amber" onPress={() => navigation.navigate('LHCTrip', {})} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: 60 }}>
        <Card title="LHC Details">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <View style={{ minWidth: 220, gap: 4 }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: C.mut, textTransform: 'uppercase' }}>Agent</Text>
              <PickerField value={agent} onChange={setAgent} options={agentOptions} />
            </View>
            <View style={{ minWidth: 220, flexGrow: 1, gap: 4 }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: C.mut, textTransform: 'uppercase' }}>Search (LHC No / Truck No / Route)</Text>
              <TextInput value={q} onChangeText={setQ} placeholder="Type to search…" placeholderTextColor={C.mut}
                style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 7, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: C.txt }} />
            </View>
            <Btn small tone="ghost" label="Reset" onPress={() => { setQ(''); setAgent(''); }} style={{ alignSelf: 'flex-end' }} />
          </View>

          {!list.length ? (
            <Empty text={(db.lhcTrips || []).length ? 'No LHCs match this search.' : 'No LHCs yet. Tap + ADD NEW LHC.'} />
          ) : (<>
            <Text style={{ fontSize: 11.5, color: C.mut, marginBottom: 8 }}>{list.length} LHC(s) · Net {inr(listNet)}</Text>
            <Table
              cols={[
                { key: 'lhcNo', label: 'LHC No', width: 100 },
                { key: 'date', label: 'Date', width: 90 },
                { key: 'truck', label: 'Truck / Route', width: 180 },
                { key: 'agent', label: 'Agent', width: 150 },
                { key: 'lorryHire', label: 'Lorry Hire', width: 100 },
                { key: 'advance', label: 'Advance', width: 100 },
                { key: 'net', label: 'Net Amount', width: 100 },
                { key: 'balance', label: 'Balance', width: 100 },
                { key: 'actions', label: '', width: 150 }
              ]}
              rows={list.map(t => ({
                lhcNo: <Text style={{ fontWeight: '700', color: C.navy }}>{t.lhcNo}</Text>,
                date: fmtDate(t.date),
                truck: (t.truckNo || '—') + '\n' + (t.fromPlace || '') + ' → ' + (t.toPlace || ''),
                agent: (t.agent || '—').trim() || '—',
                lorryHire: inr(t.lorryHire),
                advance: inr(t.advance),
                net: <Text style={{ fontWeight: '800', color: C.navy }}>{inr(t.netAmount)}</Text>,
                balance: <Text style={{ fontWeight: '700', color: Number(t.balanceAmount) > 0 ? C.red : C.green }}>{inr(t.balanceAmount)}</Text>,
                actions: (
                  <View style={S.wrapRow}>
                    <Btn small tone="ghost" label="Edit" onPress={() => navigation.navigate('LHCTrip', { lhcTripId: t.id })} />
                    <Btn small tone="red" label="✕" onPress={() => del(t)} />
                  </View>
                )
              }))}
            />
          </>)}
        </Card>
      </ScrollView>
    </View>
  );
}
