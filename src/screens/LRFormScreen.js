import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Linking } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Btn, DatePicker, PickerField, alert } from '../ui';
import { printHtml } from '../fileIO';
import { getLogoDataUri } from '../logoAsset';
import {
  uid, inr, fmtDate, todayISO, byId, blankLR, computeLR, clientName, vendorName, mailLink,
  truckToVehicleId, lrHireBalance, convertInquiryToLRDraft, lrHtml,
  LR_CHG, PKG_TYPES, EXP_HEADS
} from '../logic';

/* ---- small local form primitives ----
   Compact grid layout: fields flow into as many columns as comfortably fit
   (up to `max`, default 4), collapsing to fewer/1 column on narrow screens —
   same responsive technique already used by DashboardScreen's KpiRow. */
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

/* Numeric fields get their own always-visible up/down stepper (drawn ourselves,
   not the browser's native number-input spinner — that one only appears on
   hover in most browsers and its own box height doesn't match the rest of the
   form's fields). Built on the same TextInput as every other field, so height
   and border are guaranteed identical to the fields around it. */
function NumBox({ value, onChangeText, style, placeholder }) {
  const strVal = value == null ? '' : String(value);
  const step = (dir) => {
    const cur = Number(strVal) || 0;
    const next = Math.round((cur + dir) * 100) / 100;
    onChangeText(String(next));
  };
  return (
    <View style={{ position: 'relative', justifyContent: 'center' }}>
      <TextInput
        value={strVal}
        onChangeText={t => onChangeText(t.replace(/[^0-9.\-]/g, ''))}
        keyboardType="numeric" placeholder={placeholder} placeholderTextColor={C.line2}
        style={[style, { paddingRight: 22 }]}
      />
      <View style={{ position: 'absolute', right: 1, top: 1, bottom: 1, width: 20, borderLeftWidth: 1, borderLeftColor: C.line2, justifyContent: 'center' }}>
        <TouchableOpacity onPress={() => step(1)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 8, lineHeight: 8, color: C.mut }}>▲</Text>
        </TouchableOpacity>
        <View style={{ height: 1, backgroundColor: C.line2 }} />
        <TouchableOpacity onPress={() => step(-1)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 8, lineHeight: 8, color: C.mut }}>▼</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Fld({ l, v, set, num, multi }) {
  const isDate = !multi && l.indexOf('Date') >= 0;
  const boxStyle = {
    borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7,
    fontSize: 13, color: C.txt, backgroundColor: '#fff', minHeight: multi ? 56 : undefined, width: '100%'
  };
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginBottom: 4 }}>{l}</Text>
      {isDate ? (
        <DatePicker value={v == null ? '' : String(v)} onChange={set} />
      ) : num ? (
        <NumBox value={v} onChangeText={set} style={boxStyle} />
      ) : (
        <TextInput value={v == null ? '' : String(v)} onChangeText={set} multiline={!!multi}
          placeholderTextColor={C.line2} style={boxStyle} />
      )}
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
function Party({ label, p, setP, clients }) {
  /* "Quick Fill" — pick any client from the full master list to auto-populate this
     party's Name/City/Contact/GST, instead of a handful of chips that only ever showed
     the first 4 clients and truncated their names (unusable once the client master has
     more than a few real companies in it). Mirrors the HTML build's <select> dropdown. */
  const fillFrom = (cid) => {
    const c = clients.find(x => x.id === cid);
    if (c) setP({ name: c.name, city: c.addr || '', contact: c.phone || '', pan: p.pan || '', gst: c.gstin || '' });
  };
  return (
    <Card title={label}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: C.mut, textTransform: 'uppercase', marginBottom: 4 }}>Quick Fill</Text>
      <View style={{ marginBottom: 10 }}>
        <PickerField
          value=""
          placeholder="— fill from client master —"
          options={clients.map(c => ({ v: c.id, l: c.name }))}
          onChange={fillFrom}
        />
      </View>
      <Fld l={label + ' Name *'} v={p.name} set={t => setP({ ...p, name: t })} />
      <Grid min={160}>
        <Fld l="City" v={p.city} set={t => setP({ ...p, city: t })} />
        <Fld l="Contact" v={p.contact} set={t => setP({ ...p, contact: t })} />
        <Fld l="PAN" v={p.pan} set={t => setP({ ...p, pan: t })} />
        <Fld l="GST" v={p.gst} set={t => setP({ ...p, gst: t })} />
      </Grid>
    </Card>
  );
}

