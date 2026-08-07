import React from 'react';
import { View, Text, FlatList, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, confirmDo } from '../ui';
import { inr, fmtDate, byId, removeById, lrHtml } from '../logic';

export default function LRScreen({ navigation }) {
  const { db, update } = useStore();
  const list = db.lrs.slice().reverse();

  const sharePdf = async (l) => {
    try {
      const { uri } = await Print.printToFileAsync({ html: lrHtml(db, l) });
      const ok = await Sharing.isAvailableAsync();
      if (ok) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: l.lrNo });
      else Alert.alert('Saved', 'PDF created at:\n' + uri);
    } catch (e) {
      Alert.alert('PDF error', String(e.message || e));
    }
  };

  const markPOD = (l) => update(d => {
    const x = byId(d.lrs, l.id); if (!x) return;
    x.pod = true;
    if (x.bookingId) {
      const b = byId(d.bookings, x.bookingId);
      if (b) { b.podReceived = true; if (b.status === 'In Transit') b.status = 'Delivered'; }
    }
  });

  const del = (l) => confirmDo('Delete LR ' + l.lrNo + '? Linked booking keeps its data but loses the LR number.', () => update(d => {
    const x = byId(d.lrs, l.id);
    if (x && x.bookingId) { const b = byId(d.bookings, x.bookingId); if (b) b.lrNo = ''; }
    removeById(d.lrs, l.id);
  }));

  const renderItem = ({ item: l }) => (
    <Card>
      <View style={[S.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
        <Text style={S.h1}>{l.lrNo}</Text>
        <View style={S.wrapRow}>
          <Badge text={l.lrType} tone={l.lrType === 'DUMMY' ? 'amber' : 'green'} />
          {l.pod ? <Badge text="POD ✓" tone="green" /> : <Badge text="POD Pending" tone="red" />}
        </View>
      </View>
      <Text style={{ fontSize: 12.5, color: C.txt, fontWeight: '600' }}>
        {fmtDate(l.date)} · {l.truckNo} · {l.fromPlace} → {l.toPlace}
      </Text>
      <Text style={{ fontSize: 11.5, color: C.mut, marginTop: 2 }}>
        {(l.consignor || {}).name || '—'} → {(l.consignee || {}).name || '—'} · {l.payTerms}
      </Text>
      <Text style={{ fontSize: 14, fontWeight: '800', color: C.navy, marginTop: 4 }}>{inr(l.gross)}</Text>
      <View style={[S.wrapRow, { marginTop: 10 }]}>
        <Btn small label="Share PDF" onPress={() => sharePdf(l)} />
        <Btn small tone="ghost" label="Edit" onPress={() => navigation.navigate('LRForm', { lrId: l.id })} />
        {!l.pod ? <Btn small tone="green" label="POD ✓" onPress={() => markPOD(l)} /> : null}
        <Btn small tone="red" label="✕" onPress={() => del(l)} />
      </View>
    </Card>
  );

  return (
    <View style={S.screen}>
      <View style={{ padding: 14, paddingBottom: 6, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Btn label="+ ADD NEW LR" tone="amber" onPress={() => navigation.navigate('LRForm', {})} />
      </View>
      <FlatList data={list} keyExtractor={l => l.id} renderItem={renderItem}
        contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: 60 }}
        ListEmptyComponent={<Empty text="No LRs yet. Tap + ADD NEW LR." />} />
    </View>
  );
}
