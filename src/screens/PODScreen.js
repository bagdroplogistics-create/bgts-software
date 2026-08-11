import React, { useState } from 'react';
import { View, Text, ScrollView, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, Table, alert } from '../ui';
import { inr, fmtDate, todayISO, byId } from '../logic';
import { shareFile } from '../fileIO';

export default function PODScreen() {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);

  const pending = db.lrs.filter(l => !l.pod).slice().reverse();
  const done = db.lrs.filter(l => l.pod).slice().reverse();

  const capture = async (lr, fromCamera) => {
    try {
      let res;
      if (fromCamera) {
        if (Platform.OS !== 'web') {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { alert('Camera permission needed', 'Allow camera access to photograph the signed POD.'); return; }
        }
        res = await ImagePicker.launchCameraAsync({ quality: 0.5, allowsEditing: false });
      } else {
        res = await ImagePicker.launchImageLibraryAsync({ quality: 0.5, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      }
      if (res.canceled || !res.assets || !res.assets.length) return;
      const asset = res.assets[0];
      /* FileSystem.documentDirectory/copyAsync are native-only (documentDirectory is null
         on web) — on web the picker's own uri (a blob: URL) is already directly usable in
         <Image>/for download, so just keep it as-is instead of copying it anywhere. Note
         this means a web-captured POD photo only survives for the current browser session
         (it isn't written to disk), unlike the native build which copies it into permanent
         app storage — a real limitation of the browser sandbox, not a bug to "fix" further. */
      const dest = Platform.OS === 'web' ? asset.uri : FileSystem.documentDirectory + 'pod_' + lr.id + '.jpg';
      if (Platform.OS !== 'web') await FileSystem.copyAsync({ from: asset.uri, to: dest });
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
    } catch (e) { alert('Error', String(e.message || e)); }
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
      await shareFile(lr.podFileUri, 'POD_' + lr.lrNo + '.jpg', 'image/jpeg');
    } catch (e) { alert('Error', String(e.message || e)); }
  };

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <Card title={'Pending POD (' + pending.length + ') — photograph the signed copy against the move'}>
        {!pending.length ? <Empty text="Nothing pending. Every move has its POD. 🏁" /> : (
          <Table
            cols={[
              { key: 'lrNo', label: 'LR No', width: 100 },
              { key: 'date', label: 'Date', width: 80 },
              { key: 'truck', label: 'Truck', width: 90 },
              { key: 'route', label: 'Route', width: 150 },
              { key: 'consignee', label: 'Consignee', width: 140 },
              { key: 'gross', label: 'Gross', width: 90 },
              { key: 'actions', label: 'Actions', width: 260 }
            ]}
            rows={pending.map(l => ({
              lrNo: <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{l.lrNo}</Text>,
              date: fmtDate(l.date),
              truck: l.truckNo,
              route: l.fromPlace + ' → ' + l.toPlace,
              consignee: (l.consignee || {}).name || '—',
              gross: inr(l.gross),
              actions: (
                <View style={S.wrapRow}>
                  <Btn small tone="amber" label="📷 Camera" onPress={() => capture(l, true)} />
                  <Btn small label="🖼 Gallery" onPress={() => capture(l, false)} />
                  <Btn small tone="ghost" label="Mark w/o file" onPress={() => markNoFile(l)} />
                </View>
              )
            }))}
          />
        )}
      </Card>

      <Card title={'POD Received (' + done.length + ')'}>
        {!done.length ? <Empty text="No PODs recorded yet." /> : (
          <Table
            cols={[
              { key: 'lrNo', label: 'LR No', width: 100 },
              { key: 'podDate', label: 'POD Date', width: 90 },
              { key: 'receiver', label: 'Receiver', width: 130 },
              { key: 'route', label: 'Route', width: 150 },
              { key: 'file', label: 'File', width: 60 },
              { key: 'actions', label: '', width: 100 }
            ]}
            rows={done.slice(0, 40).map(l => ({
              lrNo: <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{l.lrNo}</Text>,
              podDate: fmtDate(l.podDate || l.date),
              receiver: l.podReceiver || '—',
              route: l.fromPlace + ' → ' + l.toPlace,
              file: l.podFileUri
                ? <Image source={{ uri: l.podFileUri }} style={{ width: 40, height: 40, borderRadius: 6, borderWidth: 1, borderColor: C.line2 }} />
                : <Badge text="NO FILE" tone="amber" />,
              actions: l.podFileUri
                ? <Btn small tone="ghost" label="Share" onPress={() => sharePod(l)} />
                : <Btn small tone="ghost" label="+ Add" onPress={() => capture(l, false)} />
            }))}
          />
        )}
      </Card>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
