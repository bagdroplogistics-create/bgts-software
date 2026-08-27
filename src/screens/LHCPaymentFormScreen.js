import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Btn, DatePicker, PickerField, Empty, alert } from '../ui';
import {
  uid, inr, fmtDate, todayISO, sum,
  LHC_AGENTS, lhcPaidTotal, lhcPendingAmount
} from '../logic';

/* "ADD NEW LHC BALANCE PAYMENT" — a NEW, independent screen mirroring
   ATTrans's own bulk payment-entry form (screenshots dated 2026-08-27).
   Unlike the LR/Bill/LHC Trip forms (one record per save), this form lists
   EVERY existing LHC trip (db.lhcTrips) at once — filterable by Owner /
   Agent / LHC No — and lets the user key in an "Adjust" amount per row in a
   single batch. On save, one db.lhcPayments row is written per trip whose
   Adjust amount is > 0, all sharing the same voucher number (this
   transaction's own auto-incrementing document number — see logic.js's
   note on why the source screenshot's "LHC NO*: 00018" field isn't a real
   LHC reference) and the same Payment Detail (date/mode/cash/bank/name).

   Pending / Total Pending: PAID(trip) = sum of this trip's existing
   db.lhcPayments amounts; PENDING = trip.lorryHire − PAID (see logic.js's
   lhcPendingAmount). TOTAL PENDING (this transaction) = PENDING + this
   row's Other Add − this row's Other Less — a transparent running-ledger
   design, not a reconstruction of ATTrans's own internal Paid/Pending
   formula (which the source data doesn't let us verify precisely; see the
   long doc comment above LEGACY_LHC_PAYMENTS in logic.js). */

function HeaderFld({ l, children }) {
  return (
    <View style={{ marginBottom: 10, minWidth: 190 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginBottom: 4 }}>{l}</Text>
      {children}
    </View>
  );
}
function TextFld({ v, set, placeholder, num }) {
  const boxStyle = { borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, fontSize: 13, color: C.txt, backgroundColor: '#fff', width: '100%' };
  return (
    <TextInput
      value={v == null ? '' : String(v)}
      onChangeText={t => set(num ? t.replace(/[^0-9.\-]/g, '') : t)}
      keyboardType={num ? 'numeric' : 'default'}
      placeholder={placeholder} placeholderTextColor={C.line2}
      style={boxStyle}
    />
  );
}
function ComputedFld({ l, v }) {
  return (
    <HeaderFld l={l}>
      <View style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: C.bg }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.navy }}>{inr(v)}</Text>
      </View>
    </HeaderFld>
  );
}

/* One row of the big per-trip table. Same pure-CSS flex-fill technique used
   throughout this app (BillFormScreen / LHCTripFormScreen): every column,
   header and body alike, shares the same flexGrow ratio so labels stay
   aligned to fields at any screen width. */
const COLS = [
  ['SR.NO', 40], ['LHC', 100], ['DATE', 85], ['TRUCK', 100], ['FROM', 90], ['TO', 90],
  ['AGENT', 120], ['OWNER', 110], ['LORRY HIRE', 95], ['ADVANCE', 90], ['PAID', 90], ['PENDING', 90],
  ['OTHER ADD', 90], ['OTHER LESS', 90], ['TOTAL PENDING', 100], ['ADJUST', 100], ['PAID TO', 100]
];
function col(w, child, extraStyle) {
  return <View style={[{ flexGrow: w, flexShrink: 0, flexBasis: 0, minWidth: w, marginRight: 6 }, extraStyle]}>{child}</View>;
}

