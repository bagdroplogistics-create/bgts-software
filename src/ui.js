import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, StyleSheet, Alert } from 'react-native';

export const C = {
  navy: '#0a1f38', navy2: '#153a66', navy3: '#1d4d84',
  amber: '#e8a33d', amberD: '#cf8c28',
  bg: '#f6f8fa', line: '#eef1f5', line2: '#c7d0dc',
  mut: '#6b7a8f', txt: '#33455c',
  green: '#1e8a5f', red: '#c14343', purple: '#7a5ea8', teal: '#2596a5', wa: '#25d366'
};

export const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 14, paddingBottom: 60 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.navy, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  h1: { fontSize: 16, fontWeight: '800', color: C.navy },
  sub: { fontSize: 11, color: C.mut },
  bold: { fontWeight: '700', color: C.navy },
  empty: { padding: 20, textAlign: 'center', color: C.mut, fontSize: 13 }
});

/* BGTS logo mark — pure Views/Text, no SVG dependency */
export function Logo({ size }) {
  const s = size || 44;
  return (
    <View style={{
      width: s, height: s, borderRadius: s * 0.22, backgroundColor: C.navy,
      borderWidth: 1.5, borderColor: C.amber, alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
    }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: s * 0.26, letterSpacing: 1 }}>BGTS</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: s * 0.04 }}>
        <View style={{ width: s * 0.30, height: s * 0.14, backgroundColor: C.amber, borderRadius: 2 }} />
        <View style={{ width: s * 0.14, height: s * 0.10, backgroundColor: C.amber, borderRadius: 2, marginLeft: 1 }} />
      </View>
      <View style={{ position: 'absolute', bottom: s * 0.08, width: s * 0.7, height: 2, backgroundColor: C.amber, borderRadius: 1 }} />
    </View>
  );
}

export function Card({ title, right, children }) {
  return (
    <View style={S.card}>
      {(title || right) ? (
        <View style={[S.row, { marginBottom: 10, justifyContent: 'space-between' }]}>
          {title ? <Text style={{ fontSize: 15, fontWeight: '700', color: C.navy, flex: 1 }}>{title}</Text> : <View style={{ flex: 1 }} />}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Kpi({ label, value, sub, tone }) {
  const top = tone === 'red' ? C.red : tone === 'amber' ? C.amber : tone === 'green' ? C.green : C.navy3;
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.line, borderTopWidth: 3, borderTopColor: top, width: '48.5%', marginBottom: 10 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: C.mut, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontSize: 19, fontWeight: '800', color: C.navy, marginTop: 3 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 10, color: C.mut, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

const BADGE_TONES = {
  navy: { bg: '#e8edf7', fg: C.navy3 }, green: { bg: '#e7f3ea', fg: C.green },
  red: { bg: '#fbe9e9', fg: C.red }, amber: { bg: '#fdf1de', fg: C.amberD },
  purple: { bg: '#f3eefb', fg: C.purple }, teal: { bg: '#e2f2f4', fg: C.teal }
};
export function Badge({ text, tone }) {
  const t = BADGE_TONES[tone] || BADGE_TONES.navy;
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 9.5, fontWeight: '800', color: t.fg, textTransform: 'uppercase', letterSpacing: 0.4 }}>{text}</Text>
    </View>
  );
}
export function statusTone(st) {
  return { 'Booked': 'purple', 'Vehicle Assigned': 'amber', 'In Transit': 'teal', 'Delivered': 'green', 'Invoiced': 'navy', 'Paid': 'green' }[st] || 'navy';
}

export function Btn({ label, onPress, tone, small, style }) {
  const bg = tone === 'amber' ? C.amber : tone === 'red' ? C.red : tone === 'green' ? C.green : tone === 'wa' ? C.wa : tone === 'ghost' ? 'transparent' : C.navy2;
  const fg = tone === 'amber' ? C.navy : tone === 'ghost' ? C.navy2 : '#fff';
  return (
    <TouchableOpacity onPress={onPress} style={[{
      backgroundColor: bg, borderRadius: 7,
      paddingHorizontal: small ? 9 : 14, paddingVertical: small ? 5 : 9,
      borderWidth: tone === 'ghost' ? 1 : 0, borderColor: C.line2, alignSelf: 'flex-start'
    }, style]}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 11 : 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function KV({ k, v }) {
  return (
    <View style={[S.row, { marginBottom: 2 }]}>
      <Text style={{ fontSize: 11.5, color: C.mut, width: 110 }}>{k}</Text>
      <Text style={{ fontSize: 12, color: C.txt, flex: 1, fontWeight: '600' }}>{v}</Text>
    </View>
  );
}

export function Empty({ text }) { return <Text style={S.empty}>{text}</Text>; }

export function confirmDo(msg, onYes) {
  Alert.alert('Confirm', msg, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Yes', style: 'destructive', onPress: onYes }
  ]);
}

/* ---------- generic modal form ----------
   form = { title, fields:[{key,label,type:'text'|'number'|'date'|'select'|'multiline',options:[{v,l}],required,hint,value}], onSubmit(values) }
*/
export function ModalForm({ form, onClose }) {
  const [vals, setVals] = useState({});
  useEffect(() => {
    if (form) {
      const o = {};
      form.fields.forEach(f => { o[f.key] = f.value != null ? String(f.value) : ''; });
      setVals(o);
    }
  }, [form]);
  if (!form) return null;

  const set = (k, v) => setVals(p => ({ ...p, [k]: v }));
  const submit = () => {
    for (const f of form.fields) {
      if (f.required && !String(vals[f.key] || '').trim()) { Alert.alert('Missing field', f.label + ' is required.'); return; }
    }
    const out = { ...vals };
    onClose();
    form.onSubmit(out);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(10,31,56,0.55)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '88%' }}>
          <View style={{ padding: 16, borderBottomWidth: 2, borderBottomColor: C.amber }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.navy }}>{form.title}</Text>
          </View>
          <ScrollView style={{ paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
            {form.fields.map(f => (
              <View key={f.key} style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginBottom: 5 }}>
                  {f.label}{f.required ? ' *' : ''}
                </Text>
                {f.type === 'select' ? (
                  <View style={S.wrapRow}>
                    {(f.options || []).map(o => (
                      <TouchableOpacity key={String(o.v)} onPress={() => set(f.key, String(o.v))} style={{
                        backgroundColor: String(vals[f.key]) === String(o.v) ? C.navy2 : '#fff',
                        borderWidth: 1, borderColor: String(vals[f.key]) === String(o.v) ? C.navy2 : C.line2,
                        borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 4
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: String(vals[f.key]) === String(o.v) ? '#fff' : C.txt }}>{o.l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    value={vals[f.key] || ''}
                    onChangeText={t => set(f.key, t)}
                    placeholder={f.type === 'date' ? 'YYYY-MM-DD' : ''}
                    placeholderTextColor={C.line2}
                    keyboardType={f.type === 'number' ? 'numeric' : 'default'}
                    multiline={f.type === 'multiline'}
                    style={{
                      borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 10,
                      paddingVertical: 8, fontSize: 13.5, color: C.txt, backgroundColor: '#fff',
                      minHeight: f.type === 'multiline' ? 60 : undefined
                    }}
                  />
                )}
                {f.hint ? <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 3 }}>{f.hint}</Text> : null}
              </View>
            ))}
            <View style={{ height: 16 }} />
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: C.line }}>
            <Btn label="Cancel" tone="ghost" onPress={onClose} />
            <Btn label={form.submitLabel || 'Save'} tone="amber" onPress={submit} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
