import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Modal } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Btn, PickerField, DatePicker, alert } from '../ui';
import {
  uid, inr, fmtDate, byId,
  blankBill, blankBillLine, billLineFromLR, computeBill,
  BILL_CHG, BILL_PAYMENT_OPTIONS, BILL_BANK_OPTIONS, BILL_STATUS_OPTIONS
} from '../logic';

/* This is a NEW, independent screen — it does not touch LRScreen.js or
   LRFormScreen.js, and never writes to db.lrs. It only READS db.lrs (to let a
   Bill line be filled from an existing LR) and db.vendorDirectory (for the
   Vendor* dropdown — the ATTrans-imported register, see Masters -> Vendor
   Directory), plus writes its own db.bills / db.bills[].lines etc. */

/* ---- small local form primitives (same pattern as LRFormScreen.js) ---- */
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
function Fld({ l, v, set, num, multi }) {
  const isDate = !multi && l.indexOf('Date') >= 0;
  const boxStyle = { borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, fontSize: 13, color: C.txt, backgroundColor: '#fff', minHeight: multi ? 56 : undefined, width: '100%' };
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginBottom: 4 }}>{l}</Text>
      {isDate ? <DatePicker value={v == null ? '' : String(v)} onChange={set} />
        : num ? <NumBox value={v} onChangeText={set} style={boxStyle} />
        : <TextInput value={v == null ? '' : String(v)} onChangeText={set} multiline={!!multi} placeholderTextColor={C.line2} style={boxStyle} />}
    </View>
  );
}
/* Read-only computed amount — visually distinct (grey fill) from the editable
   fields around it, matching the screenshot's greyed TOTAL/GROSS/NET boxes. */
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