/* GST Slab -> auto-derived tax %. Kept as a single-bucket (IGST) auto-fill so the
   existing separate IGST/CGST/SGST % fields stay exactly as they were (still
   manually editable/overridable) — this just removes the need to hand-type the
   percentage after picking a slab. */
const GST_SLAB_PCT = { 'Exempt (RCM)': 0, '0%': 0, '5%': 5, '12%': 12, '18%': 18 };

export default function LRFormScreen({ navigation, route }) {
  const { db, update } = useStore();
  const params = route.params || {};
  const editing = params.lrId ? byId(db.lrs, params.lrId) : null;
  const booking = params.bookingId ? byId(db.bookings, params.bookingId) : null;
  const inquiry = params.inquiryId ? byId(db.inquiries, params.inquiryId) : null;

  const [f, setF] = useState(() => {
    if (editing) return JSON.parse(JSON.stringify(editing));
    let l;
    if (inquiry) {
      l = convertInquiryToLRDraft(db, inquiry);
      l.lrNo = db.company.lrPrefix + String(db.seq.lr).padStart(4, '0');
      if (!l.goods.length) l.goods = [{ desc: '', pkgType: '', pcs: '', aw: '', cw: '', l: '', w: '', h: '' }];
    } else {
      l = blankLR();
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
    }
    /* New LRs auto-calculate GST @ 18% out of the box (still fully editable below —
       change the GST Slab chip or the %/amount fields directly to override). Editing
       an existing saved LR is untouched: its own stored rates are used as-is. */
    if (!l.gstSlab || l.gstSlab === 'Exempt (RCM)') {
      l.gstSlab = '18%'; l.igstPct = '18'; l.cgstPct = '0'; l.sgstPct = '0';
    }
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
  const setGstSlab = (slab) => {
    const pct = GST_SLAB_PCT[slab] != null ? GST_SLAB_PCT[slab] : 0;
    setF(p => ({ ...p, gstSlab: slab, igstPct: String(pct), cgstPct: '0', sgstPct: '0' }));
  };

  const totals = useMemo(() => computeLR(f.charges, f.igstPct, f.cgstPct, f.sgstPct), [f.charges, f.igstPct, f.cgstPct, f.sgstPct]);
  const wt = useMemo(() => {
    let aw = 0, cw = 0;
    f.goods.forEach(g => { aw += Number(g.aw) || 0; cw += Number(g.cw) || 0; });
    return { aw, cw };
  }, [f.goods]);

  /* Email notification on new-LR save. Sends automatically via a Vercel
     serverless function (api/notify-lr.js, Gmail SMTP server-side — see that
     file for the required env vars) so info@bgts.in gets the email without
     anyone having to click Send. If that call fails for any reason (env vars
     not added yet, function unreachable, etc.) this falls back to the old
     mailto:-link compose-window approach so the notification still has a
     path to go out, just manually. Only fires for a brand-new LR (not on
     edits), and only after the save succeeded. */
  const emailNewLR = async (rec) => {
    const goodsDesc = (rec.goods || []).map(g => g.desc).filter(Boolean).join(', ') || '—';
    const gstTotal = (Number(rec.igstAmt) || 0) + (Number(rec.cgstAmt) || 0) + (Number(rec.sgstAmt) || 0);
    const body = 'A new LR has been created in BGTS-OS.\n\n'
      + 'LR No: ' + rec.lrNo + '\n'
      + 'Date: ' + fmtDate(rec.date) + '\n'
      + 'Truck No: ' + (rec.truckNo || '—') + '\n'
      + 'From Place: ' + (rec.fromPlace || '—') + '\n'
      + 'To Place: ' + (rec.toPlace || '—') + '\n'
      + 'Consignor: ' + ((rec.consignor || {}).name || '—') + '\n'
      + 'Consignee: ' + ((rec.consignee || {}).name || '—') + '\n'
      + 'Goods Details: ' + goodsDesc + '\n'
      + 'Actual Weight: ' + (rec.aWeight || '0') + '\n'
      + 'Charged Weight: ' + (rec.cWeight || '0') + '\n'
      + 'Sub Total: ' + inr(rec.subTotal) + '\n'
      + 'GST: ' + inr(gstTotal) + '\n'
      + 'Gross Amount: ' + inr(rec.gross) + '\n\n'
      + '— Sent automatically by BGTS-OS';
    const subject = 'New LR Created — ' + rec.lrNo;
    try {
      const res = await fetch('/api/notify-lr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, text: body })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || ('HTTP ' + res.status));
      }
      /* sent automatically — nothing further needed */
    } catch (e) {
      /* Fall back to the manual mailto: draft so the notification isn't lost,
         and let the user know the automatic path didn't work this time. */
      Linking.openURL(mailLink('info@bgts.in', subject, body)).catch(() => {});
      alert('Auto-email not sent', 'Could not send the notification automatically (' + String(e.message || e) + '). Opened a mail draft instead — the LR itself was saved successfully either way.');
    }
  };

  const save = (andPrint) => {
    const req = [[f.truckNo, 'Truck No'], [f.lrNo, 'LR No'], [f.date, 'Date'], [f.fromPlace, 'From Place'], [f.toPlace, 'To Place'], [f.consignor.name, 'Consignor Name'], [f.consignee.name, 'Consignee Name']];
    for (const [v, l] of req) { if (!String(v || '').trim()) { alert('Missing field', l + ' is required.'); return; } }
    if (f.ownership === 'Hired' && !f.hire.vendorId) { alert('Missing field', 'Select the Hire Vendor for a Hired-vehicle LR (Masters → Vendors).'); return; }
    if (db.lrs.some(l => l.lrNo === f.lrNo && l.id !== f.id)) { alert('Duplicate', 'LR No ' + f.lrNo + ' already exists.'); return; }
    const isNew = !f.id;
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
      getLogoDataUri()
        .then(logoUri => printHtml(lrHtml(db, savedRec, logoUri), savedRec.lrNo))
        .catch(e => alert('PDF error', String(e.message || e)));
    }
    if (isNew && savedRec) emailNewLR(savedRec);
    navigation.goBack();
  };

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <Card title={editing ? 'Edit LR — ' + editing.lrNo : 'ADD NEW LR' + (booking ? '  (from ' + booking.bkNo + ')' : '')}>
        <Grid min={220} max={2}>
          <Chips l="LR Type *" v={f.lrType} set={set('lrType')} opts={['ORIGINAL', 'DUMMY']} />
          <Chips l="Vehicle Ownership *" v={f.ownership} set={set('ownership')} opts={['Owned', 'Hired']} />
        </Grid>
        <Text style={{ fontSize: 10.5, color: C.mut, marginTop: -6, marginBottom: 8 }}>
          Owned → add trip expenses against this LR later. Hired → hire advance & balance tracked below (internal — never prints on the LR).
        </Text>
        <Grid min={200}>
          <Fld l="Truck No *" v={f.truckNo} set={set('truckNo')} />
          <Fld l="LR No *" v={f.lrNo} set={set('lrNo')} />
          <Fld l="Date *" v={f.date} set={set('date')} />
          <Fld l="To Branch" v={f.toBranch} set={set('toBranch')} />
        </Grid>
        <Chips l="Booking Branch" v={f.bookingBranch} set={set('bookingBranch')} opts={(db.branches || []).map(b => b.name)} />
        <Grid min={220}>
          <Fld l="From Place *" v={f.fromPlace} set={set('fromPlace')} />
          <Fld l="To Place *" v={f.toPlace} set={set('toPlace')} />
        </Grid>
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
          <Grid min={200}>
            <Fld l="Lorry Hire ₹" v={f.hire.amount} set={t => setF(p => ({ ...p, hire: { ...p.hire, amount: t } }))} num />
            <Fld l="Advance Paid ₹" v={f.hire.advance} set={t => setF(p => ({ ...p, hire: { ...p.hire, advance: t } }))} num />
          </Grid>
          <Text style={{ fontSize: 10.5, color: C.mut }}>
            {(f.hire.payments && f.hire.payments.length)
              ? 'Balance payments so far: ' + f.hire.payments.length + '. Current balance: ' + inr(lrHireBalance({ hire: f.hire })) + '. Record further payments from the LR register.'
              : 'Balance payments are recorded later from the LR register (+ Hire Pay). Advance posts to Accounting under "Hired Vehicle / Subcontractor".'}
          </Text>
        </Card>
      ) : null}

      <Card title="Invoice & E-Way Bill">
        <Grid min={190}>
          <Fld l="Invoice No" v={f.invoiceNo} set={set('invoiceNo')} />
          <Fld l="Invoice Amount ₹" v={f.invAmount} set={set('invAmount')} num />
          <Fld l="Invoice Date" v={f.invoiceDate} set={set('invoiceDate')} />
          <Fld l="P.O. Date" v={f.poDate} set={set('poDate')} />
          <Fld l="E-Way Bill No" v={f.ewayBillNo} set={set('ewayBillNo')} />
          <Fld l="E-Way Bill Date" v={f.ewayBillDate} set={set('ewayBillDate')} />
          <Fld l="E-Way Expiry Date" v={f.ewayExDate} set={set('ewayExDate')} />
        </Grid>
      </Card>

      <Card title="Shipment Details">
        <Grid min={190}>
          <Fld l="Method of Packing" v={f.packing} set={set('packing')} />
          <Fld l="Lorry Type" v={f.lorryType} set={set('lorryType')} />
          <Fld l="Private Mark" v={f.privateMark} set={set('privateMark')} />
          <Fld l="Insurance" v={f.insurance} set={set('insurance')} />
          <Fld l="Agent" v={f.agent} set={set('agent')} />
          <Fld l="To Be Billed At" v={f.billedAt} set={set('billedAt')} />
        </Grid>
        <Chips l="LR Mode" v={f.lrMode} set={set('lrMode')} opts={['Door Delivery', 'Godown Delivery', 'Direct Delivery']} />
        <Fld l="Delivery Address" v={f.deliveryAddress} set={set('deliveryAddress')} multi />
        <Grid min={220} max={2}>
          <Chips l="Billing Party" v={f.billingParty} set={set('billingParty')} opts={['Consignor', 'Consignee', 'Third Party']} />
          <Chips l="GST Paid By" v={f.gstPaidBy} set={set('gstPaidBy')} opts={['Consignor', 'Consignee', 'Transporter']} />
        </Grid>
        <Grid min={220} max={2}>
          <Chips l="GST Slab" v={f.gstSlab} set={setGstSlab} opts={['Exempt (RCM)', '0%', '5%', '12%', '18%']} />
          <Chips l="Payment Terms" v={f.payTerms} set={set('payTerms')} opts={['PAID', 'TO PAY', 'TO BE BILLED']} />
        </Grid>
      </Card>

      <Card title="Goods Details">
        {f.goods.map((g, i) => (
          <View key={i} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginBottom: 10 }}>
            <Fld l={'Description ' + (i + 1)} v={g.desc} set={t => setGoods(i, 'desc', t)} />
            <Chips l="Pkgs Type" v={g.pkgType} set={t => setGoods(i, 'pkgType', t)} opts={PKG_TYPES} />
            <Grid min={110} max={6}>
              <Fld l="Pcs" v={g.pcs} set={t => setGoods(i, 'pcs', t)} num />
              <Fld l="Actual Weight" v={g.aw} set={t => setGoods(i, 'aw', t)} num />
              <Fld l="Charged Weight" v={g.cw} set={t => setGoods(i, 'cw', t)} num />
              <Fld l="L" v={g.l} set={t => setGoods(i, 'l', t)} num />
              <Fld l="W" v={g.w} set={t => setGoods(i, 'w', t)} num />
              <Fld l="H" v={g.h} set={t => setGoods(i, 'h', t)} num />
            </Grid>
            {f.goods.length > 1 ? <Btn small tone="red" label="Remove Row" onPress={() => setF(x => ({ ...x, goods: x.goods.filter((_, j) => j !== i) }))} /> : null}
          </View>
        ))}
        <View style={[S.row, { justifyContent: 'space-between', marginTop: 4 }]}>
          <Btn small tone="ghost" label="+ Add Goods Row" onPress={() => setF(x => ({ ...x, goods: [...x.goods, { desc: '', pkgType: '', pcs: '', aw: '', cw: '', l: '', w: '', h: '' }] }))} />
          <Text style={{ fontSize: 12, fontWeight: '800', color: C.navy }}>A.Wt {wt.aw || 0} · C.Wt {wt.cw || 0}</Text>
        </View>
      </Card>

      <Party label="CONSIGNOR" p={f.consignor} setP={p => setF(x => ({ ...x, consignor: p }))} clients={db.clients} color={C.navy3} />
      <Party label="CONSIGNEE" p={f.consignee} setP={p => setF(x => ({ ...x, consignee: p }))} clients={db.clients} color={C.amberD} />
      <Party label="BILLING TO" p={f.billingTo} setP={p => setF(x => ({ ...x, billingTo: p }))} clients={db.clients} color={C.green} />

      <Card title="Charges">
        <Grid min={175}>
          <Fld l="Above %" v={f.charges.abovePct} set={setCh('abovePct')} num />
          <Fld l="Above — Charge ₹" v={f.charges.aboveCh} set={setCh('aboveCh')} num />
          <Fld l="Below %" v={f.charges.belowPct} set={setCh('belowPct')} num />
          <Fld l="Below — Charge ₹" v={f.charges.belowCh} set={setCh('belowCh')} num />
          <Fld l="Rate" v={f.charges.rate} set={setCh('rate')} num />
          {LR_CHG.map(c => (
            <Fld key={c[0]} l={c[1] + ' ₹'} v={f.charges[c[0]]} set={setCh(c[0])} num />
          ))}
        </Grid>

        <View style={{ backgroundColor: C.bg, borderRadius: 8, padding: 12, marginTop: 6 }}>
          <View style={[S.row, { justifyContent: 'space-between' }]}>
            <Text style={{ fontWeight: '800', color: C.navy }}>SUB TOTAL</Text>
            <Text style={{ fontWeight: '800', color: C.navy }}>{inr(totals.subTotal)}</Text>
          </View>
          <Grid min={140} max={3}>
            <Fld l="IGST %" v={f.igstPct} set={set('igstPct')} num />
            <Fld l="CGST %" v={f.cgstPct} set={set('cgstPct')} num />
            <Fld l="SGST %" v={f.sgstPct} set={set('sgstPct')} num />
          </Grid>
          <View style={[S.wrapRow, { justifyContent: 'space-between', marginBottom: 4 }]}>
            <Text style={{ fontSize: 11.5, color: C.mut }}>IGST Amount: <Text style={{ fontWeight: '800', color: C.txt }}>{inr(totals.igstAmt)}</Text></Text>
            <Text style={{ fontSize: 11.5, color: C.mut }}>CGST Amount: <Text style={{ fontWeight: '800', color: C.txt }}>{inr(totals.cgstAmt)}</Text></Text>
            <Text style={{ fontSize: 11.5, color: C.mut }}>SGST Amount: <Text style={{ fontWeight: '800', color: C.txt }}>{inr(totals.sgstAmt)}</Text></Text>
          </View>
          <View style={[S.row, { justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: C.amber, paddingTop: 8, marginTop: 4 }]}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.navy }}>GROSS AMOUNT</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.navy }}>{inr(totals.gross)}</Text>
          </View>
        </View>
      </Card>

      <Card title="LR Expenses (auto-posts to Accounting)">
        {(f.expenses || []).map((e, i) => (
          <View key={i} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginBottom: 10 }}>
            <Chips l="Account" v={e.account} set={t => setExp(i, 'account', t)} opts={EXP_HEADS.slice(0, 8)} />
            <Grid min={190}>
              <Fld l="Amount ₹" v={e.amount} set={t => setExp(i, 'amount', t)} num />
              <Fld l="Remarks" v={e.remarks} set={t => setExp(i, 'remarks', t)} />
            </Grid>
            <Btn small tone="red" label="Remove" onPress={() => setF(x => ({ ...x, expenses: x.expenses.filter((_, j) => j !== i) }))} />
          </View>
        ))}
        <Btn small tone="ghost" label="+ Add Expense Row" onPress={() => setF(x => ({ ...x, expenses: [...(x.expenses || []), { account: EXP_HEADS[6], amount: '', remarks: '' }] }))} />
      </Card>

      <Card title="Remarks & Staff">
        <Fld l="Remark" v={f.remark} set={set('remark')} multi />
        <Grid min={190}>
          <Fld l="Employee" v={f.employee} set={set('employee')} />
          <Fld l="Truck Driver No" v={f.driverNo} set={set('driverNo')} />
        </Grid>
      </Card>

      <View style={[S.wrapRow, { justifyContent: 'flex-end', marginBottom: 30 }]}>
        <Btn label="Cancel" tone="ghost" onPress={() => navigation.goBack()} />
        <Btn label="Save LR" onPress={() => save(false)} />
        <Btn label="Save & Print" tone="amber" onPress={() => save(true)} />
      </View>
    </ScrollView>
  );
}
