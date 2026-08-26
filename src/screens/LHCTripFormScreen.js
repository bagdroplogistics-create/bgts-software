import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Modal } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Btn, DatePicker, PickerField, alert } from '../ui';
import {
  uid, inr, fmtDate, byId,
  blankLhcTrip, blankLhcTripLine, blankLhcExpense, lhcTripLineFromLR, computeLhcTrip,
  LHC_AGENTS, LHC_PAYMENT_OPTIONS
} from '../logic';

/* This is a NEW, independent screen for the NEW LHC (Lorry Hire Contract)
   module — mirrors ATTrans's own "ADD NEW LHC" form. It does not touch
   LRScreen.js/LRFormScreen.js, and never writes to db.lrs (only reads db.lrs
   to let an LR line be filled from an existing LR, same as Bill's LR
   lookup). It also does not touch db.lhcs / LHCScreen.js — the older,
   simpler LHC form that predates this one and isn't in the sidebar nav.
   Its own storage is db.lhcTrips. */

/* ---- small local form primitives (same pattern as BillFormScreen.js) ---- */
function Grid({ children, min, max }) {
  const [w, setW] = useState(0);
  const kids = React.Children.toArray(children).filter(Boolean);
  const capacity = w ? Math.max(1, Math.floor(w / (min || 190))) : 1;
  const cols = Math.max(1, Math.min(max || 4, capacity, kids.length || 1));
  const gap = 10;
  const colW = w && cols > 1 ? (w - gap * (cols - 1)) / cols : (w ? w : '100%');
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {kids.map((child, i) => <View key={i} style={{ width: colW }}>{child}</View>)}
    </View>
  );
}
function NumBox({ value, onChangeText, style }) {
  const strVal = value == null ? '' : String(value);
  const step = (dir) => { const cur = Number(strVal) || 0; onChangeText(String(Math.round((cur + dir) * 100) / 100)); };
  return (
    <View style={{ position: 'relative', justifyContent: 'center' }}>
      <TextInput value={strVal} onChangeText={t => onChangeText(t.replace(/[^0-9.\-]/g, ''))} keyboardType="numeric"
        placeholderTextColor={C.line2} style={[style, { paddingRight: 22 }]} />
      <View style={{ position: 'absolute', right: 1, top: 1, bottom: 1, width: 20, borderLeftWidth: 1, borderLeftColor: C.line2, justifyContent: 'center' }}>
        <TouchableOpacity onPress={() => step(1)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 8, lineHeight: 8, color: C.mut }}>▲</Text></TouchableOpacity>
        <View style={{ height: 1, backgroundColor: C.line2 }} />
        <TouchableOpacity onPress={() => step(-1)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 8, lineHeight: 8, color: C.mut }}>▼</Text></TouchableOpacity>
      </View>
    </View>
  );
}
function Fld({ l, v, set, num, multi, date }) {
  const boxStyle = { borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, fontSize: 13, color: C.txt, backgroundColor: '#fff', minHeight: multi ? 56 : undefined, width: '100%' };
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginBottom: 4 }}>{l}</Text>
      {date ? <DatePicker value={v == null ? '' : String(v)} onChange={set} />
        : num ? <NumBox value={v} onChangeText={set} style={boxStyle} />
        : <TextInput value={v == null ? '' : String(v)} onChangeText={set} multiline={!!multi} placeholderTextColor={C.line2} style={boxStyle} />}
    </View>
  );
}
function ComputedFld({ l, v }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginBottom: 4 }}>{l}</Text>
      <View style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: C.bg }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.navy }}>{inr(v)}</Text>
      </View>
    </View>
  );
}

/* Searchable LR No field — same mechanism as BillFormScreen's LrNoField.
   Picking a suggestion fills content/pkgs/weight from that LR (one-time
   copy, never a live link). */