/* Searchable LR No field — mirrors LRFormScreen's TruckNoField (same Modal
   dropdown mechanism), but looks up db.lrs. Picking a suggestion fills the
   whole row (date/from/to/weight/pcs/rate/amount) from that LR via
   billLineFromLR — a one-time copy, never a live link back to the LR. */
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
                  <Text style={{ fontSize: 11, color: C.mut }}>{fmtDate(lr.date)} · {lr.fromPlace} → {lr.toPlace} · {inr(lr.gross)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* One row of the LR / Consignment table — # / Status / LR No / Date / From /
   To / Weight / Pcs / Rate / Amount / Other Charges / Remark, plus a remove
   button. Rendered inside a horizontal ScrollView so all 12 columns stay
   readable at their own width instead of being squeezed. */
function BillLineRow({ l, i, db, onChange, onRemove, canRemove }) {
  const cell = { borderWidth: 1, borderColor: C.line2, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 7, fontSize: 12, color: C.txt, backgroundColor: '#fff', width: '100%' };
  const set = (k) => (t) => onChange(i, k, t);
  /* Pure-CSS flex fill (same technique as ui.js's Table): each column grows
     proportionally to its base width so the row stretches to fill the full
     card width on wide screens, instead of sitting cramped at its intrinsic
     pixel width with empty space to the right. */
  const col = (w, child) => <View style={{ flexGrow: w, flexShrink: 0, flexBasis: 0, minWidth: w, marginRight: 6 }}>{child}</View>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line, width: '100%' }}>
      {col(26, <Text style={{ fontSize: 12, color: C.mut, textAlign: 'center', paddingTop: 8 }}>{i + 1}</Text>)}
      {col(112, <PickerField value={l.status} onChange={set('status')} placeholder="Status" options={BILL_STATUS_OPTIONS.map(x => ({ v: x, l: x }))} />)}
      {col(140, <LrNoField value={l.lrNo} db={db} onChangeText={set('lrNo')} onPick={(lr) => onChange(i, '__lr', lr)} />)}
      {col(120, <DatePicker value={l.date} onChange={set('date')} placeholder="dd-mm-yyyy" />)}
      {col(120, <TextInput value={l.from} onChangeText={set('from')} placeholder="From" placeholderTextColor={C.line2} style={cell} />)}
      {col(120, <TextInput value={l.to} onChangeText={set('to')} placeholder="To" placeholderTextColor={C.line2} style={cell} />)}
      {col(85, <TextInput value={String(l.weight == null ? '' : l.weight)} onChangeText={t => set('weight')(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="Weight" placeholderTextColor={C.line2} style={cell} />)}
      {col(65, <TextInput value={String(l.pcs == null ? '' : l.pcs)} onChangeText={t => set('pcs')(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="Pcs" placeholderTextColor={C.line2} style={cell} />)}
      {col(85, <TextInput value={String(l.rate == null ? '' : l.rate)} onChangeText={t => set('rate')(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="Rate" placeholderTextColor={C.line2} style={cell} />)}
      {col(95, <TextInput value={String(l.amount == null ? '' : l.amount)} onChangeText={t => set('amount')(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="Amount" placeholderTextColor={C.line2} style={cell} />)}
      {col(110, <TextInput value={String(l.otherCharges == null ? '' : l.otherCharges)} onChangeText={t => set('otherCharges')(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="Other Charges" placeholderTextColor={C.line2} style={cell} />)}
      {col(140, <TextInput value={l.remark} onChangeText={set('remark')} placeholder="Remark" placeholderTextColor={C.line2} style={cell} />)}
      {col(40, <View style={{ paddingTop: 4 }}>{canRemove ? <Btn small tone="red" label="✕" onPress={onRemove} /> : null}</View>)}
    </View>
  );
}

/* One Payment Detail row — a "SELECT AN OPTION" dropdown + amount, used for
   both the additions column and the deductions column (kind picks which). */
function PayRow({ row, onType, onAmount, onRemove }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
      <View style={{ flex: 1.3 }}>
        <PickerField value={row.type} onChange={onType} placeholder="SELECT AN OPTION" options={BILL_PAYMENT_OPTIONS.map(x => ({ v: x, l: x }))} />
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

export default function BillFormScreen({ navigation, route }) {
  const { db, update } = useStore();
  const params = (route && route.params) || {};
  const editing = params.billId ? byId(db.bills, params.billId) : null;

  const [f, setF] = useState(() => {
    if (editing) return JSON.parse(JSON.stringify(editing));
    const b = blankBill();
    /* Seed 5 blank rows in each Payment Detail column so a brand-new bill
       visually matches the reference screenshot's 5+5 grid; still fully
       add/removable below. */
    b.additions = [1, 2, 3, 4, 5].map(() => ({ id: uid('bp'), type: '', amount: '' }));
    b.deductions = [1, 2, 3, 4, 5].map(() => ({ id: uid('bp'), type: '', amount: '' }));
    return b;
  });

  const totals = useMemo(() => computeBill(f), [f]);

  const setLine = (i, k, v) => {
    if (k === '__lr') {
      const filled = billLineFromLR(v);
      setF(p => { const lines = p.lines.slice(); lines[i] = { ...lines[i], ...filled }; return { ...p, lines }; });
      return;
    }
    setF(p => { const lines = p.lines.slice(); lines[i] = { ...lines[i], [k]: v }; return { ...p, lines }; });
  };
  const addLine = () => setF(p => ({ ...p, lines: [...p.lines, blankBillLine()] }));
  const removeLine = (i) => setF(p => ({ ...p, lines: p.lines.filter((_, j) => j !== i) }));

  const setPay = (kind, i, k, v) => setF(p => { const arr = (p[kind] || []).slice(); arr[i] = { ...arr[i], [k]: v }; return { ...p, [kind]: arr }; });
  const addPay = (kind) => setF(p => ({ ...p, [kind]: [...(p[kind] || []), { id: uid('bp'), type: '', amount: '' }] }));
  const removePay = (kind, i) => setF(p => ({ ...p, [kind]: p[kind].filter((_, j) => j !== i) }));

  const vendorOptions = (db.vendorDirectory || [])
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .map(v => ({ v: v.id, l: (v.name || '(blank name in source)') + (v.vendorCode ? ' — ' + v.vendorCode : '') }));

  const save = () => {
    const req = [[f.invoiceNo, 'Invoice No'], [f.vendorId, 'Vendor'], [f.date, 'Date']];
    for (const [v, l] of req) { if (!String(v || '').trim()) { alert('Missing field', l + ' is required.'); return; } }
    update(d => {
      d.bills = d.bills || [];
      const rec = JSON.parse(JSON.stringify(f));
      rec.lines = rec.lines.filter(l => String(l.lrNo || '').trim() || Number(l.amount) > 0);
      rec.additions = (rec.additions || []).filter(a => String(a.type || '').trim() || Number(a.amount) > 0);
      rec.deductions = (rec.deductions || []).filter(a => String(a.type || '').trim() || Number(a.amount) > 0);
      const t = computeBill(rec);
      rec.totalAmount = t.totalAmount; rec.totalAddition = t.totalAddition; rec.totalDeduction = t.totalDeduction;
      rec.grossAmount = t.grossAmount; rec.sgstAmt = t.sgstAmt; rec.cgstAmt = t.cgstAmt; rec.igstAmt = t.igstAmt;
      rec.netAmount = t.netAmount; rec.balanceAmount = t.balanceAmount;
      if (!rec.id) { rec.id = uid('bill'); rec.createdAt = new Date().toISOString(); d.bills.push(rec); }
      else { const idx = d.bills.findIndex(x => x.id === rec.id); if (idx >= 0) d.bills[idx] = rec; else d.bills.push(rec); }
    });
    navigation.navigate('BillList');
  };

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <Card
        title={editing ? 'EDIT BILL — ' + (editing.invoiceNo || '') : 'ADD NEW BILL'}
        right={<Btn small tone="red" label="VIEW BILL DETAILS" onPress={() => navigation.navigate('BillList')} />}
      >
        <Grid min={190}>
          <Fld l="Invoice No *" v={f.invoiceNo} set={t => setF(p => ({ ...p, invoiceNo: t }))} />
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginBottom: 4 }}>Vendor *</Text>
            <PickerField value={f.vendorId} onChange={v => setF(p => ({ ...p, vendorId: v }))} placeholder="— select vendor —" options={vendorOptions} />
          </View>
          <Fld l="Date *" v={f.date} set={t => setF(p => ({ ...p, date: t }))} />
          <Fld l="PO No" v={f.poNo} set={t => setF(p => ({ ...p, poNo: t }))} />
          <Fld l="PO Date" v={f.poDate} set={t => setF(p => ({ ...p, poDate: t }))} />
        </Grid>
      </Card>

      <Card title="LR / Consignment Details">
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ width: '100%' }} contentContainerStyle={{ width: '100%', minWidth: '100%' }}>
          <View style={{ width: '100%' }}>
            <View style={{ flexDirection: 'row', backgroundColor: C.navy, borderRadius: 6, paddingVertical: 6, marginBottom: 4, width: '100%' }}>
              {[['#', 26], ['Status', 112], ['LR No', 140], ['Date', 120], ['From', 120], ['To', 120], ['Weight', 85], ['Pcs', 65], ['Rate', 85], ['Amount', 95], ['Other Chg', 110], ['Remark', 140], ['', 40]].map(([h, w], idx) => (
                <Text key={idx} numberOfLines={1} style={{
                  flexGrow: w, flexShrink: 0, flexBasis: 0, minWidth: w, marginRight: 6,
                  color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 6
                }}>{h}</Text>
              ))}
            </View>
            {f.lines.map((l, i) => (
              <BillLineRow key={l.id || i} l={l} i={i} db={db} onChange={setLine} onRemove={() => removeLine(i)} canRemove={f.lines.length > 1} />
            ))}
          </View>
        </ScrollView>
        <Btn small tone="ghost" label="+ Add Row" onPress={addLine} style={{ marginTop: 8 }} />
      </Card>

      <Card title="LR Charges">
        <Grid min={160}>
          {BILL_CHG.map(c => (
            <Fld key={c[0]} l={c[1] + ' ₹'} v={f.charges[c[0]]} set={t => setF(p => ({ ...p, charges: { ...p.charges, [c[0]]: t } }))} num />
          ))}
        </Grid>
      </Card>

      <Card title="Payment Detail">
        <Grid min={280} max={2}>
          <View>
            <Text style={{ fontSize: 10.5, fontWeight: '800', color: C.mut, marginBottom: 6 }}>ADDITIONS</Text>
            {(f.additions || []).map((row, i) => (
              <PayRow key={row.id || i} row={row}
                onType={v => setPay('additions', i, 'type', v)} onAmount={v => setPay('additions', i, 'amount', v)}
                onRemove={() => removePay('additions', i)} />
            ))}
            <Btn small tone="ghost" label="+ Add Row" onPress={() => addPay('additions')} />
          </View>
          <View>
            <Text style={{ fontSize: 10.5, fontWeight: '800', color: C.mut, marginBottom: 6 }}>DEDUCTIONS</Text>
            {(f.deductions || []).map((row, i) => (
              <PayRow key={row.id || i} row={row}
                onType={v => setPay('deductions', i, 'type', v)} onAmount={v => setPay('deductions', i, 'amount', v)}
                onRemove={() => removePay('deductions', i)} />
            ))}
            <Btn small tone="ghost" label="+ Add Row" onPress={() => addPay('deductions')} />
          </View>
        </Grid>
      </Card>

      <Card title="Tax">
        <Grid min={220} max={3}>
          <Fld l="SGST %" v={f.sgstPct} set={t => setF(p => ({ ...p, sgstPct: t }))} num />
          <Fld l="CGST %" v={f.cgstPct} set={t => setF(p => ({ ...p, cgstPct: t }))} num />
          <Fld l="IGST %" v={f.igstPct} set={t => setF(p => ({ ...p, igstPct: t }))} num />
        </Grid>
        <Grid min={220} max={3}>
          <ComputedFld l="SGST ₹" v={totals.sgstAmt} />
          <ComputedFld l="CGST ₹" v={totals.cgstAmt} />
          <ComputedFld l="IGST ₹" v={totals.igstAmt} />
        </Grid>
      </Card>

      <Card title="Bill Calculation">
        <Grid min={190}>
          <ComputedFld l="Total Addition" v={totals.totalAddition} />
          <ComputedFld l="Total Deduction" v={totals.totalDeduction} />
          <ComputedFld l="Total Amount" v={totals.totalAmount} />
          <ComputedFld l="Gross Amount" v={totals.grossAmount} />
          <ComputedFld l="Net Amount" v={totals.netAmount} />
          <Fld l="Round Off ₹" v={f.roundOff} set={t => setF(p => ({ ...p, roundOff: t }))} num />
          <Fld l="Advance Receive ₹" v={f.advanceReceive} set={t => setF(p => ({ ...p, advanceReceive: t }))} num />
          <ComputedFld l="Balance Amount" v={totals.balanceAmount} />
        </Grid>
      </Card>

      <Card title="Additional Details">
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginBottom: 4 }}>Bank *</Text>
          <PickerField value={f.bank} onChange={v => setF(p => ({ ...p, bank: v }))} placeholder="— select bank —" options={BILL_BANK_OPTIONS.map(x => ({ v: x, l: x }))} />
        </View>
        <Fld l="Remark" v={f.remark} set={t => setF(p => ({ ...p, remark: t }))} multi />
        <Fld l="Subject" v={f.subject} set={t => setF(p => ({ ...p, subject: t }))} multi />
      </Card>

      <View style={[S.wrapRow, { justifyContent: 'flex-end', marginBottom: 30 }]}>
        <Btn label="Cancel" tone="ghost" onPress={() => navigation.goBack()} />
        <Btn label="SAVE & LIST" tone="amber" onPress={save} />
      </View>
    </ScrollView>
  );
}
