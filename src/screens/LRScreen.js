import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo, Table, alert, PickerField, DatePicker } from '../ui';
import { downloadFile, printHtml } from '../fileIO';
import { getLogoDataUri } from '../logoAsset';
import {
  uid, inr, fmtDate, todayISO, byId, removeById, lrHtml, vendorName, csvString,
  lrHireBalance, lrTripExpTotal, truckToVehicleId, TRIP_EXP_CATS, sum,
  importLegacyLRs, LEGACY_LRS
} from '../logic';

/* ---------- LR Register filter bar (from bgts-os-app_8.html's lrFilterBar/lrMatches) ---------- */
function FilterField({ label, grow, children }) {
  return (
    <View style={{ minWidth: grow ? 200 : 140, flexGrow: grow ? 1 : 0, gap: 4 }}>
      <Text style={{ fontSize: 9.5, fontWeight: '800', color: C.mut, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</Text>
      {children}
    </View>
  );
}

export default function LRScreen({ navigation }) {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);
  const [flt, setFlt] = useState({ from: '', to: '', company: '', branchId: '', q: '', sort: 'desc' });
  const setF = (k, v) => setFlt(prev => ({ ...prev, [k]: v }));
  const resetFilter = () => setFlt({ from: '', to: '', company: '', branchId: '', q: '', sort: 'desc' });

  const companyOptions = (() => {
    const set = {};
    db.lrs.forEach(l => { const n = (l.consignor || {}).name; if (n) set[n] = 1; });
    db.clients.forEach(c => { set[c.name] = 1; });
    return Object.keys(set).sort();
  })();

  const lrMatches = (l) => {
    if (flt.from && String(l.date) < flt.from) return false;
    if (flt.to && String(l.date) > flt.to) return false;
    if (flt.company && String((l.consignor || {}).name || '').toLowerCase() !== flt.company.toLowerCase()) return false;
    if (flt.branchId && l.branchId !== flt.branchId) return false;
    if (flt.q) {
      const q = flt.q.toLowerCase();
      const hay = (l.lrNo + ' ' + l.truckNo + ' ' + l.fromPlace + ' ' + l.toPlace + ' ' + ((l.consignor || {}).name || '') + ' ' + ((l.consignee || {}).name || '')).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  };

  const totalLRCount = db.lrs.length;
  const list = db.lrs.slice().filter(lrMatches).sort((a, b) => {
    const d = String(a.date) < String(b.date) ? -1 : (String(a.date) > String(b.date) ? 1 : 0);
    if (d !== 0) return flt.sort === 'asc' ? d : -d;
    /* Same date: always show the most recently created LR first regardless of the
       date-order toggle, so a brand-new LR surfaces immediately at the top of its
       date group instead of landing wherever the stable date-only sort leaves it. */
    return String(b.id).localeCompare(String(a.id));
  });
  const listGross = sum(list, l => l.gross);

  const doImportLegacyLRs = () => update(d => {
    const added = importLegacyLRs(d);
    setTimeout(() => alert('LR register imported', added + ' LR(s) added' + (added < LEGACY_LRS.length ? ', ' + (LEGACY_LRS.length - added) + ' already on file (skipped).' : '.')), 100);
  });

  const exportCsv = async () => {
    try {
      const rows = [['LR No', 'Type', 'Date', 'Truck', 'From', 'To', 'Booking Branch', 'Consignor', 'Consignee', 'Billing Party', 'Pay Terms', 'E-Way Bill', 'A Weight', 'C Weight', 'Sub Total', 'IGST', 'CGST', 'SGST', 'Gross', 'POD']];
      db.lrs.forEach(l => rows.push([l.lrNo, l.lrType, l.date, l.truckNo, l.fromPlace, l.toPlace, l.bookingBranch, (l.consignor || {}).name, (l.consignee || {}).name, l.billingParty, l.payTerms, l.ewayBillNo, l.aWeight, l.cWeight, l.subTotal, l.igstAmt, l.cgstAmt, l.sgstAmt, l.gross, l.pod ? 'Yes' : 'No']));
      await downloadFile('BGTS_LR_Register.csv', csvString(rows), 'text/csv');
    } catch (e) { alert('Error', String(e.message || e)); }
  };

  const sharePdf = async (l) => {
    try {
      const logoUri = await getLogoDataUri();
      await printHtml(lrHtml(db, l, logoUri), l.lrNo);
    } catch (e) {
      alert('PDF error', String(e.message || e));
    }
  };

  const markPOD = (l) => update(d => {
    const x = byId(d.lrs, l.id); if (!x) return;
    x.pod = true;
    if (x.bookingId) {
      const b = byId(d.bookings, x.bookingId);
      if (b) { b.podReceived = true; if (b.status === 'In Transit') b.status = 'Delivered'; }
    }
  });

  const del = (l) => confirmDo('Delete LR ' + l.lrNo + '? Linked postings (hire advance/payments, trip expenses) are removed too.', () => update(d => {
    const x = byId(d.lrs, l.id);
    if (x && x.bookingId) { const b = byId(d.bookings, x.bookingId); if (b) b.lrNo = ''; }
    d.acctExp = d.acctExp.filter(e => e.lrId !== l.id);
    d.expenses = d.expenses.filter(e => e.lrId !== l.id);
    removeById(d.lrs, l.id);
  }));

  const addHirePay = (l) => {
    const bal = lrHireBalance(l);
    setForm({
      title: 'Hire Payment — ' + l.lrNo + ' (' + vendorName(db, (l.hire || {}).vendorId) + ', balance ' + inr(bal) + ')',
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
        { key: 'amount', label: 'Amount ₹', type: 'number', required: true, value: bal > 0 ? bal : '' },
        { key: 'mode', label: 'Mode', type: 'select', required: true, value: 'NEFT/RTGS', options: ['NEFT/RTGS', 'UPI', 'Cash', 'Cheque'].map(x => ({ v: x, l: x })) },
        { key: 'ref', label: 'UTR / Ref' }
      ],
      onSubmit: (v) => update(d => {
        const x = byId(d.lrs, l.id); if (!x) return;
        const p = { id: uid('hp'), date: v.date, amount: Number(v.amount) || 0, mode: v.mode, ref: v.ref };
        x.hire.payments = x.hire.payments || [];
        x.hire.payments.push(p);
        d.acctExp.push({ id: 'hpay_' + p.id, lrId: x.id, branchId: x.branchId, date: p.date, account: 'Hired Vehicle / Subcontractor', amount: p.amount, paidThrough: (v.mode === 'Cash' ? 'Petty Cash' : 'Bank — Current A/c'), vendor: vendorName(d, x.hire.vendorId), ref: 'LR ' + x.lrNo + ' — hire balance payment', notes: v.ref || '', src: 'hire' });
      })
    });
  };

  const addTripExp = (l) => {
    let vid = l.vehicleId || truckToVehicleId(db, l.truckNo);
    if (!vid) { alert('No vehicle link', 'Truck ' + l.truckNo + ' does not match an OWNED vehicle in Masters. Add/correct the vehicle first so trip expenses hit vehicle-wise P&L.'); return; }
    setForm({
      title: 'Trip Expense — ' + l.lrNo + ' (' + l.truckNo + ')',
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
        { key: 'category', label: 'Category', type: 'select', required: true, value: 'Fuel', options: TRIP_EXP_CATS.map(x => ({ v: x, l: x })) },
        { key: 'amount', label: 'Amount ₹', type: 'number', required: true },
        { key: 'litres', label: 'Litres (fuel only)', type: 'number' },
        { key: 'notes', label: 'Notes', type: 'multiline' }
      ],
      onSubmit: (v) => update(d => {
        const x = byId(d.lrs, l.id); if (!x) return;
        if (!x.vehicleId) x.vehicleId = vid;
        const exp = { id: uid('e'), vehicleId: vid, lrId: x.id, date: v.date, category: v.category, amount: Number(v.amount) || 0, litres: v.litres, notes: (v.notes ? v.notes + ' · ' : '') + 'LR ' + x.lrNo };
        d.expenses.push(exp);
        x.tripExpenses = x.tripExpenses || [];
        x.tripExpenses.push({ expId: exp.id, date: v.date, category: v.category, amount: exp.amount });
      })
    });
  };

  const lrRow = (l) => {
    const hired = l.ownership === 'Hired';
    const bal = hired ? lrHireBalance(l) : 0;
    const te = !hired ? lrTripExpTotal(l) : 0;
    return {
      lrNo: (
        <View>
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{l.lrNo}</Text>
          <Badge text={hired ? 'HIRED' : 'OWNED'} tone={hired ? 'purple' : 'navy'} />
        </View>
      ),
      type: <Badge text={l.lrType} tone={l.lrType === 'DUMMY' ? 'amber' : 'green'} />,
      date: fmtDate(l.date),
      truck: l.truckNo,
      route: l.fromPlace + ' → ' + l.toPlace,
      parties: ((l.consignor || {}).name || '—') + ' → ' + ((l.consignee || {}).name || '—') + '\n' + l.payTerms,
      gross: <Text style={{ fontWeight: '800', color: C.navy }}>{inr(l.gross)}</Text>,
      hireOrExp: hired ? (
        <Text style={{ fontSize: 11.5, color: C.mut }}>
          {vendorName(db, (l.hire || {}).vendorId)} · Hire {inr((l.hire || {}).amount)}{'\n'}<Text style={{ fontWeight: '800', color: bal > 0 ? C.red : C.green }}>Bal {inr(bal)}</Text>
        </Text>
      ) : (
        <Text style={{ fontSize: 11.5, color: C.mut }}>
          {(l.tripExpenses && l.tripExpenses.length) ? l.tripExpenses.length + ' trip exp · ' + inr(te) : 'no trip exp yet'}
        </Text>
      ),
      pod: l.pod ? <Badge text="POD ✓" tone="green" /> : <Badge text="POD Pending" tone="red" />,
      actions: (
        <View style={S.wrapRow}>
          {hired && bal > 0 ? <Btn small tone="green" label="+ Hire Pay" onPress={() => addHirePay(l)} /> : null}
          {!hired ? <Btn small label="+ Trip Exp" onPress={() => addTripExp(l)} /> : null}
          <Btn small tone="ghost" label="Print" onPress={() => sharePdf(l)} />
          <Btn small tone="ghost" label="Edit" onPress={() => navigation.navigate('LRForm', { lrId: l.id })} />
          {!l.pod ? <Btn small tone="green" label="POD ✓" onPress={() => markPOD(l)} /> : null}
          <Btn small tone="red" label="✕" onPress={() => del(l)} />
        </View>
      )
    };
  };

  return (
    <View style={S.screen}>
      <View style={{ padding: 14, paddingBottom: 6, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <Btn label="Import ATTrans LR Register (42)" tone="ghost" onPress={doImportLegacyLRs} />
        <Btn label="Export CSV" tone="ghost" onPress={exportCsv} />
        <Btn label="⬆ Import CSV / Excel" onPress={() => navigation.navigate('LRImport')} />
        <Btn label="+ ADD NEW LR" tone="amber" onPress={() => navigation.navigate('LRForm', {})} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: 60 }}>
        <Card>
          <View style={{
            flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end',
            backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, marginBottom: 14
          }}>
            <FilterField label="From Date"><DatePicker value={flt.from} onChange={v => setF('from', v)} /></FilterField>
            <FilterField label="To Date"><DatePicker value={flt.to} onChange={v => setF('to', v)} /></FilterField>
            <FilterField label="Company">
              <PickerField value={flt.company} onChange={v => setF('company', v)} placeholder="All Companies"
                options={[{ v: '', l: 'All Companies' }, ...companyOptions.map(n => ({ v: n, l: n }))]} />
            </FilterField>
            <FilterField label="Location / Hub (Branch)">
              <PickerField value={flt.branchId} onChange={v => setF('branchId', v)} placeholder="All Locations"
                options={[{ v: '', l: 'All Locations' }, ...(db.branches || []).map(b => ({ v: b.id, l: b.name }))]} />
            </FilterField>
            <FilterField label="Date Order">
              <PickerField value={flt.sort} onChange={v => setF('sort', v)}
                options={[{ v: 'desc', l: 'Newest first (descending)' }, { v: 'asc', l: 'Oldest first (ascending)' }]} />
            </FilterField>
            <FilterField label="Search (LR No / Truck / Route / Party)" grow>
              <TextInput value={flt.q} onChangeText={v => setF('q', v)} placeholder="Type to search…" placeholderTextColor={C.mut}
                style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 7, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: C.txt }} />
            </FilterField>
            <Btn small tone="ghost" label="Reset" onPress={resetFilter} style={{ alignSelf: 'flex-end' }} />
          </View>
          {!list.length ? (
            <Empty text={totalLRCount ? 'No LRs match this search. Adjust the filters above, or click "+ ADD NEW LR".' : 'No LRs yet. Tap + ADD NEW LR.'} />
          ) : (<>
            <Text style={{ fontSize: 11.5, color: C.mut, marginBottom: 8 }}>{list.length} LR(s) · Gross {inr(listGross)}</Text>
            <Table
              cols={[
                { key: 'lrNo', label: 'LR No', width: 100 },
                { key: 'type', label: 'Type', width: 80 },
                { key: 'date', label: 'Date', width: 80 },
                { key: 'truck', label: 'Truck', width: 90 },
                { key: 'route', label: 'Route', width: 150 },
                { key: 'parties', label: 'Consignor → Consignee', width: 190 },
                { key: 'gross', label: 'Gross', width: 90 },
                { key: 'hireOrExp', label: 'Hire / Trip Exp', width: 150 },
                { key: 'pod', label: 'POD', width: 110 },
                { key: 'actions', label: 'Actions', width: 320 }
              ]}
              rows={list.map(lrRow)}
            />
          </>)}
        </Card>
      </ScrollView>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </View>
  );
}