function LrNoField({ value, db, onChangeText, onPick }) {
  const [open, setOpen] = useState(false);
  const list = db.lrs || [];
  const q = String(value || '').toUpperCase();
  const suggestions = useMemo(() => (
    q.length >= 2 ? list.filter(lr => String(lr.lrNo || '').toUpperCase().indexOf(q) >= 0).slice(0, 15) : []
  ), [list, q]);
  const boxStyle = { borderWidth: 1, borderColor: C.line2, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 7, fontSize: 12, color: C.txt, backgroundColor: '#fff', width: '100%' };
  return (
    <View>
      <TextInput
        value={value == null ? '' : String(value)}
        onChangeText={t => { onChangeText(t); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search by LR No" placeholderTextColor={C.line2}
        style={boxStyle}
      />
      <Modal visible={open && suggestions.length > 0} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(10,31,56,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <TouchableOpacity accessible={false} activeOpacity={1} onPress={() => setOpen(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 380, maxHeight: '65%', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 }}>
            <View style={{ padding: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: C.navy }}>Matching LRs — tap to fill this row</Text>
            </View>
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {suggestions.map(lr => (
                <TouchableOpacity key={lr.id} onPress={() => { onPick(lr); setOpen(false); }} style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.navy }}>{lr.lrNo}</Text>
                  <Text style={{ fontSize: 11, color: C.mut }}>{fmtDate(lr.date)} · {lr.fromPlace} → {lr.toPlace}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* One row of the LR / Consignment table — # / LR No / Date / Content / Pkgs
   / Weight, plus a remove button. Same pure-CSS flex-fill technique as
   BillFormScreen's BillLineRow (header + row share identical flexGrow
   ratios across ALL columns, including the trailing action column, so
   labels stay aligned to their field below at any screen width). */
function LhcLineRow({ l, i, db, onChange, onRemove, canRemove }) {
  const cell = { borderWidth: 1, borderColor: C.line2, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 7, fontSize: 12, color: C.txt, backgroundColor: '#fff', width: '100%' };
  const set = (k) => (t) => onChange(i, k, t);
  const col = (w, child) => <View style={{ flexGrow: w, flexShrink: 0, flexBasis: 0, minWidth: w, marginRight: 6 }}>{child}</View>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line, width: '100%' }}>
      {col(26, <Text style={{ fontSize: 12, color: C.mut, textAlign: 'center', paddingTop: 8 }}>{i + 1}</Text>)}
      {col(150, <LrNoField value={l.lrNo} db={db} onChangeText={set('lrNo')} onPick={(lr) => onChange(i, '__lr', lr)} />)}
      {col(130, <DatePicker value={l.date} onChange={set('date')} placeholder="dd-mm-yyyy" />)}
      {col(260, <TextInput value={l.content} onChangeText={set('content')} placeholder="Content" placeholderTextColor={C.line2} style={cell} />)}
      {col(90, <TextInput value={String(l.pkgs == null ? '' : l.pkgs)} onChangeText={t => set('pkgs')(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="Pkgs" placeholderTextColor={C.line2} style={cell} />)}
      {col(100, <TextInput value={String(l.weight == null ? '' : l.weight)} onChangeText={t => set('weight')(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="Weight" placeholderTextColor={C.line2} style={cell} />)}
      {col(40, <View style={{ paddingTop: 4 }}>{canRemove ? <Btn small tone="red" label="✕" onPress={onRemove} /> : null}</View>)}
    </View>
  );
}

/* One Payment Detail row — a "SELECT AN OPTION" dropdown + amount, used for
   both the additions column (under Lorry Hire) and the deductions column
   (under Advance). Same pattern as BillFormScreen's PayRow, parameterized
   with LHC_PAYMENT_OPTIONS (flagged assumption — see logic.js's comment on
   LHC_PAYMENT_OPTIONS: ATTrans's real dropdown list for this form wasn't
   visible in the screenshot). */
function PayRow({ row, onType, onAmount, onRemove }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
      <View style={{ flex: 1.3 }}>
        <PickerField value={row.type} onChange={onType} placeholder="SELECT AN OPTION" options={LHC_PAYMENT_OPTIONS.map(x => ({ v: x, l: x }))} />
      </View>
      <View style={{ flex: 1 }}>
        <TextInput value={String(row.amount == null ? '' : row.amount)} onChangeText={t => onAmount(t.replace(/[^0-9.\-]/g, ''))} keyboardType="numeric"
          placeholder="Amount" placeholderTextColor={C.line2}
          style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 8, fontSize: 13, color: C.txt, backgroundColor: '#fff' }} />
      </View>
      <Btn small tone="red" label="✕" onPress={onRemove} />
    </View>
  );
}

/* One Expense row — Account Name (free text) + Amount. ATTrans's screenshot
   shows a plain text box here, not a dropdown, so Account Name is kept free
   text rather than force-linked to Masters -> Account (which could be a
   reasonable follow-up if wanted). */
function ExpenseRow({ row, onAccount, onAmount, onRemove, canRemove }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
      <View style={{ flex: 2 }}>
        <TextInput value={row.account} onChangeText={onAccount} placeholder="Account Name" placeholderTextColor={C.line2}
          style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 8, fontSize: 13, color: C.txt, backgroundColor: '#fff' }} />
      </View>
      <View style={{ flex: 1 }}>
        <TextInput value={String(row.amount == null ? '' : row.amount)} onChangeText={t => onAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric"
          placeholder="Amount" placeholderTextColor={C.line2}
          style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 8, fontSize: 13, color: C.txt, backgroundColor: '#fff' }} />
      </View>
      {canRemove ? <Btn small tone="red" label="✕" onPress={onRemove} /> : null}
    </View>
  );
}

