import React, { useState } from 'react';
import { View, Text, ScrollView, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm } from '../ui';
import { inr, fmtDate, todayISO, byId } from '../logic';

export default function PODScreen() {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);

  const pending = db.lrs.filter(l => !l.pod).slice().reverse();
  const done = db.lrs.filter(l => l.pod).slice().reverse();

  const capture = async (lr, fromCamera) => {
    try {
      let res;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Camera permission needed', 'Allow camera access to photograph the signed POD.'); return; }
        res = await ImagePicker.launchCameraAsync({ quality: 0.5, allowsEditing: false });
      } else {
        res = await ImagePicker.launchImageLibraryAsync({ quality: 0.5, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      }
      if (res.canceled || !res.assets || !res.assets.length) return;
      const asset = res.assets[0];
      const dest = FileSystem.documentDirectory + 'pod_' + lr.id + '.jpg';
      await FileSystem.copyAsync({ from: asset.uri, to: dest });
      setForm({
        title: 'POD Received — ' + lr.lrNo,
        fields: [
          { key: 'receiver', label: 'Receiver Name' },
          { key: 'date', label: 'Delivery / POD Date', type: 'date', required: true, value: todayISO() },
          { key: 'remarks', label: 'Remarks', type: 'multiline' }
        ],
        submitLabel: 'Save POD',
        onSubmit: (v) => update(d => {
          const x = byId(d.lrs, lr.id); if (!x) return;
          x.pod = true; x.podFileUri = dest; x.podReceiver = v.receiver; x.podDate = v.date; x.podRemarks = v.remarks;
          if (x.bookingId) { const b = byId(d.bookings, x.bookingId); if (b) { b.podReceived = true; if (b.status === 'In Transit') b.status = 'Delivered'; } }
        })
      });
    } catch (e) { Alert.alert('Error', String(e.message || e)); }
  };

  const markNoFile = (lr) => setForm({
    title: 'Mark POD (no file) — ' + lr.lrNo,
    fields: [
      { key: 'receiver', label: 'Receiver Name' },
      { key: 'date', label: 'Delivery / POD Date', type: 'date', required: true, value: todayISO() }
    ],
    onSubmit: (v) => update(d => {
      const x = byId(d.lrs, lr.id); if (!x) return;
      x.pod = true; x.podReceiver = v.receiver; x.podDate = v.date;
      if (x.bookingId) { const b = byId(d.bookings, x.bookingId); if (b) { b.podReceived = true; if (b.status === 'In Transit') b.status = 'Delivered'; } }
    })
  });

  const sharePod = async (lr) => {
    try {
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(lr.podFileUri, { dialogTitle: 'POD ' + lr.lrNo });
    } catch (e) { Alert.alert('Error', String(e.message || e)); }
  };

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <Card title={'Pending POD (' + pending.length + ') — photograph the signed copy against the move'}>
        {!pending.length ? <Empty text="Nothing pending. Every move has its POD. 🏁" /> :
          pending.map(l => (
            <View key={l.id} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.navy }}>{l.lrNo} · {l.truckNo}</Text>
              <Text style={{ fontSize: 11.5, color: C.mut, marginTop: 2 }}>
                {fmtDate(l.date)} · {l.fromPlace} → {l.toPlace} · {(l.consignee || {}).name || '—'} · {inr(l.gross)}
              </Text>
              <View style={[S.wrapRow, { marginTop: 8 }]}>
                <Btn small tone="amber" label="📷 Camera" onPress={() => capture(l, true)} />
                <Btn small label="🖼 Gallery" onPress={() => capture(l, false)} />
                <Btn small tone="ghost" label="Mark w/o file" onPress={() => markNoFile(l)} />
              </View>
            </View>
          ))}
      </Card>

      <Card title={'POD Received (' + done.length + ')'}>
        {!done.length ? <Empty text="No PODs recorded yet." /> :
          done.slice(0, 40).map(l => (
            <View key={l.id} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8 }}>
              <View style={[S.row, { justifyContent: 'space-between' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.navy }}>{l.lrNo}</Text>
                  <Text style={{ fontSize: 11.5, color: C.mut }}>
                    {fmtDate(l.podDate || l.date)} · {l.podReceiver || '—'} · {l.fromPlace} → {l.toPlace}
                  </Text>
                </View>
                {l.podFileUri ? (
                  <View style={S.wrapRow}>
                    <Image source={{ uri: l.podFileUri }} style={{ width: 46, height: 46, borderRadius: 6, borderWidth: 1, borderColor: C.line2 }} />
                    <Btn small tone="ghost" label="Share" onPress={() => sharePod(l)} />
                  </View>
                ) : (
                  <View style={S.wrapRow}>
                    <Badge text="NO FILE" tone="amber" />
                    <Btn small tone="ghost" label="+ Add" onPress={() => capture(l, false)} />
                  </View>
                )}
              </View>
            </View>
          ))}
      </Card>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