function TripRow({ trip, paid, pending, edit, onEdit }) {
  const cell = { borderWidth: 1, borderColor: C.line2, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 6, fontSize: 11.5, color: C.txt, backgroundColor: '#fff', width: '100%' };
  const otherAdd = Number(edit.otherAdd) || 0;
  const otherLess = Number(edit.otherLess) || 0;
  const totalPending = pending + otherAdd - otherLess;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.line, width: '100%' }}>
      {col(40, <Text style={{ fontSize: 11.5, color: C.mut, textAlign: 'center' }}>{trip.__srNo}</Text>)}
      {col(100, <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.navy }} numberOfLines={1}>{trip.lhcNo}</Text>)}
      {col(85, <Text style={{ fontSize: 11.5, color: C.txt }} numberOfLines={1}>{fmtDate(trip.date)}</Text>)}
      {col(100, <Text style={{ fontSize: 11.5, color: C.txt }} numberOfLines={1}>{trip.truckNo || '—'}</Text>)}
      {col(90, <Text style={{ fontSize: 11.5, color: C.txt }} numberOfLines={1}>{trip.fromPlace || '—'}</Text>)}
      {col(90, <Text style={{ fontSize: 11.5, color: C.txt }} numberOfLines={1}>{trip.toPlace || '—'}</Text>)}
      {col(120, <Text style={{ fontSize: 11.5, color: C.txt }} numberOfLines={1}>{(trip.agent || '—').trim() || '—'}</Text>)}
      {col(110, <Text style={{ fontSize: 11.5, color: C.txt }} numberOfLines={1}>{trip.ownerName || '—'}</Text>)}
      {col(95, <Text style={{ fontSize: 11.5, color: C.txt }}>{inr(trip.lorryHire)}</Text>)}
      {col(90, <Text style={{ fontSize: 11.5, color: C.txt }}>{inr(trip.advance)}</Text>)}
      {col(90, <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.green }}>{inr(paid)}</Text>)}
      {col(90, <Text style={{ fontSize: 11.5, fontWeight: '700', color: pending > 0 ? C.red : C.green }}>{inr(pending)}</Text>)}
      {col(90, <TextInput value={String(edit.otherAdd || '')} onChangeText={t => onEdit(trip.id, 'otherAdd', t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" placeholderTextColor={C.line2} style={cell} />)}
      {col(90, <TextInput value={String(edit.otherLess || '')} onChangeText={t => onEdit(trip.id, 'otherLess', t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" placeholderTextColor={C.line2} style={cell} />)}
      {col(100, <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.navy }}>{inr(totalPending)}</Text>)}
      {col(100, <TextInput value={String(edit.adjust || '')} onChangeText={t => onEdit(trip.id, 'adjust', t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" placeholderTextColor={C.line2} style={[cell, { fontWeight: '700' }]} />)}
      {col(100, <TextInput value={String(edit.payTo || '')} onChangeText={t => onEdit(trip.id, 'payTo', t)} placeholder="AGENT" placeholderTextColor={C.line2} style={cell} />)}
    </View>
  );
}

export default function LHCPaymentFormScreen({ navigation }) {
  const { db, update } = useStore();
  const trips = db.lhcTrips || [];
  const payments = db.lhcPayments || [];

  const [ownerFilter, setOwnerFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [lhcFilter, setLhcFilter] = useState('');

  const [voucherNo] = useState(() => String((db.seq && db.seq.lhcPay) || 1).padStart(5, '0'));
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentType, setPaymentType] = useState('ADVANCE');
  const [cashAmount, setCashAmount] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState('CASH');

  const [edits, setEdits] = useState({}); // tripId -> { otherAdd, otherLess, adjust, payTo }
  const setEdit = (tripId, k, v) => setEdits(p => ({ ...p, [tripId]: { ...(p[tripId] || { payTo: 'AGENT' }), [k]: v } }));

  const ownerOptions = useMemo(() => {
    const names = Array.from(new Set(trips.map(t => (t.ownerName || '').trim()).filter(Boolean)));
    return [{ v: '', l: 'All Owners' }, ...names.map(n => ({ v: n, l: n }))];
  }, [trips]);
  const agentOptions = [{ v: '', l: 'All Agents' }, ...LHC_AGENTS.map(a => ({ v: a, l: a.trim() || '(blank)' }))];
  /* Same "ALL" + one-option-per-real-LHC pattern as Owner/Agent above — a
     select, not free text, matching ATTrans's own "ADD NEW LHC BALANCE
     PAYMENT" form: picking one LHC No here narrows the table below to that
     single row (see the reference screenshot: BRD/00007 selected -> only
     that one trip's row shows). */
  const lhcNoOptions = useMemo(() => {
    const sorted = trips.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.lhcNo).localeCompare(String(a.lhcNo)));
    return [{ v: '', l: 'All' }, ...sorted.map(t => ({ v: t.lhcNo, l: t.lhcNo }))];
  }, [trips]);

  const visibleTrips = useMemo(() => trips
    .filter(t => !ownerFilter || (t.ownerName || '').trim() === ownerFilter)
    .filter(t => !agentFilter || t.agent === agentFilter)
    .filter(t => !lhcFilter || t.lhcNo === lhcFilter)
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.lhcNo).localeCompare(String(a.lhcNo)))
    .map((t, i) => ({ ...t, __srNo: i + 1 })), [trips, ownerFilter, agentFilter, lhcFilter]);

  const adjustTotal = useMemo(() => sum(Object.values(edits), e => Number(e.adjust) || 0), [edits]);
  const cashBankTotal = (Number(cashAmount) || 0) + (Number(bankAmount) || 0);

  const save = () => {
    const rowsToSave = visibleTrips.filter(t => Number((edits[t.id] || {}).adjust) > 0);
    if (!rowsToSave.length) { alert('Nothing to save', 'Enter an Adjust amount for at least one LHC row.'); return; }
    if (!paymentDate) { alert('Missing field', 'Payment Date is required.'); return; }
    update(d => {
      d.lhcPayments = d.lhcPayments || [];
      d.seq = d.seq || {};
      if (!d.seq.lhcPay) d.seq.lhcPay = 1;
      const usedVoucherNo = String(d.seq.lhcPay).padStart(5, '0');
      d.seq.lhcPay++;
      rowsToSave.forEach(t => {
        const e = edits[t.id] || {};
        d.lhcPayments.push({
          id: uid('lhp'), voucherNo: usedVoucherNo, srNo: null, lhcTripId: t.id, lhcNo: t.lhcNo, date: paymentDate,
          ownerName: t.ownerName || '', agentName: t.agent || '', payTo: (e.payTo || 'AGENT').trim() || 'AGENT',
          amount: Number(e.adjust) || 0, otherAdd: Number(e.otherAdd) || 0, otherLess: Number(e.otherLess) || 0,
          paymentType, mode, cashAmount: Number(cashAmount) || 0, bankAmount: Number(bankAmount) || 0, name,
          createdBy: '', createdAt: new Date().toISOString()
        });
      });
    });
    navigation.navigate('LHCPaymentList');
  };

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <Card
        title="ADD NEW LHC BALANCE PAYMENT"
        right={<Btn small tone="red" label="VIEW PAYMENT DETAILS" onPress={() => navigation.navigate('LHCPaymentList')} />}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <HeaderFld l="Owner">
            <PickerField value={ownerFilter} onChange={setOwnerFilter} options={ownerOptions} />
          </HeaderFld>
          <HeaderFld l="Agent">
            <PickerField value={agentFilter} onChange={setAgentFilter} options={agentOptions} />
          </HeaderFld>
          <HeaderFld l="LHC No">
            <PickerField value={lhcFilter} onChange={setLhcFilter} options={lhcNoOptions} />
          </HeaderFld>
          <Btn small tone="ghost" label="Reset" onPress={() => { setOwnerFilter(''); setAgentFilter(''); setLhcFilter(''); }} style={{ alignSelf: 'flex-end', marginBottom: 10 }} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
          <HeaderFld l="LHC No * (voucher / document no.)">
            <View style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: C.bg }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.navy }}>{voucherNo}</Text>
            </View>
          </HeaderFld>
          <HeaderFld l="Date *">
            <DatePicker value={paymentDate} onChange={setPaymentDate} />
          </HeaderFld>
          <HeaderFld l="Payment Type">
            <PickerField value={paymentType} onChange={setPaymentType} options={[
              { v: 'ADVANCE', l: 'ADVANCE' }, { v: 'FINAL SETTLEMENT', l: 'FINAL SETTLEMENT' }, { v: 'OTHER', l: 'OTHER' }
            ]} />
          </HeaderFld>
        </View>
        <Text style={{ fontSize: 10.5, color: C.mut, marginTop: -2 }}>
          This document number is this payment transaction's own running voucher no. — it does not reference a specific LHC (each row below is matched to its own real LHC No).
        </Text>
      </Card>

      <Card title="LHC Trips — enter an Adjust amount per row to record a payment">
        {!visibleTrips.length ? (
          <Empty text={trips.length ? 'No LHCs match this filter.' : 'No LHCs on file yet — add one under LHC / Lorry Hire first.'} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator style={{ width: '100%' }} contentContainerStyle={{ width: '100%', minWidth: '100%' }}>
            <View style={{ width: '100%', minWidth: 1400 }}>
              <View style={{ flexDirection: 'row', backgroundColor: C.navy, borderRadius: 6, paddingVertical: 6, width: '100%' }}>
                {COLS.map(([h, w], idx) => (
                  <Text key={idx} numberOfLines={1} style={{
                    flexGrow: w, flexShrink: 0, flexBasis: 0, minWidth: w, marginRight: 6,
                    color: '#fff', fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 6
                  }}>{h}</Text>
                ))}
              </View>
              {visibleTrips.map(t => {
                const paid = lhcPaidTotal(payments, t.id);
                const pending = lhcPendingAmount(t, payments);
                const edit = edits[t.id] || { payTo: 'AGENT' };
                return <TripRow key={t.id} trip={t} paid={paid} pending={pending} edit={edit} onEdit={setEdit} />;
              })}
            </View>
          </ScrollView>
        )}
      </Card>

      <Card title="Payment Detail">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <ComputedFld l="Total *" v={adjustTotal} />
          <HeaderFld l="Cash">
            <TextFld v={cashAmount} set={setCashAmount} placeholder="0" num />
          </HeaderFld>
          <HeaderFld l="Bank">
            <TextFld v={bankAmount} set={setBankAmount} placeholder="0" num />
          </HeaderFld>
          <HeaderFld l="Name">
            <TextFld v={name} set={setName} placeholder="Payee / reference name" />
          </HeaderFld>
          <HeaderFld l="Mode">
            <PickerField value={mode} onChange={setMode} options={[
              { v: 'CASH', l: 'CASH' }, { v: 'BANK', l: 'BANK' }, { v: 'CHEQUE', l: 'CHEQUE' }, { v: 'UPI', l: 'UPI' }, { v: 'OTHER', l: 'OTHER' }
            ]} />
          </HeaderFld>
          <HeaderFld l="Payment Date *">
            <DatePicker value={paymentDate} onChange={setPaymentDate} />
          </HeaderFld>
        </View>
        {cashBankTotal > 0 && Math.round(cashBankTotal * 100) !== Math.round(adjustTotal * 100) ? (
          <Text style={{ fontSize: 10.5, color: C.red, marginTop: -4 }}>Cash + Bank ({inr(cashBankTotal)}) doesn't match Total Adjust ({inr(adjustTotal)}) — check before saving.</Text>
        ) : null}
      </Card>

      <View style={[S.wrapRow, { justifyContent: 'flex-end', marginBottom: 30 }]}>
        <Btn label="Cancel" tone="ghost" onPress={() => navigation.goBack()} />
        <Btn label="SAVE & LIST" tone="amber" onPress={save} />
      </View>
    </ScrollView>
  );
}