export default function LHCTripFormScreen({ navigation, route }) {
  const { db, update } = useStore();
  const params = (route && route.params) || {};
  const editing = params.lhcTripId ? byId(db.lhcTrips || [], params.lhcTripId) : null;

  const [f, setF] = useState(() => {
    if (editing) return JSON.parse(JSON.stringify(editing));
    const t = blankLhcTrip();
    t.expenses = [blankLhcExpense()];
    return t;
  });

  const totals = useMemo(() => computeLhcTrip(f), [f]);

  const setLine = (i, k, v) => {
    if (k === '__lr') {
      const filled = lhcTripLineFromLR(v);
      setF(p => { const lines = p.lines.slice(); lines[i] = { ...lines[i], ...filled }; return { ...p, lines }; });
      return;
    }
    setF(p => { const lines = p.lines.slice(); lines[i] = { ...lines[i], [k]: v }; return { ...p, lines }; });
  };
  const addLine = () => setF(p => ({ ...p, lines: [...p.lines, blankLhcTripLine()] }));
  const removeLine = (i) => setF(p => ({ ...p, lines: p.lines.filter((_, j) => j !== i) }));

  const setPay = (kind, i, k, v) => setF(p => { const arr = (p[kind] || []).slice(); arr[i] = { ...arr[i], [k]: v }; return { ...p, [kind]: arr }; });
  const addPay = (kind) => setF(p => ({ ...p, [kind]: [...(p[kind] || []), { id: uid('lp'), type: '', amount: '' }] }));
  const removePay = (kind, i) => setF(p => ({ ...p, [kind]: p[kind].filter((_, j) => j !== i) }));

  const setExpense = (i, k, v) => setF(p => { const arr = p.expenses.slice(); arr[i] = { ...arr[i], [k]: v }; return { ...p, expenses: arr }; });
  const addExpense = () => setF(p => ({ ...p, expenses: [...(p.expenses || []), blankLhcExpense()] }));
  const removeExpense = (i) => setF(p => ({ ...p, expenses: p.expenses.filter((_, j) => j !== i) }));

  const pkgsTotal = (f.lines || []).reduce((s2, l) => s2 + (Number(l.pkgs) || 0), 0);
  const weightTotal = (f.lines || []).reduce((s2, l) => s2 + (Number(l.weight) || 0), 0);

  const save = () => {
    const req = [[f.lhcNo, 'LHC No'], [f.date, 'Date']];
    for (const [v, l] of req) { if (!String(v || '').trim()) { alert('Missing field', l + ' is required.'); return; } }
    update(d => {
      d.lhcTrips = d.lhcTrips || [];
      const rec = JSON.parse(JSON.stringify(f));
      rec.lines = rec.lines.filter(l => String(l.lrNo || '').trim() || String(l.content || '').trim());
      rec.additions = (rec.additions || []).filter(a => String(a.type || '').trim() || Number(a.amount) > 0);
      rec.deductions = (rec.deductions || []).filter(a => String(a.type || '').trim() || Number(a.amount) > 0);
      rec.expenses = (rec.expenses || []).filter(e => String(e.account || '').trim() || Number(e.amount) > 0);
      const t = computeLhcTrip(rec);
      rec.totalAddition = t.totalAddition; rec.totalDeduction = t.totalDeduction; rec.totalExpense = t.totalExpense;
      rec.netAmount = t.netAmount; rec.balanceAmount = t.balanceAmount;
      if (!rec.id) { rec.id = uid('lht'); rec.createdAt = new Date().toISOString(); d.lhcTrips.push(rec); }
      else { const idx = d.lhcTrips.findIndex(x => x.id === rec.id); if (idx >= 0) d.lhcTrips[idx] = rec; else d.lhcTrips.push(rec); }
    });
    navigation.navigate('LHCTripList');
  };

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <Card
        title={editing ? 'EDIT LHC — ' + (editing.lhcNo || '') : 'ADD NEW LHC'}
        right={<Btn small tone="red" label="VIEW LHC DETAILS" onPress={() => navigation.navigate('LHCTripList')} />}
      >
        <Grid min={190}>
          <Fld l="LHC No *" v={f.lhcNo} set={t => setF(p => ({ ...p, lhcNo: t }))} />
          <Fld l="Date *" v={f.date} set={t => setF(p => ({ ...p, date: t }))} date />
          <Fld l="Truck No" v={f.truckNo} set={t => setF(p => ({ ...p, truckNo: t }))} />
          <Fld l="From" v={f.fromPlace} set={t => setF(p => ({ ...p, fromPlace: t }))} />
          <Fld l="To" v={f.toPlace} set={t => setF(p => ({ ...p, toPlace: t }))} />
        </Grid>
      </Card>

      <Card title="LR / Consignment Details">
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ width: '100%' }} contentContainerStyle={{ width: '100%', minWidth: '100%' }}>
          <View style={{ width: '100%' }}>
            <View style={{ flexDirection: 'row', backgroundColor: C.navy, borderRadius: 6, paddingVertical: 6, marginBottom: 4, width: '100%' }}>
              {[['#', 26], ['LR No', 150], ['Date', 130], ['Content', 260], ['Pkgs', 90], ['Weight', 100], ['', 40]].map(([h, w], idx) => (
                <Text key={idx} numberOfLines={1} style={{
                  flexGrow: w, flexShrink: 0, flexBasis: 0, minWidth: w, marginRight: 6,
                  color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 6
                }}>{h}</Text>
              ))}
            </View>
            {f.lines.map((l, i) => (
              <LhcLineRow key={l.id || i} l={l} i={i} db={db} onChange={setLine} onRemove={() => removeLine(i)} canRemove={f.lines.length > 1} />
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, width: '100%' }}>
              <Text style={{ flexGrow: 306, flexShrink: 0, flexBasis: 0, minWidth: 306, fontWeight: '800', color: C.navy, paddingHorizontal: 6 }}>TOTAL</Text>
              <View style={{ flexGrow: 90, flexShrink: 0, flexBasis: 0, minWidth: 90, marginRight: 6, borderWidth: 1, borderColor: C.line2, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 7, backgroundColor: C.bg }}>
                <Text style={{ fontWeight: '700', color: C.navy, fontSize: 12 }}>{pkgsTotal.toFixed(2)}</Text>
              </View>
              <View style={{ flexGrow: 100, flexShrink: 0, flexBasis: 0, minWidth: 100, marginRight: 6, borderWidth: 1, borderColor: C.line2, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 7, backgroundColor: C.bg }}>
                <Text style={{ fontWeight: '700', color: C.navy, fontSize: 12 }}>{weightTotal.toFixed(2)}</Text>
              </View>
              <View style={{ flexGrow: 40, flexShrink: 0, flexBasis: 0, minWidth: 40 }} />
            </View>
          </View>
        </ScrollView>
        <Btn small tone="ghost" label="+ Add Row" onPress={addLine} style={{ marginTop: 8 }} />
      </Card>

      <Card title="Vehicle & Permit Details">
        <Grid min={190}>
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginBottom: 4 }}>Agent</Text>
            <PickerField value={f.agent} onChange={v => setF(p => ({ ...p, agent: v }))} placeholder="— select agent —" options={LHC_AGENTS.map(x => ({ v: x, l: x.trim() || '(blank)' }))} />
          </View>
          <Fld l="Lorry Type" v={f.lorryType} set={t => setF(p => ({ ...p, lorryType: t }))} />
          <Fld l="Chasis No" v={f.chasisNo} set={t => setF(p => ({ ...p, chasisNo: t }))} />
          <Fld l="Engine No" v={f.engineNo} set={t => setF(p => ({ ...p, engineNo: t }))} />
          <Fld l="Permit No" v={f.permitNo} set={t => setF(p => ({ ...p, permitNo: t }))} />
          <Fld l="Permit From" v={f.permitFrom} set={t => setF(p => ({ ...p, permitFrom: t }))} date />
          <Fld l="Permit Up To" v={f.permitUpto} set={t => setF(p => ({ ...p, permitUpto: t }))} date />
          <Fld l="Insurance Co" v={f.insuranceCo} set={t => setF(p => ({ ...p, insuranceCo: t }))} />
          <Fld l="Branch" v={f.branch} set={t => setF(p => ({ ...p, branch: t }))} />
          <Fld l="Policy No" v={f.policyNo} set={t => setF(p => ({ ...p, policyNo: t }))} />
          <Fld l="Insurance Up To" v={f.insuranceUpto} set={t => setF(p => ({ ...p, insuranceUpto: t }))} date />
        </Grid>
        <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 2 }}>Image upload isn't implemented in this build (this app has no file-attachment infrastructure elsewhere yet) — flagged, not built here.</Text>
      </Card>

      <Card title="Driver Information">
        <Grid min={190}>
          <Fld l="Driver" v={f.driverName} set={t => setF(p => ({ ...p, driverName: t }))} />
          <Fld l="Lic No" v={f.driverLicNo} set={t => setF(p => ({ ...p, driverLicNo: t }))} />
          <Fld l="Date" v={f.driverLicDate} set={t => setF(p => ({ ...p, driverLicDate: t }))} date />
          <Fld l="Issued From" v={f.driverIssuedFrom} set={t => setF(p => ({ ...p, driverIssuedFrom: t }))} />
          <Fld l="Mobile" v={f.driverMobile} set={t => setF(p => ({ ...p, driverMobile: t }))} />
          <Fld l="Address" v={f.driverAddress} set={t => setF(p => ({ ...p, driverAddress: t }))} multi />
        </Grid>
      </Card>

      <Card title="Owner Information">
        <Grid min={190}>
          <Fld l="Owner" v={f.ownerName} set={t => setF(p => ({ ...p, ownerName: t }))} />
          <Fld l="Pan No" v={f.ownerPan} set={t => setF(p => ({ ...p, ownerPan: t }))} />
          <Fld l="Mobile" v={f.ownerMobile} set={t => setF(p => ({ ...p, ownerMobile: t }))} />
          <Fld l="Address" v={f.ownerAddress} set={t => setF(p => ({ ...p, ownerAddress: t }))} multi />
        </Grid>
      </Card>

      <Card title="Payment Detail">
        <Grid min={280} max={2}>
          <View>
            <Fld l="Lorry Hire *" v={f.lorryHire} set={t => setF(p => ({ ...p, lorryHire: t }))} num />
            <Text style={{ fontSize: 10.5, fontWeight: '800', color: C.mut, marginBottom: 6 }}>ADDITIONS</Text>
            {(f.additions || []).map((row, i) => (
              <PayRow key={row.id || i} row={row}
                onType={v => setPay('additions', i, 'type', v)} onAmount={v => setPay('additions', i, 'amount', v)}
                onRemove={() => removePay('additions', i)} />
            ))}
            <Btn small tone="ghost" label="+ Add Row" onPress={() => addPay('additions')} />
          </View>
          <View>
            <Fld l="Advance" v={f.advance} set={t => setF(p => ({ ...p, advance: t }))} num />
            <Text style={{ fontSize: 10.5, fontWeight: '800', color: C.mut, marginBottom: 6 }}>DEDUCTIONS</Text>
            {(f.deductions || []).map((row, i) => (
              <PayRow key={row.id || i} row={row}
                onType={v => setPay('deductions', i, 'type', v)} onAmount={v => setPay('deductions', i, 'amount', v)}
                onRemove={() => removePay('deductions', i)} />
            ))}
            <Btn small tone="ghost" label="+ Add Row" onPress={() => addPay('deductions')} />
          </View>
        </Grid>
        <Grid min={190}>
          <ComputedFld l="Total Addition" v={totals.totalAddition} />
          <ComputedFld l="Total Deduction" v={totals.totalDeduction} />
          <ComputedFld l="Net Amount" v={totals.netAmount} />
          <ComputedFld l="Balance" v={totals.balanceAmount} />
          <Fld l="Pay To" v={f.payTo} set={t => setF(p => ({ ...p, payTo: t }))} />
        </Grid>
      </Card>

      <Card title="Expense">
        {(f.expenses || []).map((row, i) => (
          <ExpenseRow key={row.id || i} row={row}
            onAccount={v => setExpense(i, 'account', v)} onAmount={v => setExpense(i, 'amount', v)}
            onRemove={() => removeExpense(i)} canRemove={f.expenses.length > 1} />
        ))}
        <Btn small tone="ghost" label="+ Add Row" onPress={addExpense} />
        {totals.totalExpense > 0 ? <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 6 }}>Total Expense: {inr(totals.totalExpense)} (tracked separately — not subtracted from Net Amount / Balance above)</Text> : null}
      </Card>

      <View style={[S.wrapRow, { justifyContent: 'flex-end', marginBottom: 30 }]}>
        <Btn label="Cancel" tone="ghost" onPress={() => navigation.goBack()} />
        <Btn label="SAVE & LIST" tone="amber" onPress={save} />
      </View>
    </ScrollView>
  );
}
