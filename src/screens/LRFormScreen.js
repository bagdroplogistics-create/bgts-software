import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useStore } from '../store';
import { C, S, Card, Btn } from '../ui';
import {
  uid, inr, todayISO, byId, blankLR, computeLR, clientName, vendorName,
  truckToVehicleId, lrHireBalance, convertInquiryToLRDraft, lrHtml,
  LR_CHG, PKG_TYPES, EXP_HEADS
} from '../logic';

/* ---- small local form primitives ---- */
function Fld({ l, v, set, num, multi, half }) {
  return (
    <View style={{ marginBottom: 10, width: half ? '48.5%' : '100%' }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginBottom: 4 }}>{l}</Text>
      <TextInput value={v == null ? '' : String(v)} onChangeText={set}
        keyboardType={num ? 'numeric' : 'default'} multiline={!!multi}
        placeholder={l.indexOf('Date') >= 0 ? 'YYYY-MM-DD' : ''} placeholderTextColor={C.line2}
        style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, fontSize: 13, color: C.txt, backgroundColor: '#fff', minHeight: multi ? 56 : undefined }} />
    </View>
  );
}
function Chips({ l, v, set, opts }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginBottom: 4 }}>{l}</Text>
      <View style={S.wrapRow}>
        {opts.map(o => (
          <TouchableOpacity key={o} onPress={() => set(o)} style={{
            backgroundColor: v === o ? C.navy2 : '#fff', borderWidth: 1,
            borderColor: v === o ? C.navy2 : C.line2, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 4
          }}>
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: v === o ? '#fff' : C.txt }}>{o || '—'}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
function Party({ label, p, setP, clients, color }) {
  return (
    <Card title={label}>
      <View style={S.wrapRow}>
        {clients.slice(0, 4).map(c => (
          <TouchableOpacity key={c.id} onPress={() => setP({ name: c.name, city: c.addr || '', contact: c.phone || '', pan: p.pan || '', gst: c.gstin || '' })}
            style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: color, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6 }}>
            <Text style={{ fontSize: 10.5, color: C.txt }}>↳ {c.name.slice(0, 18)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Fld l={label + ' Name *'} v={p.name} set={t => setP({ ...p, name: t })} />
      <View style={[S.row, { justifyContent: 'space-between' }]}>
        <View style={{ width: '48.5%' }}><Fld l="City" v={p.city} set={t => setP({ ...p, city: t })} /></View>
        <View style={{ width: '48.5%' }}><Fld l="Contact" v={p.contact} set={t => setP({ ...p, contact: t })} /></View>
      </View>
      <View style={[S.row, { justifyContent: 'space-between' }]}>
        <View style={{ width: '48.5%' }}><Fld l="PAN" v={p.pan} set={t => setP({ ...p, pan: t })} /></View>
        <View style={{ width: '48.5%' }}><Fld l="GST" v={p.gst} set={t => setP({ ...p, gst: t })} /></View>
      </View>
    </Card>
  );
}

export default function LRFormScreen({ navigation, route }) {
  const { db, update } = useStore();
  const params = route.params || {};
  const editing = params.lrId ? byId(db.lrs, params.lrId) : null;
  const booking = params.bookingId ? byId(db.bookings, params.bookingId) : null;
  const inquiry = params.inquiryId ? byId(db.inquiries, params.inquiryId) : null;

  const [f, setF] = useState(() => {
    if (editing) return JSON.parse(JSON.stringify(editing));
    if (inquiry) {
      const l = convertInquiryToLRDraft(db, inquiry);
      l.lrNo = db.company.lrPrefix + String(db.seq.lr).padStart(4, '0');
      if (!l.goods.length) l.goods = [{ desc: '', pkgType: '', pcs: '', aw: '', cw: '', l: '', w: '', h: '' }];
      return l;
    }
    const l = blankLR();
    l.lrNo = db.company.lrPrefix + String(db.seq.lr).padStart(4, '0');
    if (booking) {
      l.bookingId = booking.id;
      l.fromPlace = booking.origin; l.toPlace = booking.destination;
      l.lorryType = booking.vehicleType || '';
      const v = byId(db.vehicles, booking.vehicleId);
      l.truckNo = booking.assignType === 'Owned' ? (v ? v.regNo : '') : (booking.hiredVehicleNo || '');
      l.ownership = booking.assignType || 'Owned';
      const bbr = byId(db.branches || [], booking.branchId);
      l.bookingBranch = bbr ? bbr.name : (db.branches && db.branches[0] ? db.branches[0].name : 'VADODARA');
      l.hire = { vendorId: booking.hiredVendorId || '', amount: String(Number(booking.hireCost) || ''), advance: '', payments: [] };
      l.ewayBillNo = booking.ewayBill || '';
      const c = byId(db.clients, booking.clientId) || {};
      l.consignor = { name: clientName(db, booking.clientId), city: c.addr || '', contact: c.phone || '', pan: '', gst: c.gstin || '' };
      if (booking.cargo) l.goods = [{ desc: booking.cargo, pkgType: '', pcs: '', aw: String(booking.weightMT || ''), cw: String(booking.weightMT || ''), l: '', w: '', h: '' }];
      l.charges.freight = String(Number(booking.freight) || 0);
    }
    if (!l.goods.length) l.goods = [{ desc: '', pkgType: '', pcs: '', aw: '', cw: '', l: '', w: '', h: '' }];
    return l;
  });

  const set = (k) => (t) => setF(p => ({ ...p, [k]: t }));
  const setCh = (k) => (t) => setF(p => ({ ...p, charges: { ...p.charges, [k]: t } }));
  const setGoods = (i, k, t) => setF(p => {
    const g = p.goods.slice(); g[i] = { ...g[i], [k]: t }; return { ...p, goods: g };
  });
  const setExp = (i, k, t) => setF(p => {
    const e = p.expenses.slice(); e[i] = { ...e[i], [k]: t }; return { ...p, expenses: e };
  });

  const totals = useMemo(() => computeLR(f.charges, f.igstPct, f.cgstPct, f.sgstPct), [f.charges, f.igstPct, f.cgstPct, f.sgstPct]);
  const wt = useMemo(() => {
    let aw = 0, cw = 0;
    f.goods.forEach(g => { aw += Number(g.aw) || 0; cw += Number(g.cw) || 0; });
    return { aw, cw };
  }, [f.goods]);

  const save = (andPrint) => {
    const req = [[f.truckNo, 'Truck No'], [f.lrNo, 'LR No'], [f.date, 'Date'], [f.fromPlace, 'From Place'], [f.toPlace, 'To Place'], [f.consignor.name, 'Consignor Name'], [f.consignee.name, 'Consignee Name']];
    for (const [v, l] of req) { if (!String(v || '').trim()) { Alert.alert('Missing field', l + ' is required.'); return; } }
    if (f.ownership === 'Hired' && !f.hire.vendorId) { Alert.alert('Missing field', 'Select the Hire Vendor for a Hired-vehicle LR (Masters → Vendors).'); return; }
    if (db.lrs.some(l => l.lrNo === f.lrNo && l.id !== f.id)) { Alert.alert('Duplicate', 'LR No ' + f.lrNo + ' already exists.'); return; }
    let savedRec = null;
    update(d => {
      const rec = JSON.parse(JSON.stringify(f));
      rec.goods = rec.goods.filter(g => String(g.desc || '').trim());
      rec.expenses = (rec.expenses || []).filter(e => (Number(e.amount) || 0) > 0);
      rec.aWeight = String(wt.aw || ''); rec.cWeight = String(wt.cw || '');
      rec.subTotal = totals.subTotal; rec.igstAmt = totals.igstAmt; rec.cgstAmt = totals.cgstAmt; rec.sgstAmt = totals.sgstAmt; rec.gross = totals.gross;
      rec.branchId = (d.branches[0] || {}).id || '';
      d.branches.forEach(br => { if (br.name === rec.bookingBranch) rec.branchId = br.id; });
      if (rec.ownership === 'Hired') {
        rec.vehicleId = '';
        rec.hire.amount = Number(rec.hire.amount) || 0;
        rec.hire.advance = Number(rec.hire.advance) || 0;
      } else {
        rec.hire = { vendorId: '', amount: 0, advance: 0, payments: (rec.hire && rec.hire.payments) || [] };
        rec.vehicleId = truckToVehicleId(d, rec.truckNo);
      }
      if (!rec.id) {
        rec.id = uid('lr');
        d.lrs.push(rec);
        if (rec.lrNo === d.company.lrPrefix + String(d.seq.lr).padStart(4, '0')) d.seq.lr++;
      } else {
        const idx = d.lrs.findIndex(x => x.id === rec.id);
        if (idx >= 0) d.lrs[idx] = rec; else d.lrs.push(rec);
      }
      /* replace any prior postings of this LR so edits don't double-post */
      d.acctExp = d.acctExp.filter(e => !(e.src === 'lr' && e.lrId === rec.id));
      rec.expenses.forEach(e => {
        d.acctExp.push({ id: uid('ax'), lrId: rec.id, branchId: rec.branchId, date: rec.date, account: e.account || 'Other Expenses', amount: Number(e.amount) || 0, paidThrough: 'Petty Cash', vendor: '', ref: 'LR ' + rec.lrNo, notes: e.remarks || 'LR expense', src: 'lr' });
      });
      /* sync hire ADVANCE posting — one stable entry per LR, updated in place */
      const advId = 'hadv_' + rec.id;
      d.acctExp = d.acctExp.filter(e => e.id !== advId);
      if (rec.ownership === 'Hired' && rec.hire.advance > 0) {
        d.acctExp.push({ id: advId, lrId: rec.id, branchId: rec.branchId, date: rec.date, account: 'Hired Vehicle / Subcontractor', amount: rec.hire.advance, paidThrough: 'Bank — Current A/c', vendor: vendorName(d, rec.hire.vendorId), ref: 'LR ' + rec.lrNo + ' — hire advance', notes: 'Hire advance', src: 'hire' });
      }
      if (rec.bookingId) {
        const b = byId(d.bookings, rec.bookingId);
        if (b) { b.lrNo = rec.lrNo; b.ewayBill = rec.ewayBillNo;
          if (b.status === 'Booked') b.status = 'Vehicle Assigned';
          if (b.status === 'Vehicle Assigned') b.status = 'In Transit'; }
      }
      if (params.inquiryId) {
        const iq = byId(d.inquiries, params.inquiryId);
        if (iq) { iq.status = 'CONVERTED'; iq.lrId = rec.id; }
      }
      savedRec = rec;
    });
    if (andPrint && savedRec) {
      Print.printToFileAsync({ html: lrHtml(db, savedRec) })
        .then(({ uri }) => Sharing.isAvailableAsync().then(ok => { if (ok) Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: savedRec.lrNo }); }))
        .catch(e => Alert.alert('PDF error', String(e.message || e)));
    }
    navigation.goBack();
  };

  const half = (a, b) => (
    <View style={[S.row, { justifyContent: 'space-between' }]}>
      <View style={{ width: '48.5%' }}>{a}</View>
      <View style={{ width: '48.5%' }}>{b}</View>
    </View>
  );

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <Card title={editing ? 'Edit LR — ' + editing.lrNo : 'ADD NEW LR' + (booking ? '  (from ' + booking.bkNo + ')' : '')}>
        <Chips l="LR Type *" v={f.lrType} set={set('lrType')} opts={['ORIGINAL', 'DUMMY']} />
        <Chips l="Vehicle Ownership *" v={f.ownership} set={set('ownership')} opts={['Owned', 'Hired']} />
        <Text style={{ fontSize: 10.5, color: C.mut, marginTop: -6, marginBottom: 8 }}>
          Owned → add trip expenses against this LR later. Hired → hire advance & balance tracked below (internal — never prints on the LR).
        </Text>
        {half(<Fld l="Truck No *" v={f.truckNo} set={set('truckNo')} />, <Fld l="LR No *" v={f.lrNo} set={set('lrNo')} />)}
        <Fld l="Date *" v={f.date} set={set('date')} />
        <Chips l="Booking Branch" v={f.bookingBranch} set={set('bookingBranch')} opts={(db.branches || []).map(b => b.name)} />
        {half(<Fld l="From Place *" v={f.fromPlace} set={set('fromPlace')} />, <Fld l="To Place *" v={f.toPlace} set={set('toPlace')} />)}
        <Fld l="To Branch" v={f.toBranch} set={set('toBranch')} />
      </Card>

      {f.ownership === 'Hired' ? (
        <Card title="Hire Details (internal — never prints)">
          <Text style={{ fontSize: 10, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginBottom: 4 }}>Hire Vendor *</Text>
          <View style={S.wrapRow}>
            {db.vendors.map(v => (
              <TouchableOpacity key={v.id} onPress={() => setF(p => ({ ...p, hire: { ...p.hire, vendorId: v.id } }))} style={{
                backgroundColor: f.hire.vendorId === v.id ? C.navy2 : '#fff', borderWidth: 1,
                borderColor: f.hire.vendorId === v.id ? C.navy2 : C.line2, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 6
              }}>
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: f.hire.vendorId === v.id ? '#fff' : C.txt }}>{v.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {half(
            <Fld l="Lorry Hire ₹" v={f.hire.amount} set={t => setF(p => ({ ...p, hire: { ...p.hire, amount: t } }))} num />,
            <Fld l="Advance Paid ₹" v={f.hire.advance} set={t => setF(p => ({ ...p, hire: { ...p.hire, advance: t } }))} num />
          )}
          <Text style={{ fontSize: 10.5, color: C.mut }}>
            {(f.hire.payments && f.hire.payments.length)
              ? 'Balance payments so far: ' + f.hire.payments.length + '. Current balance: ' + inr(lrHireBalance({ hire: f.hire })) + '. Record further payments from the LR register.'
              : 'Balance payments are recorded later from the LR register (+ Hire Pay). Advance posts to Accounting under "Hired Vehicle / Subcontractor".'}
          </Text>
        </Card>
      ) : null}

      <Card title="Invoice & E-Way Bill">
        {half(<Fld l="Invoice No" v={f.invoiceNo} set={set('invoiceNo')} />, <Fld l="Invoice Amount ₹" v={f.invAmount} set={set('invAmount')} num />)}
        {half(<Fld l="Invoice Date" v={f.invoiceDate} set={set('invoiceDate')} />, <Fld l="P.O. Date" v={f.poDate} set={set('poDate')} />)}
        <Fld l="E-Way Bill No" v={f.ewayBillNo} set={set('ewayBillNo')} />
        {half(<Fld l="E-Way Bill Date" v={f.ewayBillDate} set={set('ewayBillDate')} />, <Fld l="E-Way Expiry Date" v={f.ewayExDate} set={set('ewayExDate')} />)}
      </Card>

      <Card title="Shipment Details">
        {half(<Fld l="Method of Packing" v={f.packing} set={set('packing')} />, <Fld l="Lorry Type" v={f.lorryType} set={set('lorryType')} />)}
        {half(<Fld l="Private Mark" v={f.privateMark} set={set('privateMark')} />, <Fld l="Insurance" v={f.insurance} set={set('insurance')} />)}
        <Chips l="LR Mode" v={f.lrMode} set={set('lrMode')} opts={['Door Delivery', 'Godown Delivery', 'Direct Delivery']} />
        <Fld l="Delivery Address" v={f.deliveryAddress} set={set('deliveryAddress')} multi />
        <Chips l="Billing Party" v={f.billingParty} set={set('billingParty')} opts={['Consignor', 'Consignee', 'Third Party']} />
        <Chips l="GST Paid By" v={f.gstPaidBy} set={set('gstPaidBy')} opts={['Consignor', 'Consignee', 'Transporter']} />
        <Chips l="GST Slab" v={f.gstSlab} set={set('gstSlab')} opts={['Exempt (RCM)', '0%', '5%', '12%', '18%']} />
        <Chips l="Payment Terms" v={f.payTerms} set={set('payTerms')} opts={['PAID', 'TO PAY', 'TO BE BILLED']} />
        {half(<Fld l="Agent" v={f.agent} set={set('agent')} />, <Fld l="To Be Billed At" v={f.billedAt} set={set('billedAt')} />)}
      </Card>

      <Party label="CONSIGNOR" p={f.consignor} setP={p => setF(x => ({ ...x, consignor: p }))} clients={db.clients} color={C.navy3} />
      <Party label="CONSIGNEE" p={f.consignee} setP={p => setF(x => ({ ...x, consignee: p }))} clients={db.clients} color={C.amberD} />
      <Party label="BILLING TO" p={f.billingTo} setP={p => setF(x => ({ ...x, billingTo: p }))} clients={db.clients} color={C.green} />

      <Card title="Goods Details">
        {f.goods.map((g, i) => (
          <View key={i} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginBottom: 10 }}>
            <Fld l={'Description ' + (i + 1)} v={g.desc} set={t => setGoods(i, 'desc', t)} />
            <Chips l="Pkgs Type" v={g.pkgType} set={t => setGoods(i, 'pkgType', t)} opts={PKG_TYPES} />
            {half(<Fld l="Pcs" v={g.pcs} set={t => setGoods(i, 'pcs', t)} num />, <Fld l="Actual Weight" v={g.aw} set={t => setGoods(i, 'aw', t)} num />)}
            {half(
              <Fld l="Charged Weight" v={g.cw} set={t => setGoods(i, 'cw', t)} num />,
              <View style={[S.row, { justifyContent: 'space-between' }]}>
                <View style={{ width: '31%' }}><Fld l="L" v={g.l} set={t => setGoods(i, 'l', t)} num /></View>
                <View style={{ width: '31%' }}><Fld l="W" v={g.w} set={t => setGoods(i, 'w', t)} num /></View>
                <View style={{ width: '31%' }}><Fld l="H" v={g.h} set={t => setGoods(i, 'h', t)} num /></View>
              </View>
            )}
            {f.goods.length > 1 ? <Btn small tone="red" label="Remove Row" onPress={() => setF(x => ({ ...x, goods: x.goods.filter((_, j) => j !== i) }))} /> : null}
          </View>
        ))}
        <View style={[S.row, { justifyContent: 'space-between', marginTop: 4 }]}>
          <Btn small tone="ghost" label="+ Add Goods Row" onPress={() => setF(x => ({ ...x, goods: [...x.goods, { desc: '', pkgType: '', pcs: '', aw: '', cw: '', l: '', w: '', h: '' }] }))} />
          <Text style={{ fontSize: 12, fontWeight: '800', color: C.navy }}>A.Wt {wt.aw || 0} · C.Wt {wt.cw || 0}</Text>
        </View>
      </Card>

      <Card title="LR Expenses (auto-posts to Accounting)">
        {(f.expenses || []).map((e, i) => (
          <View key={i} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginBottom: 10 }}>
            <Chips l="Account" v={e.account} set={t => setExp(i, 'account', t)} opts={EXP_HEADS.slice(0, 8)} />
            {half(<Fld l="Amount ₹" v={e.amount} set={t => setExp(i, 'amount', t)} num />, <Fld l="Remarks" v={e.remarks} set={t => setExp(i, 'remarks', t)} />)}
            <Btn small tone="red" label="Remove" onPress={() => setF(x => ({ ...x, expenses: x.expenses.filter((_, j) => j !== i) }))} />
          </View>
        ))}
        <Btn small tone="ghost" label="+ Add Expense Row" onPress={() => setF(x => ({ ...x, expenses: [...(x.expenses || []), { account: EXP_HEADS[6], amount: '', remarks: '' }] }))} />
      </Card>

      <Card title="Remarks & Staff">
        <Fld l="Remark" v={f.remark} set={set('remark')} multi />
        {half(<Fld l="Employee" v={f.employee} set={set('employee')} />, <Fld l="Truck Driver No" v={f.driverNo} set={set('driverNo')} />)}
      </Card>

      <Card title="Charges">
        {half(<Fld l="Above %" v={f.charges.abovePct} set={setCh('abovePct')} num />, <Fld l="Above — Charge ₹" v={f.charges.aboveCh} set={setCh('aboveCh')} num />)}
        {half(<Fld l="Below %" v={f.charges.belowPct} set={setCh('belowPct')} num />, <Fld l="Below — Charge ₹" v={f.charges.belowCh} set={setCh('belowCh')} num />)}
        <Fld l="Rate" v={f.charges.rate} set={setCh('rate')} num />
        {LR_CHG.reduce((rows, c, i) => {
          if (i % 2 === 0) rows.push([c]); else rows[rows.length - 1].push(c);
          return rows;
        }, []).map((pair, i) => (
          <View key={i} style={[S.row, { justifyContent: 'space-between' }]}>
            <View style={{ width: '48.5%' }}><Fld l={pair[0][1] + ' ₹'} v={f.charges[pair[0][0]]} set={setCh(pair[0][0])} num /></View>
            <View style={{ width: '48.5%' }}>{pair[1] ? <Fld l={pair[1][1] + ' ₹'} v={f.charges[pair[1][0]]} set={setCh(pair[1][0])} num /> : null}</View>
          </View>
        ))}
        <View style={{ backgroundColor: C.bg, borderRadius: 8, padding: 12, marginTop: 6 }}>
          <View style={[S.row, { justifyContent: 'space-between' }]}>
            <Text style={{ fontWeight: '800', color: C.navy }}>SUB TOTAL</Text>
            <Text style={{ fontWeight: '800', color: C.navy }}>{inr(totals.subTotal)}</Text>
          </View>
          {half(<Fld l="IGST %" v={f.igstPct} set={set('igstPct')} num />, <View style={{ paddingTop: 18 }}><Text style={{ fontWeight: '700', color: C.txt }}>{inr(totals.igstAmt)}</Text></View>)}
          {half(<Fld l="CGST %" v={f.cgstPct} set={set('cgstPct')} num />, <View style={{ paddingTop: 18 }}><Text style={{ fontWeight: '700', color: C.txt }}>{inr(totals.cgstAmt)}</Text></View>)}
          {half(<Fld l="SGST %" v={f.sgstPct} set={set('sgstPct')} num />, <View style={{ paddingTop: 18 }}><Text style={{ fontWeight: '700', color: C.txt }}>{inr(totals.sgstAmt)}</Text></View>)}
          <View style={[S.row, { justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: C.amber, paddingTop: 8, marginTop: 4 }]}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.navy }}>GROSS AMOUNT</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.navy }}>{inr(totals.gross)}</Text>
          </View>
        </View>
      </Card>

      <View style={[S.wrapRow, { justifyContent: 'flex-end', marginBottom: 30 }]}>
        <Btn label="Cancel" tone="ghost" onPress={() => navigation.goBack()} />
        <Btn label="Save LR" onPress={() => save(false)} />
        <Btn label="Save & Print" tone="amber" onPress={() => save(true)} />
      </View>
    </ScrollView>
  );
}
