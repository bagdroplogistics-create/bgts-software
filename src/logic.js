/* BGTS-OS core business logic v2 — pure JS, no React Native imports.
   Shared data model with the web build (v1.2) + v2 additions: full LR entity,
   LHC (truck hire) with TDS 194C, driver advances, accounting expense heads. */

export function pad(n){ return (n < 10 ? '0' : '') + n; }
export function todayISO(){ const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function addDaysISO(n){ const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function daysTo(iso){ if (!iso) return null; const a = new Date(iso + 'T00:00:00'); const b = new Date(todayISO() + 'T00:00:00'); return Math.round((a - b) / 86400000); }
export function daysSince(iso){ const d = daysTo(iso); return d == null ? null : -d; }
export function fmtDate(iso){ if (!iso) return '—'; const p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }

export function inr(n){
  n = Math.round(Number(n) || 0);
  const neg = n < 0; let s = String(Math.abs(n));
  let last3 = s.slice(-3), rest = s.slice(0, -3);
  if (rest) last3 = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  return (neg ? '-₹' : '₹') + last3;
}
export function r2(x){ return Math.round((Number(x) || 0) * 100) / 100; }

export function uid(p){ return (p || 'x') + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
export function byId(arr, id){ for (let i = 0; i < arr.length; i++){ if (arr[i].id === id) return arr[i]; } return null; }
export function removeById(arr, id){ for (let i = 0; i < arr.length; i++){ if (arr[i].id === id){ arr.splice(i, 1); return; } } }
export function sum(arr, fn){ let t = 0; for (let i = 0; i < arr.length; i++){ t += Number(fn(arr[i])) || 0; } return t; }

export function clientName(db, id){ const c = byId(db.clients, id); return c ? c.name : '—'; }
export function vehicleReg(db, id){ const v = byId(db.vehicles, id); return v ? v.regNo : '—'; }
export function driverName(db, id){ const d = byId(db.drivers, id); return d ? d.name : '—'; }
export function vendorName(db, id){ const v = byId(db.vendors, id); return v ? v.name : '—'; }

export function waLink(phone, msg){
  const p = String(phone || '').replace(/[^0-9]/g, '');
  return 'https://wa.me/' + p + '?text=' + encodeURIComponent(msg);
}
export function csvString(rows){
  const cell = v => {
    v = String(v == null ? '' : v);
    if (v.indexOf('"') >= 0 || v.indexOf(',') >= 0 || v.indexOf('\n') >= 0) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  };
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n');
}

/* ---------- v2 constants ---------- */
export const EXP_HEADS = ['Fuel Expense', 'Toll & FASTag', 'Driver Salaries & Bhatta', 'Vehicle Repairs & Maintenance', 'Tyres & Spares', 'Vehicle Insurance & Permits', 'Loading & Unloading Charges', 'Hired Vehicle / Subcontractor', 'Warehouse Rent', 'Office & Admin', 'Telephone & Internet', 'Bank Fees and Charges', 'E-Way Bill / Compliance', 'Other Expenses'];
export const PAY_THROUGH = ['Bank — Current A/c', 'Petty Cash', 'UPI', 'Credit (payable)'];
export const LR_CHG = [['rateCh', 'RATE CHARGE'], ['freight', 'FREIGHT'], ['surcharge', 'SURCHARGE'], ['localCartage', 'LOCAL CARTAGE'], ['lastMile', 'LAST MILE FRT'], ['fov', 'FOV'], ['loading', 'LOADING'], ['unloading', 'UNLOADING'], ['handling', 'HANDLING'], ['gc', 'GC CHARGE'], ['other', 'OTHER'], ['ewayCh', 'E-WAY CHARGE'], ['aoc', 'AOC']];
export const PKG_TYPES = ['', 'BOX', 'BAG', 'BUNDLE', 'DRUM', 'ROLL', 'PALLET', 'LOOSE', 'CASE', 'OTHER'];

/* ---------- LR charge computation ---------- */
export function computeLR(ch, igstPct, cgstPct, sgstPct){
  const n = x => Number(x) || 0;
  let sub = n(ch.aboveCh) + n(ch.belowCh);
  LR_CHG.forEach(c => { sub += n(ch[c[0]]); });
  sub = r2(sub);
  const ig = r2(sub * n(igstPct) / 100), cg = r2(sub * n(cgstPct) / 100), sg = r2(sub * n(sgstPct) / 100);
  return { subTotal: sub, igstAmt: ig, cgstAmt: cg, sgstAmt: sg, gross: r2(sub + ig + cg + sg) };
}

/* ---------- LHC (Lorry Hire Contract) ---------- */
/* TDS u/s 194C: 1% individual/HUF, 2% others, 20% no-PAN — pct chosen by user, confirm with CA */
export function tdsAmount(base, pct){ return r2((Number(base) || 0) * (Number(pct) || 0) / 100); }
export function lhcPaid(l){ return sum(l.payments || [], p => p.amount); }
export function lhcBalance(l){
  return r2((Number(l.lorryHire) || 0) - (Number(l.advance) || 0) - (Number(l.deductions) || 0) - (Number(l.tdsAmt) || 0) - lhcPaid(l));
}
export function lhcStatus(l){
  const b = lhcBalance(l);
  if (b <= 0.01) return 'SETTLED';
  return lhcPaid(l) > 0 ? 'PART PAID' : 'OPEN';
}

/* ---------- database ---------- */
export function blankDB(){
  return {
    company: { name: 'Baroda Goods Transport Service Pvt. Ltd.', addr: 'Vadodara, Gujarat, India', gstin: '', phone: '', email: '', lrPrefix: 'BGTS/26-27/' },
    seq: { lr: 1, inv: 1, bk: 1, lhc: 1 },
    clients: [], vehicles: [], drivers: [], vendors: [], routes: [],
    contracts: [], bookings: [], expenses: [], renewals: [], invoices: [], payments: [],
    lrs: [], lhcs: [], advances: [], acctExp: []
  };
}

export function blankLR(){
  return {
    id: '', bookingId: '', lrType: 'ORIGINAL', truckNo: '', lrNo: '', date: todayISO(),
    bookingBranch: 'VADODARA', fromPlace: '', toPlace: '', toBranch: '',
    invoiceNo: '', invAmount: '', invoiceDate: '', ewayBillNo: '', ewayBillDate: '', ewayExDate: '', poDate: '',
    packing: '', lorryType: '', privateMark: '', lrMode: 'Door Delivery', deliveryAddress: '',
    billingParty: 'Consignor', gstPaidBy: 'Consignee', gstSlab: 'Exempt (RCM)', insurance: '', payTerms: 'TO BE BILLED',
    consignor: { name: '', city: '', contact: '', pan: '', gst: '' },
    consignee: { name: '', city: '', contact: '', pan: '', gst: '' },
    billingTo: { name: '', city: '', contact: '', pan: '', gst: '' },
    agent: '', billedAt: '', goods: [], aWeight: '', cWeight: '',
    expenses: [], remark: '', employee: '', driverNo: '',
    charges: { abovePct: '', aboveCh: '', belowPct: '', belowCh: '', rate: '', rateCh: '', freight: '', surcharge: '', localCartage: '', lastMile: '', fov: '', loading: '', unloading: '', handling: '', gc: '', other: '', ewayCh: '', aoc: '' },
    igstPct: '', cgstPct: '', sgstPct: '',
    subTotal: 0, igstAmt: 0, cgstAmt: 0, sgstAmt: 0, gross: 0, pod: false
  };
}

/* migrate: ensure v2 keys and convert booking-embedded LRs into LR records */
export function migrate(db){
  if (!db.lrs) db.lrs = [];
  if (!db.lhcs) db.lhcs = [];
  if (!db.advances) db.advances = [];
  if (!db.acctExp) db.acctExp = [];
  if (!db.seq.lhc) db.seq.lhc = 1;
  db.bookings.forEach(b => {
    if (b.lrNo && !db.lrs.some(l => l.bookingId === b.id)){
      const v = byId(db.vehicles, b.vehicleId);
      const lr = blankLR();
      lr.id = uid('lr'); lr.bookingId = b.id; lr.lrNo = b.lrNo; lr.date = b.date;
      lr.truckNo = b.assignType === 'Owned' ? (v ? v.regNo : '') : (b.hiredVehicleNo || '');
      lr.fromPlace = b.origin; lr.toPlace = b.destination; lr.lorryType = b.vehicleType || '';
      lr.ewayBillNo = b.ewayBill || '';
      lr.consignor = { name: clientName(db, b.clientId), city: '', contact: '', pan: '', gst: '' };
      lr.consignee = { name: b.lrConsignee || '', city: '', contact: '', pan: '', gst: b.lrConsigneeGstin || '' };
      if (b.cargo) lr.goods = [{ desc: b.cargo, pkgType: '', pcs: String(b.lrPkgs || ''), aw: String(b.weightMT || ''), cw: String(b.weightMT || ''), l: '', w: '', h: '' }];
      lr.aWeight = String(b.weightMT || ''); lr.cWeight = String(b.weightMT || '');
      lr.remark = b.lrRemarks || '';
      lr.charges.freight = String(Number(b.freight) || 0);
      const t = computeLR(lr.charges, 0, 0, 0);
      lr.subTotal = t.subTotal; lr.gross = t.gross;
      lr.pod = !!b.podReceived;
      db.lrs.push(lr);
    }
  });
  return db;
}

export function seedSample(db){
  db.clients.push(
    { id: 'c1', name: 'USHTA (Sample Client)', gstin: '24AAAAA0000A1Z5', phone: '919800000001', email: 'ops@sample-ushta.in', creditDays: 45, addr: 'Vadodara' },
    { id: 'c2', name: 'SMC (Sample Govt Client)', gstin: '24BBBBB0000B1Z5', phone: '919800000002', email: 'tender@sample-smc.gov.in', creditDays: 60, addr: 'Surat' }
  );
  db.vehicles.push(
    { id: 'v1', regNo: 'GJ19X6890', make: 'Tata Ultra 1518 Open', type: 'Open Body 18ft', owned: true, gvw: '18500', driverId: 'd1' },
    { id: 'v2', regNo: 'GJ06 (Sample) 1234', make: 'Eicher 19ft Container', type: 'Container 19ft', owned: true, gvw: '16000', driverId: 'd2' }
  );
  db.drivers.push(
    { id: 'd1', name: 'Sample Driver 1', phone: '919900000001', licNo: 'GJ-SAMPLE-001', licExpiry: addDaysISO(200) },
    { id: 'd2', name: 'Sample Driver 2', phone: '919900000002', licNo: 'GJ-SAMPLE-002', licExpiry: addDaysISO(45) }
  );
  db.vendors.push({ id: 've1', name: 'Sample Transport Vendor', phone: '919700000001', city: 'Vadodara', rating: 'A' });
  db.routes.push({ id: 'r1', origin: 'Vadodara', destination: 'Mumbai', km: 430 }, { id: 'r2', origin: 'Vadodara', destination: 'Ahmedabad', km: 110 });
  db.contracts.push({
    id: 'ct1', type: 'Annual Contract', clientId: 'c1', ref: 'USHTA/RC/SAMPLE',
    validFrom: addDaysISO(-100), validTo: addDaysISO(265), emd: '', bgExpiry: '',
    rates: [
      { origin: 'Vadodara', destination: 'Mumbai', vehicleType: 'Open Body 18ft', rate: 18500 },
      { origin: 'Vadodara', destination: 'Ahmedabad', vehicleType: 'Open Body 18ft', rate: 7200 }
    ]
  });
  db.renewals.push(
    { id: 'rn1', vehicleId: 'v1', docType: 'Insurance', ref: 'VGC1116112000101', expiry: '2026-03-01' },
    { id: 'rn2', vehicleId: 'v1', docType: 'Fitness', ref: '', expiry: addDaysISO(22) },
    { id: 'rn3', vehicleId: 'v2', docType: 'Permit (National)', ref: '', expiry: addDaysISO(75) },
    { id: 'rn4', vehicleId: 'v2', docType: 'PUC', ref: '', expiry: addDaysISO(9) }
  );
  const t = todayISO();
  db.bookings.push(
    { id: 'b1', bkNo: 'BK-0001', date: addDaysISO(-6), clientId: 'c1', origin: 'Vadodara', destination: 'Mumbai', mode: 'Road', vehicleType: 'Open Body 18ft', cargo: 'Industrial castings (sample)', weightMT: 14, freight: 18500, rateSource: 'Contract USHTA/RC/SAMPLE', assignType: 'Owned', vehicleId: 'v1', hiredVendorId: '', hiredVehicleNo: '', hireCost: 0, driverId: 'd1', status: 'Delivered', lrNo: 'BGTS/26-27/0001', ewayBill: '', podReceived: true, invoiceId: 'i1' },
    { id: 'b2', bkNo: 'BK-0002', date: addDaysISO(-2), clientId: 'c1', origin: 'Vadodara', destination: 'Ahmedabad', mode: 'Road', vehicleType: 'Open Body 18ft', cargo: 'Packaged goods (sample)', weightMT: 8, freight: 7200, rateSource: 'Contract USHTA/RC/SAMPLE', assignType: 'Hired', vehicleId: '', hiredVendorId: 've1', hiredVehicleNo: 'GJ01 (Sample) 9999', hireCost: 5600, driverId: '', status: 'In Transit', lrNo: 'BGTS/26-27/0002', ewayBill: '', podReceived: false, invoiceId: '' },
    { id: 'b3', bkNo: 'BK-0003', date: t, clientId: 'c2', origin: 'Vadodara', destination: 'Surat', mode: 'Road', vehicleType: 'Container 19ft', cargo: 'Tender consignment (sample)', weightMT: 10, freight: 9800, rateSource: 'Manual', assignType: '', vehicleId: '', hiredVendorId: '', hiredVehicleNo: '', hireCost: 0, driverId: '', status: 'Booked', lrNo: '', ewayBill: '', podReceived: false, invoiceId: '' }
  );
  db.seq.bk = 4; db.seq.lr = 3;
  db.expenses.push(
    { id: 'e1', vehicleId: 'v1', date: addDaysISO(-6), category: 'Fuel', amount: 5900, litres: 62, notes: 'Sample trip fuel' },
    { id: 'e2', vehicleId: 'v1', date: addDaysISO(-5), category: 'Toll/FASTag', amount: 1450, litres: '', notes: '' },
    { id: 'e3', vehicleId: 'v1', date: addDaysISO(-20), category: 'Maintenance', amount: 8200, litres: '', notes: 'Sample brake service' }
  );
  db.invoices.push({ id: 'i1', invNo: 'INV-0001', date: addDaysISO(-4), clientId: 'c1', bookingIds: ['b1'], amount: 18500, gstPct: 0, total: 18500, dueDate: addDaysISO(41), notes: 'Sample invoice' });
  db.seq.inv = 2;
  db.lhcs.push({
    id: 'lh1', lhcNo: 'LHC-0001', date: addDaysISO(-2), vendorId: 've1', truckNo: 'GJ01 (Sample) 9999',
    driverName: 'Market Driver (sample)', driverPhone: '', fromPlace: 'Vadodara', toPlace: 'Ahmedabad',
    lorryHire: 5600, advance: 2000, deductions: 0, tdsPct: 1, tdsAmt: 56, payments: [], lrNos: 'BGTS/26-27/0002', notes: 'Sample LHC'
  });
  db.seq.lhc = 2;
  db.advances.push({ id: 'ad1', driverId: 'd1', date: addDaysISO(-6), amount: 3000, purpose: 'Trip advance (sample)', settledAmount: 2500, settledAt: addDaysISO(-1) });
  return db;
}

/* ---------- finance ---------- */
export function invPaid(db, inv){ return sum(db.payments.filter(p => p.invoiceId === inv.id), p => p.amount); }
export function invOutstanding(db, inv){ return (Number(inv.total) || 0) - invPaid(db, inv); }

/* ---------- contract rate engine ---------- */
export function findContractRate(db, clientId, origin, destination, vehicleType){
  const t = todayISO(); let best = null;
  db.contracts.forEach(c => {
    if (c.clientId !== clientId) return;
    if (c.validFrom && c.validFrom > t) return;
    if (c.validTo && c.validTo < t) return;
    (c.rates || []).forEach(r => {
      if (String(r.origin).trim().toLowerCase() === String(origin).trim().toLowerCase() &&
          String(r.destination).trim().toLowerCase() === String(destination).trim().toLowerCase() &&
          (!r.vehicleType || !vehicleType || String(r.vehicleType).trim().toLowerCase() === String(vehicleType).trim().toLowerCase())) {
        best = { rate: Number(r.rate) || 0, ref: c.ref, type: c.type };
      }
    });
  });
  return best;
}

/* ---------- renewals ---------- */
export function allRenewalItems(db){
  const items = [];
  db.renewals.forEach(r => items.push({ id: r.id, kind: 'vehicle', label: r.docType, detail: vehicleReg(db, r.vehicleId), expiry: r.expiry, days: daysTo(r.expiry) }));
  db.drivers.forEach(d => { if (d.licExpiry) items.push({ id: d.id, kind: 'driver', label: 'Driving Licence', detail: d.name, expiry: d.licExpiry, days: daysTo(d.licExpiry) }); });
  db.contracts.forEach(c => {
    if (c.validTo) items.push({ id: c.id, kind: 'contract', label: c.type + ' expiry', detail: c.ref + ' — ' + clientName(db, c.clientId), expiry: c.validTo, days: daysTo(c.validTo) });
    if (c.bgExpiry) items.push({ id: c.id, kind: 'bg', label: 'Bank Guarantee / EMD', detail: c.ref, expiry: c.bgExpiry, days: daysTo(c.bgExpiry) });
  });
  items.sort((a, b) => (a.days == null ? 9999 : a.days) - (b.days == null ? 9999 : b.days));
  return items;
}

/* ---------- risk engine (BGTS triggers) ---------- */
export function riskFlags(db){
  const flags = [];
  db.invoices.forEach(inv => {
    const out = invOutstanding(db, inv);
    if (out > 0){ const age = daysSince(inv.date); if (age > 60) flags.push({ sev: 'red', msg: 'Receivable over 60 days: ' + inv.invNo + ' — ' + clientName(db, inv.clientId) + ' — ' + inr(out) + ' outstanding (' + age + ' days old).' }); }
  });
  db.vehicles.forEach(v => {
    if (!v.owned) return;
    const rev = sum(db.bookings.filter(b => b.vehicleId === v.id), b => b.freight);
    const fuel = sum(db.expenses.filter(e => e.vehicleId === v.id && e.category === 'Fuel'), e => e.amount);
    if (rev > 0 && fuel / rev > 0.32) flags.push({ sev: 'red', msg: 'Fuel cost is ' + Math.round(fuel / rev * 100) + '% of trip revenue on ' + v.regNo + ' (trigger: 32%).' });
  });
  db.vehicles.forEach(v => {
    if (!v.owned) return;
    const trips = db.bookings.filter(b => b.vehicleId === v.id);
    if (!trips.length){ flags.push({ sev: 'amber', msg: 'Vehicle ' + v.regNo + ' has no recorded trips yet.' }); return; }
    const last = trips.map(b => b.date).sort().pop();
    const idle = daysSince(last);
    if (idle > 7) flags.push({ sev: 'amber', msg: 'Vehicle ' + v.regNo + ' idle for ' + idle + ' days (last trip ' + fmtDate(last) + ').' });
  });
  const hired = db.bookings.filter(b => b.assignType === 'Hired' && b.hiredVendorId);
  if (hired.length >= 3){
    const byV = {}; hired.forEach(b => { byV[b.hiredVendorId] = (byV[b.hiredVendorId] || 0) + 1; });
    Object.keys(byV).forEach(vid => {
      const sh = byV[vid] / hired.length;
      if (sh > 0.4) flags.push({ sev: 'amber', msg: 'Vendor dependency: ' + vendorName(db, vid) + ' handles ' + Math.round(sh * 100) + '% of hired trips (trigger: 40%).' });
    });
  }
  const totRev = sum(db.bookings, b => b.freight);
  if (totRev > 0 && db.bookings.length >= 3){
    const byC = {}; db.bookings.forEach(b => { byC[b.clientId] = (byC[b.clientId] || 0) + Number(b.freight || 0); });
    Object.keys(byC).forEach(cid => {
      const sh = byC[cid] / totRev;
      if (sh > 0.35) flags.push({ sev: 'amber', msg: 'Client exposure: ' + clientName(db, cid) + ' is ' + Math.round(sh * 100) + '% of booked revenue (trigger: 35%).' });
    });
  }
  db.lhcs.forEach(l => {
    const bal = lhcBalance(l);
    if (bal > 0 && daysSince(l.date) > 15) flags.push({ sev: 'amber', msg: 'LHC ' + l.lhcNo + ' (' + vendorName(db, l.vendorId) + ') balance ' + inr(bal) + ' pending ' + daysSince(l.date) + ' days.' });
  });
  db.advances.forEach(a => {
    const open = (Number(a.amount) || 0) - (Number(a.settledAmount) || 0);
    if (open > 0 && daysSince(a.date) > 10) flags.push({ sev: 'amber', msg: 'Driver advance unsettled: ' + driverName(db, a.driverId) + ' — ' + inr(open) + ' open ' + daysSince(a.date) + ' days.' });
  });
  allRenewalItems(db).forEach(r => {
    if (r.days != null && r.days <= 30){
      flags.push({ sev: r.days <= 7 ? 'red' : 'amber', msg: (r.days < 0 ? 'EXPIRED: ' : 'Due in ' + r.days + ' days: ') + r.label + ' — ' + r.detail + ' (expiry ' + fmtDate(r.expiry) + ').' });
    }
  });
  return flags;
}

/* ---------- messages ---------- */
export function waBookingMsg(db, b){
  let m = 'BGTS Update — Booking ' + b.bkNo + '\n' + b.origin + ' → ' + b.destination + '\nStatus: ' + b.status;
  if (b.lrNo) m += '\nLR No: ' + b.lrNo;
  if (b.assignType === 'Owned'){
    m += '\nVehicle: ' + vehicleReg(db, b.vehicleId);
    if (b.driverId){ const d = byId(db.drivers, b.driverId) || {}; m += '\nDriver: ' + (d.name || '') + ' (' + (d.phone || '') + ')'; }
  }
  if (b.assignType === 'Hired') m += '\nVehicle: ' + (b.hiredVehicleNo || '');
  m += '\n— Baroda Goods Transport Service Pvt. Ltd.';
  return m;
}

/* ---------- LR document HTML (full v2 format, for PDF sharing) ---------- */
export function lrHtml(db, l){
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const co = db.company;
  const party = p => {
    p = p || {};
    let s = '<b>' + esc(p.name || '—') + '</b>';
    if (p.city) s += '<br>' + esc(p.city);
    if (p.contact) s += '<br>Ph: ' + esc(p.contact);
    if (p.gst) s += '<br>GST: ' + esc(p.gst);
    if (p.pan) s += '<br>PAN: ' + esc(p.pan);
    return s;
  };
  let goodsRows = '';
  (l.goods || []).forEach((g, i) => {
    goodsRows += '<tr><td>' + (i + 1) + '</td><td>' + esc(g.desc) + '</td><td>' + esc(g.pkgType || '—') + '</td><td>' + esc(g.pcs || '—') + '</td><td>' + esc(g.aw || '—') + '</td><td>' + esc(g.cw || '—') + '</td></tr>';
  });
  if (!goodsRows) goodsRows = '<tr><td colspan="6">—</td></tr>';
  let chg = ''; const ch = l.charges || {};
  if (Number(ch.aboveCh)) chg += '<tr><td>Above ' + esc(ch.abovePct || '') + '%</td><td class="r">' + inr(ch.aboveCh) + '</td></tr>';
  if (Number(ch.belowCh)) chg += '<tr><td>Below ' + esc(ch.belowPct || '') + '%</td><td class="r">' + inr(ch.belowCh) + '</td></tr>';
  LR_CHG.forEach(c => { if (Number(ch[c[0]])) chg += '<tr><td>' + c[1] + '</td><td class="r">' + inr(ch[c[0]]) + '</td></tr>'; });
  return '<html><head><meta charset="utf-8"><style>'
    + 'body{font-family:Arial,sans-serif;font-size:11.5px;color:#111;margin:16px}'
    + '.doc{border:2px solid #0a1f38}.r{text-align:right}'
    + '.head{background:#0a1f38;color:#fff;padding:12px 16px;display:flex;justify-content:space-between}'
    + '.head h1{margin:0;font-size:17px}.head p{margin:2px 0 0;font-size:9.5px;color:#c7d0dc}'
    + '.num{text-align:right;font-size:11px}.num b{color:#e8a33d;font-size:14px}'
    + 'table{width:100%;border-collapse:collapse}td,th{border:1px solid #94a3b8;padding:5px 7px;font-size:10.8px;text-align:left;vertical-align:top}'
    + 'th{background:#eef1f5;font-size:9.5px;text-transform:uppercase}.sig{height:55px}'
    + '.terms{font-size:8.5px;color:#555;padding:7px 10px;border-top:1px solid #94a3b8}'
    + '</style></head><body><div class="doc">'
    + '<div class="head"><div><h1>' + esc(co.name) + '</h1><p>' + esc(co.addr) + (co.gstin ? ' · GSTIN: ' + esc(co.gstin) : '') + (co.phone ? ' · Ph: ' + esc(co.phone) : '') + '</p>'
    + '<p>CONSIGNMENT NOTE / LORRY RECEIPT — AT OWNER\'S RISK' + (l.lrType === 'DUMMY' ? ' — <b>DUMMY</b>' : '') + '</p></div>'
    + '<div class="num">LR No.<br><b>' + esc(l.lrNo) + '</b><br>Date: ' + fmtDate(l.date) + '<br>' + esc(l.lrType) + '</div></div>'
    + '<table><tr><th>Truck No</th><th>From</th><th>To</th><th>Booking Branch</th><th>To Branch</th><th>Lorry Type</th></tr>'
    + '<tr><td><b>' + esc(l.truckNo) + '</b></td><td>' + esc(l.fromPlace) + '</td><td>' + esc(l.toPlace) + '</td><td>' + esc(l.bookingBranch || '—') + '</td><td>' + esc(l.toBranch || '—') + '</td><td>' + esc(l.lorryType || '—') + '</td></tr></table>'
    + '<table><tr><th style="width:33%">Consignor</th><th style="width:33%">Consignee</th><th>Billing To</th></tr>'
    + '<tr><td>' + party(l.consignor) + '</td><td>' + party(l.consignee) + '</td><td>' + ((l.billingTo && l.billingTo.name) ? party(l.billingTo) : esc(l.billingParty || '—')) + '</td></tr></table>'
    + '<table><tr><th>Invoice No</th><th>Inv. Amt</th><th>Inv. Date</th><th>E-Way No</th><th>E-Way Date</th><th>E-Way Expiry</th><th>P.O. Date</th></tr>'
    + '<tr><td>' + esc(l.invoiceNo || '—') + '</td><td>' + (l.invAmount ? inr(l.invAmount) : '—') + '</td><td>' + fmtDate(l.invoiceDate) + '</td><td>' + esc(l.ewayBillNo || '—') + '</td><td>' + fmtDate(l.ewayBillDate) + '</td><td>' + fmtDate(l.ewayExDate) + '</td><td>' + fmtDate(l.poDate) + '</td></tr></table>'
    + '<table><tr><th>#</th><th>Description</th><th>Pkgs</th><th>Pcs</th><th>Actual Wt</th><th>Charged Wt</th></tr>' + goodsRows
    + '<tr><td colspan="4" class="r"><b>TOTAL</b></td><td><b>' + esc(l.aWeight || '—') + '</b></td><td><b>' + esc(l.cWeight || '—') + '</b></td></tr></table>'
    + '<table><tr><th>Packing</th><th>Pvt Mark</th><th>LR Mode</th><th>GST Paid By</th><th>GST Slab</th><th>Insurance</th><th>Payment</th><th>Agent</th></tr>'
    + '<tr><td>' + esc(l.packing || '—') + '</td><td>' + esc(l.privateMark || '—') + '</td><td>' + esc(l.lrMode || '—') + '</td><td>' + esc(l.gstPaidBy || '—') + '</td><td>' + esc(l.gstSlab || '—') + '</td><td>' + esc(l.insurance || '—') + '</td><td><b>' + esc(l.payTerms || '—') + '</b></td><td>' + esc(l.agent || '—') + '</td></tr></table>'
    + (l.deliveryAddress ? '<table><tr><th>Delivery Address</th></tr><tr><td>' + esc(l.deliveryAddress) + '</td></tr></table>' : '')
    + '<table><tr><th colspan="2">Freight & Charges</th></tr>' + chg
    + '<tr><td class="r"><b>SUB TOTAL</b></td><td class="r"><b>' + inr(l.subTotal) + '</b></td></tr>'
    + (Number(l.igstAmt) ? '<tr><td class="r">IGST ' + l.igstPct + '%</td><td class="r">' + inr(l.igstAmt) + '</td></tr>' : '')
    + (Number(l.cgstAmt) ? '<tr><td class="r">CGST ' + l.cgstPct + '%</td><td class="r">' + inr(l.cgstAmt) + '</td></tr>' : '')
    + (Number(l.sgstAmt) ? '<tr><td class="r">SGST ' + l.sgstPct + '%</td><td class="r">' + inr(l.sgstAmt) + '</td></tr>' : '')
    + '<tr><td class="r" style="background:#eef1f5"><b>GROSS AMOUNT</b></td><td class="r" style="background:#eef1f5"><b>' + inr(l.gross) + '</b></td></tr></table>'
    + (l.remark ? '<table><tr><th>Remarks</th></tr><tr><td>' + esc(l.remark) + '</td></tr></table>' : '')
    + '<table><tr><th>Employee</th><th>Truck Driver No</th><th style="width:33%">Receiver Signature &amp; Stamp (POD)</th></tr>'
    + '<tr><td>' + esc(l.employee || '—') + '</td><td>' + esc(l.driverNo || '—') + '</td><td class="sig"></td></tr></table>'
    + '<div class="terms">Goods are transported at owner\'s risk. Delivery subject to terms &amp; conditions of carriage of ' + esc(co.name) + '. Consignment must be insured by the consignor. Subject to Vadodara jurisdiction. System-generated from BGTS-OS.</div>'
    + '</div></body></html>';
}
