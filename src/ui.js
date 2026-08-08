import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, StyleSheet, Alert, useWindowDimensions } from 'react-native';
import { fmtDate } from './logic';

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

/* Generic data table matching the HTML build's table.data styling:
   navy header row (white uppercase text) + white body rows with bottom borders.
   cols: [{key,label,width}]  rows: [{ [col.key]: string|number|ReactNode }]
   The HTML's <table> is width:100% — it stretches columns to fill the card and only
   needs overflow-x when the content genuinely doesn't fit. To match that instead of
   always rendering at the sum of the fixed column widths (which left empty space on
   wide screens/desktop web), this measures its own width and scales every column up
   proportionally to fill it; it only falls back to a narrower, horizontally-scrollable
   table when the container is too narrow for the columns even at their original size. */
export function Table({ cols, rows }) {
  const [w, setW] = useState(0);
  const natural = cols.reduce((s, c) => s + c.width, 0);
  const scale = w && natural ? Math.max(1, w / natural) : 1;
  const sCols = scale === 1 ? cols : cols.map(c => ({ ...c, width: c.width * scale }));
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: scale > 1 ? w : undefined }}>
          <View style={{ flexDirection: 'row', backgroundColor: C.navy }}>
            {sCols.map(c => (
              <Text key={c.key} style={{
                width: c.width, paddingVertical: 8, paddingHorizontal: 10, color: '#fff',
                fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4
              }}>{c.label}</Text>
            ))}
          </View>
          {rows.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: '#fff' }}>
              {sCols.map(c => (
                <View key={c.key} style={{ width: c.width, paddingVertical: 8, paddingHorizontal: 10, justifyContent: 'center' }}>
                  {(typeof r[c.key] === 'string' || typeof r[c.key] === 'number')
                    ? <Text style={{ fontSize: 12, color: C.txt }}>{r[c.key]}</Text> : r[c.key]}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/* Shared renewals/compliance table — used by Dashboard's "Upcoming Renewals" and the
   full Renewals & Compliance screen so both render the same badge thresholds identically. */
export function renewalStatus(days) {
  if (days == null) return <Badge text="NO DATE" tone="amber" />;
  if (days < 0) return <Badge text="EXPIRED" tone="red" />;
  if (days <= 7) return <Badge text="URGENT" tone="red" />;
  if (days <= 30) return <Badge text="DUE SOON" tone="amber" />;
  return <Badge text="OK" tone="green" />;
}
export function RenewalsTable({ items }) {
  if (!items.length) return <Empty text="Nothing tracked yet." />;
  return (
    <Table
      cols={[
        { key: 'label', label: 'Document / Item', width: 170 },
        { key: 'detail', label: 'For', width: 150 },
        { key: 'expiry', label: 'Expiry', width: 90 },
        { key: 'days', label: 'Days Left', width: 80 },
        { key: 'status', label: 'Status', width: 100 }
      ]}
      rows={items.map(r => ({
        label: <Text style={{ fontSize: 12, fontWeight: '700', color: C.navy }}>{r.label}</Text>,
        detail: r.detail,
        expiry: fmtDate(r.expiry),
        days: r.days == null ? '—' : String(r.days),
        status: renewalStatus(r.days)
      }))}
    />
  );
}

export function confirmDo(msg, onYes) {
  Alert.alert('Confirm', msg, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Yes', style: 'destructive', onPress: onYes }
  ]);
}

/* ---------- calendar date picker ----------
   Replaces free-typed 'YYYY-MM-DD' text entry everywhere a date field appears.
   value/onChange work in the same 'YYYY-MM-DD' string format used throughout the app
   (fmtDate, daysSince, etc. all expect this), so it drops in wherever a date TextInput was. */
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function isoDate(y, m, d) { return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }

export function DatePicker({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const valid = !!(parsed && !isNaN(parsed.getTime()));
  const now = new Date();
  const [viewY, setViewY] = useState(valid ? parsed.getFullYear() : now.getFullYear());
  const [viewM, setViewM] = useState(valid ? parsed.getMonth() : now.getMonth());

  const openPicker = () => {
    const base = valid ? parsed : new Date();
    setViewY(base.getFullYear()); setViewM(base.getMonth());
    setOpen(true);
  };

  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  const firstWeekday = new Date(viewY, viewM, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const pick = (d) => { onChange(isoDate(viewY, viewM, d)); setOpen(false); };
  const prevMonth = () => { if (viewM === 0) { setViewM(11); setViewY(viewY - 1); } else setViewM(viewM - 1); };
  const nextMonth = () => { if (viewM === 11) { setViewM(0); setViewY(viewY + 1); } else setViewM(viewM + 1); };

  return (
    <View>
      <TouchableOpacity onPress={openPicker} style={{
        borderWidth: 1, borderColor: C.line2, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 9,
        backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <Text style={{ fontSize: 13, color: valid ? C.txt : C.line2 }}>
          {valid ? fmtDate(value) : (placeholder || 'YYYY-MM-DD')}
        </Text>
        <Text style={{ fontSize: 13 }}>📅</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(10,31,56,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <TouchableOpacity accessible={false} activeOpacity={1} onPress={() => setOpen(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 320, padding: 16, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={() => setViewY(viewY - 1)} style={{ padding: 6 }}>
                <Text style={{ fontSize: 13, color: C.navy2, fontWeight: '700' }}>«</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={prevMonth} style={{ padding: 6 }}>
                <Text style={{ fontSize: 16, color: C.navy2, fontWeight: '700' }}>‹</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 13.5, fontWeight: '800', color: C.navy }}>{MONTH_NAMES[viewM]} {viewY}</Text>
              <TouchableOpacity onPress={nextMonth} style={{ padding: 6 }}>
                <Text style={{ fontSize: 16, color: C.navy2, fontWeight: '700' }}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setViewY(viewY + 1)} style={{ padding: 6 }}>
                <Text style={{ fontSize: 13, color: C.navy2, fontWeight: '700' }}>»</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              {WEEKDAYS.map(w => (
                <View key={w} style={{ width: '14.28%', alignItems: 'center', paddingVertical: 4 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: C.mut }}>{w}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cells.map((d, i) => {
                const iso = d ? isoDate(viewY, viewM, d) : null;
                const isSel = !!(iso && value === iso);
                const isToday = iso === todayIso;
                return (
                  <View key={i} style={{ width: '14.28%', aspectRatio: 1, padding: 2 }}>
                    {d ? (
                      <TouchableOpacity onPress={() => pick(d)} style={{
                        flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isSel ? C.navy2 : 'transparent',
                        borderWidth: isToday && !isSel ? 1 : 0, borderColor: C.amber
                      }}>
                        <Text style={{ fontSize: 12.5, color: isSel ? '#fff' : C.txt, fontWeight: isSel ? '700' : '400' }}>{d}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
              <Btn small tone="ghost" label="Clear" onPress={() => { onChange(''); setOpen(false); }} />
              <Btn small tone="ghost" label="Today" onPress={() => { onChange(todayIso); setOpen(false); }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- generic modal form ----------
   form = { title, fields:[{key,label,type:'text'|'number'|'date'|'select'|'multiline',options:[{v,l}],required,hint,value}], onSubmit(values) }
*/
/* Matches the HTML's #modalwrap/#modal: centered card, max-width 640, radius 12,
   padding 22/24, h3 title with amber underline, .frm 2-col field grid (collapsing to
   1 col under 860px per the HTML's own media query), .modalbtns Cancel/Save pair. */
export function ModalForm({ form, onClose }) {
  const [vals, setVals] = useState({});
  const [pickerKey, setPickerKey] = useState(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const { width } = useWindowDimensions();
  const oneCol = width <= 860;
  useEffect(() => {
    if (form) {
      const o = {};
      form.fields.forEach(f => { o[f.key] = f.value != null ? String(f.value) : ''; });
      setVals(o);
      setPickerKey(null);
    }
  }, [form]);
  if (!form) return null;

  const set = (k, v) => setVals(p => ({ ...p, [k]: v }));
  const activeField = pickerKey ? form.fields.find(f => f.key === pickerKey) : null;
  const openPicker = (k) => { setPickerSearch(''); setPickerKey(k); };
  const submit = () => {
    for (const f of form.fields) {
      if (f.required && !String(vals[f.key] || '').trim()) { Alert.alert('Missing field', f.label + ' is required.'); return; }
    }
    const out = { ...vals };
    onClose();
    form.onSubmit(out);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(10,31,56,0.55)', alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16 }}>
        <TouchableOpacity accessible={false} activeOpacity={1} onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 0, width: '100%', maxWidth: 640, maxHeight: '100%', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 }}>
          <View style={{ paddingHorizontal: 24, paddingTop: 22 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.navy, borderBottomWidth: 2, borderBottomColor: C.amber, paddingBottom: 8 }}>
              {form.title}
            </Text>
          </View>
          <ScrollView style={{ paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16 }}>
              {form.fields.map(f => {
                const full = oneCol || f.full || f.type === 'multiline';
                return (
                  <View key={f.key} style={{ width: full ? '100%' : '48%', marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.mut, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>
                      {f.label}{f.required ? ' *' : ''}
                    </Text>
                    {f.type === 'select' ? (
                      (f.options || []).length <= 6 && (f.options || []).every(o => String(o.l).length <= 16) ? (
                        <View style={[S.wrapRow, { borderWidth: 1, borderColor: C.line2, borderRadius: 7, padding: 6, backgroundColor: '#fff' }]}>
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
                        <TouchableOpacity onPress={() => openPicker(f.key)} style={{
                          borderWidth: 1, borderColor: C.line2, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 9,
                          backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                          <Text numberOfLines={1} style={{ fontSize: 13, color: vals[f.key] ? C.txt : C.line2, flex: 1 }}>
                            {(f.options || []).find(o => String(o.v) === String(vals[f.key]))?.l || '— select —'}
                          </Text>
                          <Text style={{ color: C.mut, marginLeft: 6, fontSize: 11 }}>▾</Text>
                        </TouchableOpacity>
                      )
                    ) : f.type === 'date' ? (
                      <DatePicker value={vals[f.key]} onChange={v => set(f.key, v)} />
                    ) : (
                      <TextInput
                        value={vals[f.key] || ''}
                        onChangeText={t => set(f.key, t)}
                        placeholderTextColor={C.line2}
                        keyboardType={f.type === 'number' ? 'numeric' : 'default'}
                        multiline={f.type === 'multiline'}
                        style={{
                          borderWidth: 1, borderColor: C.line2, borderRadius: 7, paddingHorizontal: 10,
                          paddingVertical: 8, fontSize: 13, color: C.txt, backgroundColor: '#fff',
                          minHeight: f.type === 'multiline' ? 60 : undefined
                        }}
                      />
                    )}
                    {f.hint ? <Text style={{ fontSize: 11, color: C.mut, marginTop: 3 }}>{f.hint}</Text> : null}
                  </View>
                );
              })}
            </View>
            <View style={{ height: 4 }} />
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 22 }}>
            <Btn label="Cancel" tone="ghost" onPress={onClose} />
            <Btn label={form.submitLabel || 'Save'} tone="amber" onPress={submit} />
          </View>
        </View>
      </View>

      {/* Dropdown picker for long select lists (clients, vehicles, drivers, vendors…) —
          opens as its own overlay instead of inline pills so it can't blow out the form's layout. */}
      <Modal visible={!!activeField} transparent animationType="fade" onRequestClose={() => setPickerKey(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(10,31,56,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <TouchableOpacity accessible={false} activeOpacity={1} onPress={() => setPickerKey(null)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, maxHeight: '70%', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 }}>
            <View style={{ padding: 16, borderBottomWidth: 2, borderBottomColor: C.amber }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.navy }}>{activeField ? activeField.label : ''}</Text>
            </View>
            <View style={{ padding: 12, paddingBottom: 6 }}>
              <TextInput
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search…"
                placeholderTextColor={C.line2}
                autoFocus
                style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: C.txt, backgroundColor: '#fff' }}
              />
            </View>
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {!activeField || !(activeField.required && activeField.blank === false) ? (
                <TouchableOpacity onPress={() => { set(activeField.key, ''); setPickerKey(null); }} style={{ paddingVertical: 11, paddingHorizontal: 16 }}>
                  <Text style={{ fontSize: 13.5, color: C.mut, fontStyle: 'italic' }}>— select —</Text>
                </TouchableOpacity>
              ) : null}
              {activeField ? (activeField.options || [])
                .filter(o => String(o.l).toLowerCase().includes(pickerSearch.toLowerCase()))
                .map(o => {
                  const selected = String(vals[activeField.key]) === String(o.v);
                  return (
                    <TouchableOpacity key={String(o.v)} onPress={() => { set(activeField.key, String(o.v)); setPickerKey(null); }}
                      style={{ paddingVertical: 11, paddingHorizontal: 16, backgroundColor: selected ? C.line : '#fff' }}>
                      <Text style={{ fontSize: 13.5, color: selected ? C.navy : C.txt, fontWeight: selected ? '700' : '400' }}>{o.l}</Text>
                    </TouchableOpacity>
                  );
                }) : null}
              {activeField && !(activeField.options || []).some(o => String(o.l).toLowerCase().includes(pickerSearch.toLowerCase())) ? (
                <Text style={{ padding: 16, fontSize: 12.5, color: C.mut, textAlign: 'center' }}>No matches.</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}
