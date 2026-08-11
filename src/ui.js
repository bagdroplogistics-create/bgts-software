import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, StyleSheet, useWindowDimensions, Image } from 'react-native';
import { fmtDate } from './logic';

/* BGTS brand palette — sampled directly from the official logo artwork
   (assets/bgts-logo.png): charcoal wordmark #606060, and the paper-plane
   gradient #f6d048 (yellow) -> #e27438 (orange) -> #c4322d (red). The primary
   accent (C.amber/C.amberD) is keyed to the logo's YELLOW, not the orange —
   every key below keeps its OLD name (navy/amber/etc.) even though the value
   is yellow, that's deliberate, so every screen that already references
   C.navy or C.amber picks up the brand accent automatically without needing
   to be touched individually. Functional status colors (green/purple/teal/wa)
   are left as-is since they carry meaning (paid, WhatsApp, etc.), not brand
   identity. */
export const C = {
  navy: '#2b2b2f', navy2: '#3d3d42', navy3: '#4d4d54',
  amber: '#f6d048', amberD: '#ac9232',
  bg: '#f7f7f7', line: '#ececed', line2: '#d4d4d8',
  mut: '#71717a', txt: '#302f33',
  yellow: '#f6d048',
  green: '#1e8a5f', red: '#c4322d', purple: '#7a5ea8', teal: '#2596a5', wa: '#25d366'
};

/* Actual source-image aspect ratio (width/height) of assets/bgts-logo.png —
   used so <Logo/> can be sized by height alone and scale correctly without
   ever stretching or cropping the artwork. */
const LOGO_ASPECT = 1629 / 978;

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

/* Official BGTS logo — the real artwork (assets/bgts-logo.png), never redrawn.
   `size` is treated as the rendered HEIGHT; width follows automatically via
   LOGO_ASPECT so the mark is never stretched or distorted, and resizeMode
   "contain" guarantees it's never cropped either. Callers that need it to sit
   in a fixed-width slot (e.g. a collapsed sidebar rail) should pass a smaller
   `size` rather than trying to force a width. */
export function Logo({ size }) {
  const h = size || 44;
  /* Explicit width (derived from LOGO_ASPECT) instead of relying on the
     `aspectRatio` style alone — on the deployed web build, Image with only
     `height` + `aspectRatio` was failing to compute a width at all and
     falling back to the source PNG's raw pixel width (800px), which then
     blew out the whole sidebar header's height. Computing width ourselves
     sidesteps that entirely and is equally safe against stretching/cropping
     since both dimensions are still derived from the same real aspect ratio. */
  const w = Math.round(h * LOGO_ASPECT);
  return (
    <Image
      source={require('../assets/bgts-logo.png')}
      resizeMode="contain"
      style={{ height: h, width: w }}
      accessibilityLabel="BGTS — Baroda Goods Transport Service"
    />
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

/* The HTML build lays KPI cards out with CSS grid — repeat(auto-fit, minmax(170px,1fr)) —
   so the row always fills the full card width: 2 cards on a phone, 4-6 on a wide desktop
   monitor. Kpi previously hard-coded width:'48.5%' (always exactly 2 per row), which on a
   wide desktop screen left the KPI row (and everything below it) looking like it was only
   using half the available width. This mirrors the HTML's auto-fit behavior by picking a
   column count from the current window width, so wide screens actually spread KPIs across
   3-5 columns instead of leaving that space empty. */
export function Kpi({ label, value, sub, tone }) {
  const { width } = useWindowDimensions();
  const cols = width >= 1700 ? 5 : width >= 1300 ? 4 : width >= 900 ? 3 : 2;
  const top = tone === 'red' ? C.red : tone === 'amber' ? C.amber : tone === 'green' ? C.green : C.navy3;
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.line, borderTopWidth: 3, borderTopColor: top, width: (100 / cols - 1.5) + '%', marginBottom: 10 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: C.mut, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontSize: 19, fontWeight: '800', color: C.navy, marginTop: 3 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 10, color: C.mut, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

const BADGE_TONES = {
  navy: { bg: '#ececed', fg: C.navy3 }, green: { bg: '#e7f3ea', fg: C.green },
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
   needs overflow-x when the content genuinely doesn't fit.
   A previous version measured its own width via onLayout + setState and multiplied
   every column's px width by a computed scale factor. In practice that JS-measured
   value was unreliable across nested ScrollViews/Cards on web (stale/zero width on
   first paint, no re-measure on window resize) and regularly rendered at the raw
   fixed widths, leaving a large dead gap to the right of the table on wide screens.
   This version drops JS measurement entirely and lets CSS flexbox do the stretching:
   each column gets `flexGrow: width` (so columns still share space in the same ratio
   as their original design widths) with `flexBasis: 0` and `minWidth: width` (so no
   column is ever squeezed below its usable size). The row lives inside a horizontal
   ScrollView whose content wrapper is `minWidth: '100%'` — that percentage resolves
   against the ScrollView's own rendered width (not the row's natural content width),
   so on a wide container the columns grow to fill every last pixel, and on a narrow
   one (natural sum > container) the row simply overflows into the horizontal scroll
   instead of squashing. Text cells get numberOfLines={1} so long values (client
   names, narrations, addresses) stay on a single line and ellipsize instead of
   wrapping and inflating row height.
   A row may also be a detail/expansion row instead of a normal data row: pass
   `{ _span: <ReactNode> }` and it renders as one full-width cell (no per-column
   split) — this is how "Lines"/"Hide"-style accordion rows (e.g. the Invoice
   Backup register's per-bill LR breakdown) get inserted right under the row that
   was clicked, matching the HTML build's `<td colspan="N">` sub-table pattern,
   instead of being rendered as a separate table after the whole list.
   IMPORTANT — why this isn't just a manually-wrapped `<View minWidth:'100%'>` inside
   the ScrollView: react-native-web's ScrollView renders TWO nested divs — the
   scrollable div itself (which gets our `style` prop) and an inner content-wrapper
   div around its children. That inner wrapper div has NO width of its own by
   default, so a plain child `minWidth:'100%'` resolves against an *indefinite*
   parent width and is silently dropped by the browser (percentages need a definite
   containing block) — the whole table then collapses to its natural minimum width,
   which is exactly the "narrow columns + dead space" bug this component exists to
   prevent. Confirmed by inspecting react-native-web's actual rendered output/CSS,
   not just reasoning about it. The fix is `contentContainerStyle`, which is the prop
   ScrollView uses specifically to style that inner wrapper div — giving IT an
   explicit `width:'100%'` (resolved against the outer scrollable div, which does
   have a definite width from our own `style` prop) makes the whole chain definite,
   so the row's flexGrow columns can actually compute against a real container
   width instead of an undefined one. */
export function Table({ cols, rows }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={{ width: '100%', flexDirection: 'column' }}>
      <View style={{ flexDirection: 'row', backgroundColor: C.navy }}>
        {cols.map(c => (
          <Text key={c.key} numberOfLines={1} style={{
            flexGrow: c.width, flexShrink: 0, flexBasis: 0, minWidth: c.width,
            paddingVertical: 8, paddingHorizontal: 10, color: '#fff',
            fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4
          }}>{c.label}</Text>
        ))}
      </View>
      {rows.map((r, i) => (
        r && r._span !== undefined ? (
          <View key={i} style={{ borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.bg }}>
            {r._span}
          </View>
        ) : (
          <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: '#fff' }}>
            {cols.map(c => (
              <View key={c.key} style={{ flexGrow: c.width, flexShrink: 0, flexBasis: 0, minWidth: c.width, paddingVertical: 8, paddingHorizontal: 10, justifyContent: 'center' }}>
                {(typeof r[c.key] === 'string' || typeof r[c.key] === 'number')
                  ? <Text numberOfLines={1} style={{ fontSize: 12, color: C.txt }}>{r[c.key]}</Text> : r[c.key]}
              </View>
            ))}
          </View>
        )
      ))}
    </ScrollView>
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

/* ---------- cross-platform Alert replacement ----------
   react-native-web's Alert.alert (the version this app is built against) is a complete
   no-op on web: no window.alert, no console.warn, no callback ever fires. Every error/
   success message AND every confirm(Cancel/Yes) dialog in this app was built on RN's
   Alert.alert, so on the web build every one of those looked like "the button does
   nothing" — worse, confirmDo's "Yes" callback never fired, so deletes/wipes/restores
   could never actually complete on web even though the app appeared to run fine.
   This Modal-based replacement behaves identically on native and web. Wired in once
   as <AlertHost/> at the app root (App.js); alert()/confirmDo() work from anywhere. */
let _showAlert = null;
export function alert(title, message, buttons) {
  const list = (buttons && buttons.length) ? buttons : [{ text: 'OK' }];
  if (_showAlert) _showAlert({ title, message, buttons: list });
}
export function AlertHost() {
  const [state, setState] = useState(null);
  useEffect(() => { _showAlert = (s) => setState(s); return () => { _showAlert = null; }; }, []);
  if (!state) return null;
  const close = () => setState(null);
  const press = (b) => { close(); if (b.onPress) b.onPress(); };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(10,31,56,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 380, padding: 20, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 }}>
          {state.title ? <Text style={{ fontSize: 15.5, fontWeight: '800', color: C.navy, marginBottom: 8 }}>{state.title}</Text> : null}
          {state.message ? <Text style={{ fontSize: 13, color: C.txt, lineHeight: 19 }}>{state.message}</Text> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            {state.buttons.map((b, i) => (
              <TouchableOpacity key={i} onPress={() => press(b)} style={{
                paddingHorizontal: 14, paddingVertical: 9, borderRadius: 7,
                backgroundColor: b.style === 'destructive' ? C.red : b.style === 'cancel' ? 'transparent' : C.navy2,
                borderWidth: b.style === 'cancel' ? 1 : 0, borderColor: C.line2
              }}>
                <Text style={{ color: b.style === 'cancel' ? C.navy2 : '#fff', fontWeight: '700', fontSize: 13 }}>{b.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- reusable searchable dropdown picker ----------
   Same box-that-opens-a-searchable-modal-list pattern already used inside ModalForm for
   long select fields, pulled out standalone so any screen can drop in a full "pick one
   from N options" control instead of a handful of truncated inline chips (chips silently
   stop scaling once there are more than a few real records — e.g. an 11-client master). */
export function PickerField({ value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const opts = options || [];
  const selected = opts.find(o => String(o.v) === String(value));
  const filtered = opts.filter(o => String(o.l).toLowerCase().includes(q.toLowerCase()));
  return (
    <View>
      <TouchableOpacity onPress={() => { setQ(''); setOpen(true); }} style={{
        borderWidth: 1, borderColor: C.line2, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 9,
        backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <Text numberOfLines={1} style={{ fontSize: 13, color: selected ? C.txt : C.line2, flex: 1 }}>
          {selected ? selected.l : (placeholder || '— select —')}
        </Text>
        <Text style={{ color: C.mut, marginLeft: 6, fontSize: 11 }}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(10,31,56,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <TouchableOpacity accessible={false} activeOpacity={1} onPress={() => setOpen(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, maxHeight: '70%', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 }}>
            <View style={{ padding: 12, paddingBottom: 6 }}>
              <TextInput value={q} onChangeText={setQ} placeholder="Search…" placeholderTextColor={C.line2} autoFocus
                style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: C.txt, backgroundColor: '#fff' }} />
            </View>
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {filtered.map(o => (
                <TouchableOpacity key={String(o.v)} onPress={() => { onChange(o.v); setOpen(false); }}
                  style={{ paddingVertical: 11, paddingHorizontal: 16 }}>
                  <Text style={{ fontSize: 13.5, color: C.txt }}>{o.l}</Text>
                </TouchableOpacity>
              ))}
              {!filtered.length ? <Text style={{ padding: 16, fontSize: 12.5, color: C.mut, textAlign: 'center' }}>No matches.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function confirmDo(msg, onYes) {
  alert('Confirm', msg, [
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
      if (f.required && !String(vals[f.key] || '').trim()) { alert('Missing field', f.label + ' is required.'); return; }
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
