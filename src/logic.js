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
export function mailLink(to, subj, body){
  return 'mailto:' + encodeURIComponent(to || '') + '?subject=' + encodeURIComponent(subj || '') + '&body=' + encodeURIComponent(body || '');
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
export const TRIP_EXP_CATS = ['Fuel', 'Toll/FASTag', 'Driver Salary/Bhatta', 'Loading/Unloading', 'Maintenance', 'Tyres', 'Other'];

/* ---------- LR ownership: hired-vehicle ledger + owned-vehicle trip expenses ---------- */
export function truckToVehicleId(db, truckNo){
  const key = String(truckNo || '').replace(/\s/g, '').toUpperCase();
  for (const v of db.vehicles){
    if (v.owned && String(v.regNo).replace(/\s/g, '').toUpperCase() === key) return v.id;
  }
  return '';
}
export function lrHireBalance(l){
  const h = l.hire || {};
  return r2((Number(h.amount) || 0) - (Number(h.advance) || 0) - sum(h.payments || [], p => p.amount));
}
export function lrTripExpTotal(l){ return sum(l.tripExpenses || [], t => t.amount); }
/* ---------- branches / multi-entity ---------- */
export function branchName(db, id){ const b = byId(db.branches || [], id); return b ? b.name : '—'; }
export function ensureBranches(db){
  if (!db.branches || !db.branches.length){
    db.branches = [{ id: 'br_main', name: 'VADODARA', entityName: db.company.name, gstin: db.company.gstin || '', addr: db.company.addr || '', lrPrefix: db.company.lrPrefix || '', phone: db.company.phone || '' }];
  }
  const main = db.branches[0];
  const byNm = nm => {
    nm = String(nm || '').trim().toUpperCase();
    return db.branches.find(b => String(b.name).trim().toUpperCase() === nm) || null;
  };
  (db.lrs || []).forEach(l => {
    const nm = String(l.bookingBranch || '').trim();
    if (nm && !byNm(nm)) db.branches.push({ id: uid('br'), name: nm.toUpperCase(), entityName: '', gstin: '', addr: '', lrPrefix: '', phone: '' });
    if (!l.branchId){ const br = byNm(nm); l.branchId = br ? br.id : main.id; }
  });
  (db.bookings || []).forEach(b => { if (!b.branchId) b.branchId = main.id; });
  (db.invoices || []).forEach(inv => {
    if (!inv.branchId){
      const b = (inv.bookingIds && inv.bookingIds.length) ? byId(db.bookings, inv.bookingIds[0]) : null;
      inv.branchId = (b && b.branchId) ? b.branchId : main.id;
    }
  });
  (db.acctExp || []).forEach(e => {
    if (!e.branchId){
      const l = e.lrId ? byId(db.lrs, e.lrId) : null;
      e.branchId = (l && l.branchId) ? l.branchId : main.id;
    }
  });
  return db;
}

export function normalizeLRs(db){
  (db.lrs || []).forEach(l => {
    const b = l.bookingId ? byId(db.bookings, l.bookingId) : null;
    if (!l.ownership) l.ownership = (b && b.assignType) ? b.assignType : 'Owned';
    if (!l.hire) l.hire = { vendorId: (b && b.hiredVendorId) || '', amount: (b ? Number(b.hireCost) || 0 : 0), advance: 0, payments: [] };
    if (!l.tripExpenses) l.tripExpenses = [];
    if (l.ownership === 'Owned' && !l.vehicleId) l.vehicleId = truckToVehicleId(db, l.truckNo);
  });
  return db;
}

/* ---- BGTS actual fleet (from vehicle documents on file) ---- */
export const BGTS_FLEET = [
  { id: 'vGJ19X6890', regNo: 'GJ19X6890', make: 'Tata Ultra 1518 Open (2019) · Eng 5LNGDICR17APY500453 · Ch MAT764020K7A01268', type: 'Open Body', owned: true, gvw: '18500', driverId: '' },
  { id: 'vGJ06BX3536', regNo: 'GJ06BX3536', make: 'Tata 1212 LPT DCR 49HSD (2024) · Eng 4SPCR19DVX612051 · Ch MAT785042R7D06857 · Fin: Sundaram Finance', type: 'High Deck Body', owned: true, gvw: '11990', driverId: '' },
  { id: 'vGJ34T2262', regNo: 'GJ34T2262', make: 'Eicher PRO 2110 (2020) · Eng CDLB320586 · Ch RC0LB176892', type: 'Half Deck Load Body', owned: true, gvw: '11990', driverId: '' },
  { id: 'vGJ06BY1577', regNo: 'GJ06BY1577', make: 'Mahindra Bolero Maxx PikUp HD 2.0L (07-2025) · Eng TTS4G15220 · Ch MALRE2TTKS6G34948 · Fin: M&M Finance', type: 'Open Body Pickup', owned: true, gvw: '3900', driverId: '' }
];
export const BGTS_FLEET_RENEWALS = [
  { regNo: 'GJ19X6890', docType: 'Insurance', ref: 'VGC1116112000101 (Royal Sundaram)', expiry: '2026-03-01' },
  { regNo: 'GJ06BX3536', docType: 'Insurance', ref: 'TAQ1088958000100 (Royal Sundaram)', expiry: '2026-09-02' },
  { regNo: 'GJ06BX3536', docType: 'Permit (State)', ref: 'GJ2024-GP-3993F (within Gujarat)', expiry: '2029-09-12' },
  { regNo: 'GJ34T2262', docType: 'Insurance', ref: 'OG-25-2201-1803-00004751 (Bajaj Allianz)', expiry: '2026-02-14' },
  { regNo: 'GJ06BY1577', docType: 'Insurance', ref: '213044/31/26/004994 (Shriram) — expiry date not on file, VERIFY', expiry: '' }
];
export function ensureBGTSFleet(db){
  const byReg = {};
  db.vehicles.forEach(x => { byReg[String(x.regNo).replace(/\s/g, '').toUpperCase()] = x; });
  BGTS_FLEET.forEach(v => {
    if (!byReg[v.regNo]) { const c = JSON.parse(JSON.stringify(v)); db.vehicles.push(c); byReg[v.regNo] = c; }
  });
  BGTS_FLEET_RENEWALS.forEach(r => {
    const veh = byReg[r.regNo]; if (!veh) return;
    const dup = db.renewals.some(x => x.vehicleId === veh.id && x.docType === r.docType);
    if (!dup) db.renewals.push({ id: uid('rn'), vehicleId: veh.id, docType: r.docType, ref: r.ref, expiry: r.expiry });
  });
  return db;
}

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
    company: { name: 'Baroda Goods Transport Service Pvt. Ltd.', addr: 'Vadodara, Gujarat, India', gstin: '', phone: '', email: '', lrPrefix: 'BRD/' },
    seq: { lr: 1, inv: 1, bk: 1, lhc: 1 },
    clients: [], vehicles: [], drivers: [], vendors: [], routes: [],
    contracts: [], bookings: [], expenses: [], renewals: [], invoices: [], payments: [],
    lrs: [], lhcs: [], advances: [], acctExp: [], inquiries: [], bankTxns: [], billingBackup: [], truckMaster: [],
    lenders: [], fixedExp: [], auditLog: []
  };
}

/* ---------- Truck Master — directory of every truck dealt with (owned or
   market/hired), independent of db.vehicles (BGTS's own owned fleet). Used
   to auto-fetch owner/contact/document details by truck number on the LR
   form. Match is whitespace/case-insensitive, same normalization used by
   truckToVehicleId() above so "GJ 06 AX 9856" and "GJ06AX9856" both hit. */
export function findTruckMaster(db, truckNo){
  const key = String(truckNo || '').replace(/\s/g, '').toUpperCase();
  if (!key) return null;
  return (db.truckMaster || []).find(t => String(t.truckNo || '').replace(/\s/g, '').toUpperCase() === key) || null;
}

/* One-click import of the company's existing legacy truck list (from the
   old system's "View Truck Details" register) into db.truckMaster. Skips
   any truck number already present so it's safe to run more than once.
   Owner Name / Contact No / Created By were blank in the source register and
   PAN Card / RC No were both unset for every row — left blank/false here too,
   editable afterwards from Masters -> Trucks. */
export const LEGACY_TRUCKS = [
  ['TRUCK-0095', 'GJ 05 CU 5443'], ['TRUCK-0047', 'GJ 06 AV 3379'], ['TRUCK-0067', 'GJ16 AU 8942'],
  ['TRUCK-0013', '12263'], ['TRUCK-0007', '12927'], ['TRUCK-0003', '12928'], ['TRUCK-0018', '12928 R1'],
  ['TRUCK-0015', '1394'], ['TRUCK-0010', '19020'], ['TRUCK-0017', '22414'], ['TRUCK-0048', '2262'],
  ['TRUCK-0005', '22953'], ['TRUCK-0008', '6890'], ['TRUCK-0056', 'BR 01 GP 0638'], ['TRUCK-0055', 'CG 04 HT - 5099'],
  ['TRUCK-0052', 'CG04JC9794'], ['TRUCK-0091', 'CG07CA6035'], ['TRUCK-0045', 'CG07CT 3726'], ['TRUCK-0046', 'CG22G-9878'],
  ['TRUCK-0012', 'GJ 03 AZ 9306'], ['TRUCK-0110', 'GJ 06 AX 5887'], ['TRUCK-0079', 'GJ 06 AX 9856'],
  ['TRUCK-0035', 'GJ 06 AY 4675'], ['TRUCK-0039', 'GJ 06 BV 9753'], ['TRUCK-0051', 'GJ 06 TT 8765'],
  ['TRUCK-0088', 'GJ 06AX8587'], ['TRUCK-0102', 'GJ 11 VV 7670'], ['TRUCK-0101', 'GJ 12 AZ 8550'],
  ['TRUCK-0093', 'GJ 15 AV 1124'], ['TRUCK-0037', 'GJ 15YY 7763'], ['TRUCK-0080', 'GJ 16 AU 6858'],
  ['TRUCK-0097', 'GJ 17 XX 1820'], ['TRUCK-0118', 'GJ 21V 6875'], ['TRUCK-0112', 'GJ 27 TF 9204'],
  ['TRUCK-0020', 'GJ 34 T 2262'], ['TRUCK-0025', 'GJ-06-BX-7185'], ['TRUCK-0113', 'GJ01DY9338'],
  ['TRUCK-0075', 'GJ01ET.3585'], ['TRUCK-0096', 'GJ01ET5958'], ['TRUCK-0119', 'GJ03 BZ 1224'],
  ['TRUCK-0030', 'GJ03AX9201'], ['TRUCK-0086', 'GJ03BW1843'], ['TRUCK-0062', 'GJ03BY5293'],
  ['TRUCK-0076', 'GJ03BZ3298'], ['TRUCK-0044', 'GJ04AT7264'], ['TRUCK-0057', 'GJ06AT8828'],
  ['TRUCK-0089', 'GJ06AX8511'], ['TRUCK-0031', 'GJ06AX8637'], ['TRUCK-0042', 'GJ06AX9856'],
  ['TRUCK-0121', 'GJ06AY4675'], ['TRUCK-0014', 'GJ06AZ4223'], ['TRUCK-0029', 'GJ06BT7526'],
  ['TRUCK-0059', 'GJ06BT7974'], ['TRUCK-0115', 'GJ06BT9525'], ['TRUCK-0077', 'GJ06BV 7599'],
  ['TRUCK-0100', 'GJ06BV4834'], ['TRUCK-0038', 'GJ06BV7189'], ['TRUCK-0084', 'GJ06BX3536'],
  ['TRUCK-0049', 'GJ06BX5307'], ['TRUCK-0082', 'GJ06BX9987'], ['TRUCK-0094', 'GJ06BY0945'],
  ['TRUCK-0040', 'GJ06BY1577'], ['TRUCK-0072', 'GJ06Y8009'], ['TRUCK-0001', 'GJ06ZZ1394'],
  ['TRUCK-0023', 'GJ07YZ8661'], ['TRUCK-0092', 'GJ07YZ9640'], ['TRUCK-0016', 'GJ1234'],
  ['TRUCK-0085', 'GJ15AT3352'], ['TRUCK-0041', 'GJ15AV1543'], ['TRUCK-0098', 'GJ16 AW7467'],
  ['TRUCK-0111', 'GJ16AB4707'], ['TRUCK-0066', 'GJ16AU 8784-'], ['TRUCK-0021', 'GJ16AU 8942'],
  ['TRUCK-0019', 'GJ16AU 8942.'], ['TRUCK-0108', 'GJ16AU1973'], ['TRUCK-0033', 'GJ16AU8942'],
  ['TRUCK-0032', 'GJ16AW-0776'], ['TRUCK-0069', 'GJ16AW4072'], ['TRUCK-0078', 'GJ16W9725'],
  ['TRUCK-0022', 'GJ17XX1820'], ['TRUCK-0074', 'GJ18AZ1642'], ['TRUCK-0006', 'GJ19X6890'],
  ['TRUCK-0004', 'GJ20AA1234'], ['TRUCK-0063', 'GJ21V9039'], ['TRUCK-0081', 'GJ23AT6958'],
  ['TRUCK-0122', 'GJ27TF9204'], ['TRUCK-0114', 'GJ31T7938'], ['TRUCK-0011', 'GJO4X7074'],
  ['TRUCK-0024', 'GND25CM000004'], ['TRUCK-0117', 'HR 46E 5635'], ['TRUCK-0099', 'HR61F4078'],
  ['TRUCK-0104', 'HR74C 5302'], ['TRUCK-0065', 'KA 01 AJ 9767'], ['TRUCK-0061', 'KA22AA1646'],
  ['TRUCK-0107', 'MH 48 AG 1806'], ['TRUCK-0027', 'MH 48 BM 9506'], ['TRUCK-0050', 'MH04LE3262'],
  ['TRUCK-0070', 'MH43CE4881'], ['TRUCK-0120', 'MH48AG1806'], ['TRUCK-0009', 'MH48BM2805'],
  ['TRUCK-0028', 'MH48BM3928'], ['TRUCK-0034', 'MH48BM9506'], ['TRUCK-0116', 'MH48DQ0196'],
  ['TRUCK-0071', 'MP15HA8944'], ['TRUCK-0054', 'NL01AJ3359'], ['TRUCK-0103', 'PB 08 EE 2813'],
  ['TRUCK-0036', 'PB11CQ0904'], ['TRUCK-0087', 'RJ 14 GR 8247'], ['TRUCK-0073', 'RJ 27 GB 5312'],
  ['TRUCK-0064', 'RJ 27 GE 1395'], ['TRUCK-0090', 'RJ07GD8205'], ['TRUCK-0026', 'RJ14GN1717'],
  ['TRUCK-0058', 'RJ27GC0876'], ['TRUCK-0109', 'RJ27GC1327'], ['TRUCK-0060', 'RJ27GD6328'],
  ['TRUCK-0053', 'RJ27GF1327'], ['TRUCK-0106', 'UP 45 BT 7004'], ['TRUCK-0068', 'UP 77 AT 2930'],
  ['TRUCK-0105', 'UP45BT7004'], ['TRUCK-0043', 'UP74T1456'], ['TRUCK-0083', 'UP93BT7838']
];
export function importLegacyTrucks(db){
  db.truckMaster = db.truckMaster || [];
  const have = {};
  db.truckMaster.forEach(t => { have[String(t.truckNo || '').replace(/\s/g, '').toUpperCase()] = true; });
  let added = 0;
  LEGACY_TRUCKS.forEach(([code, truckNo]) => {
    const key = truckNo.replace(/\s/g, '').toUpperCase();
    if (have[key]) return;
    have[key] = true;
    db.truckMaster.push({ id: uid('tm'), code, truckNo, ownerName: '', contactNo: '', panCard: false, rcNo: false, createdBy: '' });
    added++;
  });
  return added;
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
    subTotal: 0, igstAmt: 0, cgstAmt: 0, sgstAmt: 0, gross: 0, pod: false,
    ownership: 'Owned', vehicleId: '',
    hire: { vendorId: '', amount: '', advance: '', payments: [] },
    tripExpenses: []
  };
}

/* migrate: ensure v2 keys and convert booking-embedded LRs into LR records */
export function migrate(db){
  if (!db.lrs) db.lrs = [];
  if (!db.lhcs) db.lhcs = [];
  if (!db.advances) db.advances = [];
  if (!db.acctExp) db.acctExp = [];
  if (!db.inquiries) db.inquiries = [];
  if (!db.bankTxns) db.bankTxns = [];
  if (!db.billingBackup) db.billingBackup = [];
  if (!db.truckMaster) db.truckMaster = [];
  if (!db.lenders) db.lenders = [];
  if (!db.fixedExp) db.fixedExp = [];
  if (!db.auditLog) db.auditLog = [];
  db.clients.forEach(c => { if (c.creditLimit === undefined) c.creditLimit = 0; });
  ensureBillingBackup(db);
  if (!db.seq.lhc) db.seq.lhc = 1;
  if (!db.seq.inq) db.seq.inq = 1;
  if (!db.seq.mr) db.seq.mr = 1;
  ensureNoSamples(db);
  db.payments.forEach(p => { if (!p.mrNo){ p.mrNo = 'MR-' + String(db.seq.mr).padStart(4, '0'); db.seq.mr++; } });
  ensureBGTSFleet(db);
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
      lr.ownership = b.assignType || 'Owned';
      lr.hire = { vendorId: b.hiredVendorId || '', amount: Number(b.hireCost) || 0, advance: 0, payments: [] };
      if (lr.ownership === 'Owned') lr.vehicleId = truckToVehicleId(db, lr.truckNo);
      db.lrs.push(lr);
    }
  });
  normalizeLRs(db);
  ensureBranches(db);
  ensureRegisterInvoices(db);
  ensureOutstandingRecon(db);
  return db;
}

export function seedSample(db){ /* no dummy data — fleet, branches, register invoices and PDF reconciliation are seeded by migrate() */ return db; }

/* ---------- finance ---------- */
export function invPaid(db, inv){ return sum(db.payments.filter(p => p.invoiceId === inv.id), p => p.amount); }
export function invOutstanding(db, inv){ return (Number(inv.total) || 0) - invPaid(db, inv); }

/* ---------- credit control ---------- */
export function clientExposure(db, clientId){
  return sum(db.invoices.filter(i => i.clientId === clientId), i => invOutstanding(db, i));
}
/* creditGuard: pure check, no UI. limit<=0 means "no limit set" (always ok).
   newAmount is the amount about to be added to exposure (e.g. a new invoice total). */
export function creditGuard(db, clientId, newAmount){
  const c = byId(db.clients, clientId);
  const limit = c ? (Number(c.creditLimit) || 0) : 0;
  const exposure = clientExposure(db, clientId);
  const projected = exposure + (Number(newAmount) || 0);
  if (limit > 0 && projected > limit){
    return {
      ok: false, exposure, limit, projected,
      message: 'Credit limit for ' + (c ? c.name : 'this client') + ' is ' + inr(limit) + '. Current exposure ' + inr(exposure) + ' + this amount ' + inr(Number(newAmount) || 0) + ' = ' + inr(projected) + ' — over limit.'
    };
  }
  return { ok: true, exposure, limit, projected };
}

/* ---------- audit trail (append-only) ---------- */
export function logAudit(db, action, details){
  if (!db.auditLog) db.auditLog = [];
  db.auditLog.push({ id: uid('al'), ts: new Date().toISOString(), action, details: details || '' });
}

/* ---------- monthly fixed expenses ---------- */
export function fixedExpAmount(db, fe){
  if (fe.category === 'Vehicle EMI' && fe.linkedVehicleId){
    const v = byId(db.vehicles, fe.linkedVehicleId);
    return v ? (Number(v.emiAmount) || 0) : 0;
  }
  return Number(fe.amount) || 0;
}

/* ---------- vehicle detail: EMI, TCO, service history, due-soon ----------
   Document expiry (Insurance/Permit/Fitness/PUC/Road Tax) is tracked via the
   existing db.renewals[] module (see RenewalsScreen.js) rather than new flat
   per-vehicle expiry fields, so there is only one expiry-tracking system. */
export function vehicleEmiOutstanding(v){
  v = v || {};
  const emi = Number(v.emiAmount) || 0, tenure = Number(v.emiTenureMonths) || 0;
  if (!emi || !tenure || !v.emiStartDate) return { elapsed: 0, remaining: tenure, outstanding: 0 };
  const start = new Date(v.emiStartDate); const now = new Date();
  let elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (elapsed < 0) elapsed = 0;
  const remaining = Math.max(0, tenure - elapsed);
  return { elapsed, remaining, outstanding: emi * remaining };
}

/* Reuses FleetScreen's existing expense categories ('Maintenance','Tyres') as the
   maintenance/service-record subset, instead of introducing a new taxonomy. */
export const MAINT_CATS = ['Maintenance', 'Tyres'];
export function isMaintCat(cat){ return MAINT_CATS.indexOf(cat) >= 0; }

export function vehicleServiceRecords(db, vehicleId){
  return db.expenses.filter(e => e.vehicleId === vehicleId && isMaintCat(e.category))
    .slice().sort((a, b) => (a.date || '') < (b.date || '') ? 1 : -1);
}

export function vehicleTCO(db, v){
  const purchase = Number(v.purchasePrice) || 0;
  const emi = vehicleEmiOutstanding(v);
  const emiPaidToDate = (Number(v.emiAmount) || 0) * emi.elapsed;
  const allExpenses = sum(db.expenses.filter(e => e.vehicleId === v.id), e => e.amount);
  return { purchase, emiPaidToDate, allExpenses, total: purchase + emiPaidToDate + allExpenses };
}

/* Due-soon: next-service km within 1000km of current odometer, next-service date
   within 30 days, or any db.renewals document for this vehicle expiring within
   30 days (including already expired). */
export function vehicleDueSoon(db, v){
  const reasons = [];
  const recs = vehicleServiceRecords(db, v.id);
  const odo = Number(v.odometerKm) || 0;
  recs.forEach(r => {
    if (r.nextServiceDueKm){
      const diff = Number(r.nextServiceDueKm) - odo;
      if (diff <= 1000) reasons.push('Service due at ' + r.nextServiceDueKm + ' km (odo ' + odo + ' km)');
    }
    if (r.nextServiceDueDate){
      const d = daysTo(r.nextServiceDueDate);
      if (d != null && d <= 30) reasons.push('Service due ' + fmtDate(r.nextServiceDueDate) + (d < 0 ? ' (OVERDUE)' : ''));
    }
  });
  (db.renewals || []).filter(r => r.vehicleId === v.id).forEach(r => {
    const d = daysTo(r.expiry);
    if (d != null && d <= 30) reasons.push(r.docType + ' expiry ' + fmtDate(r.expiry) + (d < 0 ? ' (EXPIRED)' : ' due soon'));
  });
  return reasons;
}

/* ---------- fleet expense form (shared by FleetScreen's log and
   VehicleDetailScreen's "+ Add Service/Expense", so there is one field
   definition and one push function for this entity, not two). The
   service/maintenance-only fields are optional and always shown — ModalForm
   fields are fixed when the form opens (no reactivity to another field's live
   value), so rather than change that shared component these are simply left
   blank/harmless for non-maintenance categories instead of being hidden. */
export const EXPENSE_CATS = ['Fuel', 'Maintenance', 'Toll/FASTag', 'Driver Salary/Bhatta', 'Tyres', 'Insurance/Permit', 'EMI/Finance', 'Other'];
export const SERVICE_TYPES = ['Scheduled Service', 'Breakdown Repair', 'Tyre Replacement', 'Accident Repair', 'Other'];

export function expenseFields(vehicles, opts){
  opts = opts || {};
  return [
    { key: 'vehicleId', label: 'Vehicle', type: 'select', required: true, value: opts.vehicleId, options: (vehicles || []).map(v => ({ v: v.id, l: v.regNo })) },
    { key: 'date', label: 'Date', type: 'date', required: true, value: opts.date || todayISO() },
    { key: 'category', label: 'Category', type: 'select', required: true, value: opts.category || 'Fuel', options: EXPENSE_CATS.map(x => ({ v: x, l: x })) },
    { key: 'amount', label: 'Amount ₹', type: 'number', required: true, value: opts.amount },
    { key: 'litres', label: 'Litres (fuel only)', type: 'number', value: opts.litres },
    { key: 'odometerAtService', label: 'Odometer at Service (km)', type: 'number', hint: 'Maintenance / Tyres records only', value: opts.odometerAtService },
    { key: 'serviceType', label: 'Service Type', type: 'select', hint: 'Maintenance / Tyres records only', value: opts.serviceType, options: SERVICE_TYPES.map(x => ({ v: x, l: x })) },
    { key: 'vendor', label: 'Vendor / Workshop', hint: 'Maintenance / Tyres records only', value: opts.vendor },
    { key: 'partsReplaced', label: 'Parts Replaced', hint: 'Maintenance / Tyres records only', value: opts.partsReplaced },
    { key: 'nextServiceDueKm', label: 'Next Service Due (km)', type: 'number', hint: 'Maintenance / Tyres records only', value: opts.nextServiceDueKm },
    { key: 'nextServiceDueDate', label: 'Next Service Due Date', type: 'date', hint: 'Maintenance / Tyres records only', value: opts.nextServiceDueDate },
    { key: 'warrantyUntil', label: 'Warranty Until', type: 'date', hint: 'Maintenance / Tyres records only', value: opts.warrantyUntil },
    { key: 'notes', label: 'Notes', type: 'multiline', value: opts.notes }
  ];
}

export function pushExpense(db, v){
  db.expenses.push({
    id: uid('e'), vehicleId: v.vehicleId, date: v.date, category: v.category, amount: Number(v.amount) || 0, litres: v.litres, notes: v.notes,
    odometerAtService: v.odometerAtService, serviceType: v.serviceType, vendor: v.vendor, partsReplaced: v.partsReplaced,
    nextServiceDueKm: v.nextServiceDueKm, nextServiceDueDate: v.nextServiceDueDate, warrantyUntil: v.warrantyUntil
  });
}

export function fleetDueSoonList(db){
  const out = [];
  db.vehicles.filter(v => v.owned).forEach(v => {
    const reasons = vehicleDueSoon(db, v);
    if (reasons.length) out.push({ v, reasons });
  });
  return out;
}

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

/* ---------- LR bulk import (CSV) ---------- */
export function parseCSV(text){
  const rows = []; let row = [], cur = '', inQ = false;
  text = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++){
    const ch = text[i];
    if (inQ){
      if (ch === '"'){ if (text[i + 1] === '"'){ cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ','){ row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r'){
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.length > 1 || String(row[0]).trim() !== '') rows.push(row);
        row = [];
      }
      else cur += ch;
    }
  }
  if (cur !== '' || row.length){ row.push(cur); if (row.length > 1 || String(row[0]).trim() !== '') rows.push(row); }
  return rows;
}
const IMP_ALIASES = {
  lrno:'lrNo', lrnumber:'lrNo', lrtype:'lrType', date:'date', lrdate:'date',
  ownership:'ownership', vehicleownership:'ownership', ownedhired:'ownership',
  truckno:'truckNo', trucknumber:'truckNo', vehicleno:'truckNo',
  fromplace:'fromPlace', from:'fromPlace', origin:'fromPlace',
  toplace:'toPlace', to:'toPlace', destination:'toPlace',
  branch:'bookingBranch', bookingbranch:'bookingBranch', tobranch:'toBranch',
  consignor:'crName', consignorname:'crName', consignorgst:'crGst', consignorcity:'crCity', consignorcontact:'crContact', consignorpan:'crPan',
  consignee:'ceName', consigneename:'ceName', consigneegst:'ceGst', consigneecity:'ceCity', consigneecontact:'ceContact', consigneepan:'cePan',
  billingto:'btName', billingtoname:'btName', billingtogst:'btGst',
  billingparty:'billingParty', payterms:'payTerms', paymentterms:'payTerms', lrmode:'lrMode',
  gstpaidby:'gstPaidBy', gstslab:'gstSlab', insurance:'insurance', deliveryaddress:'deliveryAddress',
  cargo:'cargo', description:'cargo', cargodescription:'cargo', goods:'cargo',
  pkgs:'pkgs', pieces:'pkgs', pcs:'pkgs', pkgtype:'pkgType', packagetype:'pkgType',
  actualweight:'aw', aweight:'aw', chargedweight:'cw', cweight:'cw',
  invoiceno:'invoiceNo', invamount:'invAmount', invoiceamount:'invAmount', invoicedate:'invoiceDate', podate:'poDate',
  ewaybillno:'ewayBillNo', ewaybill:'ewayBillNo', ewaybilldate:'ewayBillDate', ewayexdate:'ewayExDate', ewayexpirydate:'ewayExDate',
  freight:'freight', ratecharge:'rateCh', rate:'rate', surcharge:'surcharge', localcartage:'localCartage', lastmile:'lastMile', lastmilefrt:'lastMile',
  fov:'fov', loading:'loading', loadingcharge:'loading', unloading:'unloading', unloadingcharge:'unloading',
  handling:'handling', handlingcharge:'handling', gc:'gc', gccharge:'gc', other:'other', othercharge:'other',
  ewaycharge:'ewayCh', ewaybillcharge:'ewayCh', aoc:'aoc', abovecharge:'aboveCh', belowcharge:'belowCh',
  igst:'igstPct', igstpct:'igstPct', cgst:'cgstPct', cgstpct:'cgstPct', sgst:'sgstPct', sgstpct:'sgstPct',
  hirevendor:'hireVendor', vendor:'hireVendor', hireamount:'hireAmount', lorryhire:'hireAmount', hireadvance:'hireAdvance', advance:'hireAdvance',
  agent:'agent', tobilledat:'billedAt', billedat:'billedAt', remark:'remark', remarks:'remark',
  employee:'employee', driverno:'driverNo', truckdriverno:'driverNo', privatemark:'privateMark',
  packing:'packing', methodofpacking:'packing', lorrytype:'lorryType', pod:'pod'
};
const p2 = n => { n = String(n); return n.length < 2 ? '0' + n : n; };
export function impDate(s){
  s = String(s || '').trim();
  if (!s) return todayISO();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + p2(m[2]) + '-' + p2(m[3]);
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m){ const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + p2(m[2]) + '-' + p2(m[1]); }
  return null;
}
const impNum = v => { const n = Number(String(v == null ? '' : v).replace(/[₹,\s]/g, '')); return isNaN(n) ? 0 : n; };
export const LR_IMPORT_HEADERS = ['lr_no', 'lr_type', 'date', 'ownership', 'truck_no', 'from_place', 'to_place', 'booking_branch', 'consignor_name', 'consignor_gst', 'consignee_name', 'consignee_gst', 'billing_party', 'pay_terms', 'cargo_description', 'pkgs', 'actual_weight', 'charged_weight', 'invoice_no', 'eway_bill_no', 'freight', 'loading', 'unloading', 'other_charge', 'igst_pct', 'cgst_pct', 'sgst_pct', 'hire_vendor', 'hire_amount', 'hire_advance', 'remark'];

export function buildLRImportPlan(db, aoa){
  const plan = { items: [], unknownHeaders: [], totalRows: 0 };
  if (!aoa || aoa.length < 2){ plan.error = 'No data rows found. Row 1 must be headers, data from row 2.'; return plan; }
  const cols = aoa[0].map(hd => {
    const key = String(hd || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (IMP_ALIASES[key]) return IMP_ALIASES[key];
    if (String(hd).trim()) plan.unknownHeaders.push(String(hd).trim());
    return null;
  });
  const batchNos = {}; db.lrs.forEach(l => { batchNos[l.lrNo] = 1; });
  let autoCounter = db.seq.lr;
  const mainBr = db.branches[0];
  for (let r = 1; r < aoa.length; r++){
    const raw = aoa[r]; if (!raw) continue;
    if (raw.every(c => String(c == null ? '' : c).trim() === '')) continue;
    plan.totalRows++;
    const o = {};
    cols.forEach((k, c) => { if (k && raw[c] != null) o[k] = String(raw[c]).trim(); });
    const errs = [], warns = [];
    const ownership = /^h/i.test(o.ownership || '') ? 'Hired' : 'Owned';
    const REQ = { truckNo: 'Truck No', fromPlace: 'From Place', toPlace: 'To Place', crName: 'Consignor', ceName: 'Consignee' };
    Object.keys(REQ).forEach(k => { if (!o[k]) errs.push(REQ[k] + ' missing'); });
    let dt = impDate(o.date);
    if (dt === null){ errs.push('Bad date "' + o.date + '"'); dt = todayISO(); }
    let lrNo = o.lrNo, autoNo = false;
    if (!lrNo){ lrNo = db.company.lrPrefix + String(autoCounter).padStart(4, '0'); autoCounter++; autoNo = true; }
    if (batchNos[lrNo]) errs.push('Duplicate LR No ' + lrNo); else batchNos[lrNo] = 1;
    const brName = String(o.bookingBranch || '').trim();
    let branchId = mainBr.id, brFound = !brName;
    db.branches.forEach(b => { if (b.name.toUpperCase() === brName.toUpperCase()){ branchId = b.id; brFound = true; } });
    if (!brFound) warns.push('Branch "' + brName + '" not found → ' + mainBr.name);
    let vendorId = '', vendorNm = '';
    if (ownership === 'Hired'){
      vendorNm = String(o.hireVendor || '').trim();
      if (!vendorNm) errs.push('Hired row needs hire_vendor');
      else {
        db.vendors.forEach(v => { if (v.name.toUpperCase() === vendorNm.toUpperCase()) vendorId = v.id; });
        if (!vendorId) warns.push('New vendor "' + vendorNm + '" will be created');
      }
    }
    const charges = { abovePct: '', aboveCh: impNum(o.aboveCh), belowPct: '', belowCh: impNum(o.belowCh), rate: o.rate || '', rateCh: impNum(o.rateCh),
      freight: impNum(o.freight), surcharge: impNum(o.surcharge), localCartage: impNum(o.localCartage), lastMile: impNum(o.lastMile),
      fov: impNum(o.fov), loading: impNum(o.loading), unloading: impNum(o.unloading), handling: impNum(o.handling),
      gc: impNum(o.gc), other: impNum(o.other), ewayCh: impNum(o.ewayCh), aoc: impNum(o.aoc) };
    const t = computeLR(charges, impNum(o.igstPct), impNum(o.cgstPct), impNum(o.sgstPct));
    if (t.subTotal <= 0) warns.push('No freight/charges — gross ₹0');
    const lr = { ...blankLR(),
      lrType: /^d/i.test(o.lrType || '') ? 'DUMMY' : 'ORIGINAL',
      truckNo: o.truckNo || '', lrNo, date: dt,
      bookingBranch: brName ? brName.toUpperCase() : mainBr.name, branchId,
      fromPlace: o.fromPlace || '', toPlace: o.toPlace || '', toBranch: o.toBranch || '',
      invoiceNo: o.invoiceNo || '', invAmount: o.invAmount || '',
      invoiceDate: o.invoiceDate ? (impDate(o.invoiceDate) || '') : '',
      ewayBillNo: o.ewayBillNo || '', ewayBillDate: o.ewayBillDate ? (impDate(o.ewayBillDate) || '') : '',
      ewayExDate: o.ewayExDate ? (impDate(o.ewayExDate) || '') : '', poDate: o.poDate ? (impDate(o.poDate) || '') : '',
      packing: o.packing || '', lorryType: o.lorryType || '', privateMark: o.privateMark || '',
      lrMode: o.lrMode || 'Door Delivery', deliveryAddress: o.deliveryAddress || '',
      billingParty: o.billingParty || 'Consignor', gstPaidBy: o.gstPaidBy || 'Consignee', gstSlab: o.gstSlab || 'Exempt (RCM)',
      insurance: o.insurance || '', payTerms: (o.payTerms || 'TO BE BILLED').toUpperCase(),
      consignor: { name: o.crName || '', city: o.crCity || '', contact: o.crContact || '', pan: o.crPan || '', gst: o.crGst || '' },
      consignee: { name: o.ceName || '', city: o.ceCity || '', contact: o.ceContact || '', pan: o.cePan || '', gst: o.ceGst || '' },
      billingTo: { name: o.btName || '', city: '', contact: '', pan: '', gst: o.btGst || '' },
      agent: o.agent || '', billedAt: o.billedAt || '',
      goods: o.cargo ? [{ desc: o.cargo, pkgType: o.pkgType || '', pcs: o.pkgs || '', aw: o.aw || '', cw: o.cw || o.aw || '', l: '', w: '', h: '' }] : [],
      aWeight: o.aw || '', cWeight: o.cw || o.aw || '',
      remark: o.remark || '', employee: o.employee || '', driverNo: o.driverNo || '',
      charges, igstPct: impNum(o.igstPct), cgstPct: impNum(o.cgstPct), sgstPct: impNum(o.sgstPct),
      subTotal: t.subTotal, igstAmt: t.igstAmt, cgstAmt: t.cgstAmt, sgstAmt: t.sgstAmt, gross: t.gross,
      pod: /^(y|1|t)/i.test(o.pod || ''), ownership,
      hire: { vendorId, amount: ownership === 'Hired' ? impNum(o.hireAmount) : 0, advance: ownership === 'Hired' ? impNum(o.hireAdvance) : 0, payments: [] }
    };
    if (ownership === 'Owned'){
      lr.vehicleId = truckToVehicleId(db, lr.truckNo);
      if (!lr.vehicleId) warns.push('Truck not in owned Vehicle Master');
    }
    plan.items.push({ row: r + 1, errors: errs, warns, lr, autoNo, vendorName: vendorNm });
  }
  return plan;
}
/* build + apply atomically against the live db (call inside store.update) */
export function applyLRImportAoa(db, aoa){
  const plan = buildLRImportPlan(db, aoa);
  if (plan.error) return { created: 0, skipped: 0, error: plan.error };
  const vmap = {}; db.vendors.forEach(v => { vmap[v.name.toUpperCase()] = v.id; });
  let created = 0, autoUsed = 0;
  plan.items.filter(it => !it.errors.length).forEach(it => {
    const lr = it.lr; lr.id = uid('lr');
    if (lr.ownership === 'Hired' && !lr.hire.vendorId && it.vendorName){
      const key = it.vendorName.toUpperCase();
      if (!vmap[key]){ const nv = { id: uid('ve'), name: it.vendorName, phone: '', city: '', rating: 'B' }; db.vendors.push(nv); vmap[key] = nv.id; }
      lr.hire.vendorId = vmap[key];
    }
    if (db.lrs.some(x => x.lrNo === lr.lrNo)){ lr.lrNo = db.company.lrPrefix + String(db.seq.lr).padStart(4, '0'); db.seq.lr++; }
    else if (it.autoNo) autoUsed++;
    db.lrs.push(lr);
    if (lr.ownership === 'Hired' && lr.hire.advance > 0){
      db.acctExp.push({ id: 'hadv_' + lr.id, lrId: lr.id, branchId: lr.branchId, date: lr.date, account: 'Hired Vehicle / Subcontractor', amount: lr.hire.advance, paidThrough: 'Bank — Current A/c', vendor: vendorName(db, lr.hire.vendorId), ref: 'LR ' + lr.lrNo + ' — hire advance', notes: 'Hire advance (imported)', src: 'hire' });
    }
    created++;
  });
  if (autoUsed > 0) db.seq.lr += autoUsed;
  return { created, skipped: plan.items.length - created };
}

/* ---------- BOOKING_REGISTER (.xls export) → LR bulk import ----------
   The company's billing software exports BOOKING_REGISTER as an HTML table saved with
   a .xls extension (same malformed-markup quirk as BILLING_REGISTER: each cell is a
   self-closing <td/> immediately followed by its text and a real closing </td>). One
   row per LR/trip, with its own column names (LR NO., DATE, CONSIGNOR, TRUCK NO, LR
   AMOUNT, BROKER, BILL NO...). isBookingRegister/registerToLRAoa convert a real export
   straight into the exact AOA shape buildLRImportPlan already expects (lr_no, date,
   ownership, truck_no...), so it drops into the same import pipeline as a CSV upload —
   no manual re-typing of 270+ rows into the CSV template needed. */
export function isBookingRegister(text){
  text = String(text || '');
  return /<html/i.test(text.slice(0, 500)) && /LR\s*NO\.?\s*<\/td>/i.test(text) && /BILL\s*STATUS/i.test(text) && /<tr[^>]*>/i.test(text);
}
function htmlTableRows(text){
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi; let trM;
  while ((trM = trRe.exec(text))){
    const cells = []; const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi; let tdM;
    while ((tdM = tdRe.exec(trM[1]))){
      cells.push(tdM[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim());
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}
export function registerToLRAoa(text){
  const rows = htmlTableRows(text);
  const out = [['lr_no', 'date', 'ownership', 'truck_no', 'from_place', 'to_place', 'consignor_name', 'consignee_name', 'private_mark', 'freight', 'hire_vendor', 'hire_advance', 'invoice_no', 'invoice_date', 'invoice_amount', 'remark']];
  if (!rows.length) return out;
  const hdr = rows[0].map(h => String(h || '').toUpperCase().trim());
  const idx = name => hdr.indexOf(name);
  const iLr = idx('LR NO.'), iDate = idx('DATE'), iCr = idx('CONSIGNOR'), iCe = idx('CONSIGNEE'),
    iFrom = idx('FROM'), iTo = idx('TO'), iTruck = idx('TRUCK NO'), iRemark = idx('REMARK'),
    iMark = idx('PRIVATE MARK'), iAmt = idx('LR AMOUNT'), iBroker = idx('BROKER'), iAdv = idx('ADVANCE'),
    iBillNo = idx('BILL NO'), iBillDate = idx('BILL DATE'), iBillAmt = idx('BILL AMOUNT');
  const g = (c, i) => (i >= 0 && c[i] != null) ? c[i] : '';
  for (let r = 1; r < rows.length; r++){
    const c = rows[r];
    const lrNo = g(c, iLr), date = g(c, iDate);
    if (!lrNo || !date) continue; /* skips the trailing grand-total row and any blank rows */
    const broker = g(c, iBroker);
    out.push([
      lrNo, date, broker ? 'Hired' : 'Owned', g(c, iTruck),
      g(c, iFrom), g(c, iTo), g(c, iCr), g(c, iCe),
      g(c, iMark), g(c, iAmt) || '0',
      broker, g(c, iAdv),
      g(c, iBillNo), g(c, iBillDate), g(c, iBillAmt),
      g(c, iRemark)
    ]);
  }
  return out;
}

/* ---------- invoice backup archive (from BILLING_REGISTER excel) ---------- */
/* ---------- invoice backup archive + billing-register parser ---------- */
export const BGTS_BILLING_BACKUP = [{"c":"GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR","b":"2627/BRD/0001","d":"2026-04-01","l":[["GND/00013",114583.81]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD","b":"2627/BRD/0002","d":"2026-04-01","l":[["BRD/06452",1306.06],["BRD/06454",1306.06],["BRD/06458",3545.03],["BRD/06459",5597.41],["BRD/06462",2052.38],["BRD/06465",2425.54],["BRD/06466",373.16],["BRD/06471",1026.19],["BRD/06472",2798.7],["BRD/06477",10448.5],["BRD/06478",9515.6],["BRD/06491",1306.06],["BRD/06492",1306.06],["BRD/06493",373.16],["BRD/06495",2798.7],["BRD/06496",2052.38],["BRD/06502",2425.54],["BRD/06505",5783.99],["BRD/06510",2798.7]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0003","d":"2026-04-03","l":[["BRD/06513",22261.0],["BRD/06514",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0004","d":"2026-04-06","l":[["BRD/06515",22261.0],["BRD/06516",22261.0]]},{"c":"NTPC","b":"2627/BRD/0005","d":"2026-04-09","l":[["BRD/06520",9141.0],["BRD/06521",9141.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0006","d":"2026-04-09","l":[["BRD/06518",22261.0],["BRD/06519",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0007","d":"2026-04-10","l":[["BRD/06522",22261.0],["BRD/06523",22261.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0008","d":"2026-04-13","l":[["BRD/06530",29635.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0009","d":"2026-04-13","l":[["BRD/06531",29635.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0010","d":"2026-04-13","l":[["BRD/06532",29635.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0011","d":"2026-04-13","l":[["BRD/06533",29635.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0012","d":"2026-04-13","l":[["BRD/06534",29635.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0013","d":"2026-04-14","l":[["BRD/06525",22261.0],["BRD/06526",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0014","d":"2026-04-16","l":[["BRD/06535",22261.0],["BRD/06536",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0015","d":"2026-04-20","l":[["BRD/06542",22261.0],["BRD/06543",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0016","d":"2026-04-21","l":[["BRD/06538",22261.0],["BRD/06539",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0017","d":"2026-04-22","l":[["BRD/06546",22261.0],["BRD/06547",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0018","d":"2026-04-25","l":[["BRD/06549",22261.0],["BRD/06550",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0019","d":"2026-04-25","l":[["BRD/06544",22261.0],["BRD/06545",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0020","d":"2026-04-29","l":[["BRD/06552",22261.0],["BRD/06553",22261.0]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD","b":"2627/BRD/0021","d":"2026-05-01","l":[["BRD/06512",1679.22],["BRD/06517",1679.22],["BRD/06527",2798.7],["BRD/06528",1026.19],["BRD/06529",1026.19],["BRD/06537",1306.06],["BRD/06540",5597.41],["BRD/06548",2052.38],["BRD/06551",1026.19],["BRD/06558",2798.7]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0022","d":"2026-05-01","l":[["BRD/06555",22261.0],["BRD/06556",22261.0]]},{"c":"GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR","b":"2627/BRD/0023","d":"2026-05-01","l":[["GND/00014",114610.14]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0024","d":"2026-05-04","l":[["BRD/06562",22261.0],["BRD/06563",22261.0]]},{"c":"PARAS PIPES","b":"2627/BRD/0025","d":"2026-05-08","l":[["BRD/06564",58300.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0026","d":"2026-05-08","l":[["BRD/06565",22261.0],["BRD/06566",22261.0]]},{"c":"USHTA INFINITY CONSTRUCTION CO.PVT.LTD","b":"2627/BRD/0027","d":"2026-05-08","l":[["BRD/06524",37000.0]]},{"c":"USHTA INFINITY CONSTRUCTION CO.PVT.LTD","b":"2627/BRD/0028","d":"2026-05-08","l":[["BRD/06541",26000.0]]},{"c":"USHTA INFINITY CONSTRUCTION CO.PVT.LTD","b":"2627/BRD/0029","d":"2026-05-08","l":[["BRD/06554",150500.0]]},{"c":"USHTA INFINITY CONSTRUCTION CO.PVT.LTD","b":"2627/BRD/0030","d":"2026-05-08","l":[["BRD/06557",78200.0]]},{"c":"USHTA INFINITY CONSTRUCTION CO.PVT.LTD","b":"2627/BRD/0031","d":"2026-05-08","l":[["BRD/06570",1000.0]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD DAHEJ","b":"2627/BRD/0032","d":"2026-05-11","l":[["BRD/06572",26434.5]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD DAHEJ","b":"2627/BRD/0033","d":"2026-05-12","l":[["BRD/06574",26434.5]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD","b":"2627/BRD/0034","d":"2026-05-15","l":[["BRD/06559",932.9],["BRD/06560",1026.19],["BRD/06561",1026.19],["BRD/06567",2798.7],["BRD/06571",2052.38],["BRD/06573",9329.01],["BRD/06576",9329.01],["BRD/06575",1306.06],["BRD/06579",932.9],["BRD/06580",1026.19],["BRD/06581",1026.19],["BRD/06584",1026.19],["BRD/06585",1026.19],["BRD/06587",3545.03],["BRD/06586",1306.06],["BRD/06590",1026.19],["BRD/06591",1026.19]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0035","d":"2026-05-15","l":[["BRD/06568",22261.0],["BRD/06569",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0036","d":"2026-05-15","l":[["BRD/06577",22261.0],["BRD/06578",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0037","d":"2026-05-16","l":[["BRD/06582",22261.0],["BRD/06583",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0038","d":"2026-05-16","l":[["BRD/06588",22261.0],["BRD/06589",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0039","d":"2026-05-19","l":[["BRD/06592",22261.0],["BRD/06593",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0040","d":"2026-05-23","l":[["BRD/06595",22261.0],["BRD/06596",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0041","d":"2026-05-24","l":[["BRD/06602",22261.0],["BRD/06603",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0042","d":"2026-05-28","l":[["BRD/06606",22261.0],["BRD/06607",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0043","d":"2026-05-29","l":[["BRD/06610",22261.0],["BRD/06611",22261.0]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD DAHEJ","b":"2627/BRD/0044","d":"2026-06-01","l":[["BRD/06609",43998.8]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD DAHEJ","b":"2627/BRD/0045","d":"2026-06-01","l":[["BRD/06608",43998.8]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0046","d":"2026-06-01","l":[["BRD/06615",22261.0],["BRD/06616",22261.0]]},{"c":"GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR","b":"2627/BRD/0047","d":"2026-06-01","l":[["GND/00015",114686.31]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD","b":"2627/BRD/0048","d":"2026-06-01","l":[["BRD/06594",1306.06],["BRD/06599",1306.06],["BRD/06600",1026.19],["BRD/06601",1026.19],["BRD/06604",1026.19],["BRD/06605",1026.19],["BRD/06614",5970.57]]},{"c":"NTPC","b":"2627/BRD/0049","d":"2026-06-01","l":[["BRD/06612",12955.0],["BRD/06613",12955.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0050","d":"2026-06-04","l":[["BRD/06622",24635.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0051","d":"2026-06-04","l":[["BRD/06623",24635.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0052","d":"2026-06-04","l":[["BRD/06624",17285.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0053","d":"2026-06-04","l":[["BRD/06625",24635.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0054","d":"2026-06-04","l":[["BRD/06626",24635.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0055","d":"2026-06-04","l":[["BRD/06627",17285.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0056","d":"2026-06-04","l":[["BRD/06597",22261.0],["BRD/06598",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0057","d":"2026-06-04","l":[["BRD/06617",22261.0],["BRD/06618",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0058","d":"2026-06-05","l":[["BRD/06619",22261.0],["BRD/06620",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0059","d":"2026-06-05","l":[["BRD/06631",22261.0],["BRD/06632",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0060","d":"2026-06-08","l":[["BRD/06634",22261.0],["BRD/06635",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0061","d":"2026-06-09","l":[["BRD/06636",22261.0],["BRD/06637",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0062","d":"2026-06-11","l":[["BRD/06638",22261.0],["BRD/06639",22261.0]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD","b":"2627/BRD/0063","d":"2026-06-16","l":[["BRD/06621",2798.7],["BRD/06628",1306.06],["BRD/06629",1679.22],["BRD/06630",10448.5],["BRD/06642",2798.7],["BRD/06645",1306.06],["BRD/06646",2052.38]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0064","d":"2026-06-16","l":[["BRD/06640",22261.0],["BRD/06641",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0065","d":"2026-06-17","l":[["BRD/06643",22261.0],["BRD/06644",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0066","d":"2026-06-19","l":[["BRD/06647",22261.0],["BRD/06648",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0067","d":"2026-06-21","l":[["BRD/06650",22261.0],["BRD/06651",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0068","d":"2026-06-23","l":[["BRD/06653",22261.0],["BRD/06654",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0069","d":"2026-06-24","l":[["BRD/06658",22261.0],["BRD/06659",22261.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0070","d":"2026-06-25","l":[["BRD/06660",29635.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0071","d":"2026-06-25","l":[["BRD/06661",29635.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0072","d":"2026-06-25","l":[["BRD/06662",29635.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0073","d":"2026-06-25","l":[["BRD/06663",29635.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0074","d":"2026-06-25","l":[["BRD/06664",29635.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0075","d":"2026-06-25","l":[["BRD/06656",22261.0],["BRD/06657",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0076","d":"2026-06-27","l":[["BRD/06665",22261.0],["BRD/06666",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0077","d":"2026-06-30","l":[["BRD/06668",22261.0],["BRD/06669",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0078","d":"2026-07-01","l":[["BRD/06670",22261.0],["BRD/06671",22261.0]]},{"c":"GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR","b":"2627/BRD/0079","d":"2026-07-01","l":[["GND/00016",120761.99]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD","b":"2627/BRD/0080","d":"2026-07-01","l":[["BRD/06652",10448.5],["BRD/06655",2798.7],["BRD/06667",1306.06],["BRD/06672",9329.01]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD","b":"2627/BRD/0081","d":"2026-07-03","l":[["BRD/06673",50000.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0082","d":"2026-07-03","l":[["BRD/06674",22261.0],["BRD/06675",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0083","d":"2026-07-05","l":[["BRD/06677",22261.0],["BRD/06678",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0084","d":"2026-07-06","l":[["BRD/06682",22261.0],["BRD/06683",22261.0]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD","b":"2627/BRD/0085","d":"2026-07-08","l":[["BRD/06681",50000.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0086","d":"2026-07-08","l":[["BRD/06679",22261.0],["BRD/06680",22261.0]]},{"c":"ARCH ELECTRICAL","b":"2627/BRD/0087","d":"2026-07-10","l":[["BRD/06697",11000.0]]},{"c":"DEEPAK  NITRITE  LIMITED","b":"2627/BRD/0088","d":"2026-07-10","l":[["BRD/06685",26930.0],["BRD/06689",10770.0]]},{"c":"DEEPAK  NITRITE  LIMITED","b":"2627/BRD/0089","d":"2026-07-10","l":[["BRD/06688",26930.0],["BRD/06694",10770.0]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD DAHEJ","b":"2627/BRD/0090","d":"2026-07-10","l":[["BRD/06686",26434.5]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD DAHEJ","b":"2627/BRD/0091","d":"2026-07-10","l":[["BRD/06687",26434.54]]},{"c":"DEEPAK  NITRITE  LIMITED","b":"2627/BRD/0092","d":"2026-07-11","l":[["BRD/06692",26930.0],["BRD/06701",10770.0]]},{"c":"DEEPAK  NITRITE  LIMITED","b":"2627/BRD/0093","d":"2026-07-13","l":[["BRD/06698",26930.0],["BRD/06706",10770.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0094","d":"2026-07-13","l":[["BRD/06690",22261.0],["BRD/06691",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0095","d":"2026-07-13","l":[["BRD/06695",22261.0],["BRD/06696",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0096","d":"2026-07-13","l":[["BRD/06702",22261.0],["BRD/06703",22261.0]]},{"c":"DEEPAK  NITRITE  LIMITED","b":"2627/BRD/0097","d":"2026-07-14","l":[["BRD/06704",26930.0],["BRD/06710",10770.0]]},{"c":"DEEPAK  NITRITE  LIMITED","b":"2627/BRD/0098","d":"2026-07-14","l":[["BRD/06705",26930.0],["BRD/06711",10770.0]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD","b":"2627/BRD/0099","d":"2026-07-16","l":[["BRD/06676",373.16],["BRD/06684",1306.06],["BRD/06693",1306.06],["BRD/06699",1679.22],["BRD/06700",13060.62],["BRD/06713",13060.62]]},{"c":"DEEPAK  NITRITE  LIMITED","b":"2627/BRD/0100","d":"2026-07-16","l":[["BRD/06707",26930.0],["BRD/06719",10770.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0101","d":"2026-07-17","l":[["BRD/06708",22261.0],["BRD/06709",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0102","d":"2026-07-19","l":[["BRD/06717",22261.0],["BRD/06718",22261.0]]},{"c":"DEEPAK  NITRITE  LIMITED","b":"2627/BRD/0103","d":"2026-07-19","l":[["BRD/06712",26930.0],["BRD/06726",10770.0]]},{"c":"NTPC","b":"2627/BRD/0104","d":"2026-07-19","l":[["BRD/06720",11250.0],["BRD/06721",11250.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0105","d":"2026-07-20","l":[["BRD/06723",34635.0]]},{"c":"ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED","b":"2627/BRD/0106","d":"2026-07-19","l":[["BRD/06724",34635.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0107","d":"2026-07-21","l":[["BRD/06727",22261.0],["BRD/06728",22261.0]]},{"c":"DEEPAK  NITRITE  LIMITED","b":"2627/BRD/0108","d":"2026-07-22","l":[["BRD/06722",26930.0],["BRD/06732",10770.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0109","d":"2026-07-23","l":[["BRD/06730",22261.0],["BRD/06731",22261.0]]},{"c":"DEEPAK  NITRITE  LIMITED","b":"2627/BRD/0110","d":"2026-07-24","l":[["BRD/06729",26930.0],["BRD/06736",10770.0]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD DAHEJ","b":"2627/BRD/0111","d":"2026-07-27","l":[["BRD/06733",43998.8]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD DAHEJ","b":"2627/BRD/0112","d":"2026-07-27","l":[["BRD/06734",43998.8]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0113","d":"2026-07-27","l":[["BRD/06737",22261.0],["BRD/06738",22261.0]]},{"c":"DEEPAK  NITRITE  LIMITED","b":"2627/BRD/0114","d":"2026-07-28","l":[["BRD/06735",26930.0],["BRD/06744",10770.0]]},{"c":"DEEPAK  NITRITE  LIMITED","b":"2627/BRD/0115","d":"2026-07-28","l":[["BRD/06739",26930.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0116","d":"2026-07-28","l":[["BRD/06740",22261.0],["BRD/06741",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0117","d":"2026-07-29","l":[["BRD/06742",22261.0],["BRD/06743",22261.0]]},{"c":"DEEPAK  NITRITE  LIMITED","b":"2627/BRD/0118","d":"2026-07-30","l":[["BRD/06747",26930.0],["BRD/06753",10770.0]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD","b":"2627/BRD/0119","d":"2026-08-01","l":[["BRD/06750",50000.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0120","d":"2026-08-01","l":[["BRD/06745",22261.0],["BRD/06746",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0121","d":"2026-08-01","l":[["BRD/06751",22261.0],["BRD/06752",22261.0]]},{"c":"GUJARAT ALKALIES & CHEMICALS LTD","b":"2627/BRD/0122","d":"2026-08-01","l":[["BRD/06714",932.9],["BRD/06715",932.9],["BRD/06716",5970.57],["BRD/06725",2798.7],["BRD/06748",1679.22],["BRD/06749",373.16],["BRD/06754",1306.06],["BRD/06755",1679.22],["BRD/06757",1026.19],["BRD/06762",1306.06]]},{"c":"GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR","b":"2627/BRD/0123","d":"2026-08-01","l":[["GND/00017",110000.0]]},{"c":"DEEPAK  NITRITE  LIMITED","b":"2627/BRD/0124","d":"2026-08-02","l":[["BRD/06756",26930.0],["BRD/06765",10770.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0125","d":"2026-08-03","l":[["BRD/06758",22261.0],["BRD/06759",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0126","d":"2026-08-03","l":[["BRD/06760",22261.0],["BRD/06761",22261.0]]},{"c":"DEEPAK  NITRITE  LIMITED","b":"2627/BRD/0127","d":"2026-08-04","l":[["BRD/06766",26930.0],["BRD/06769",10770.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0128","d":"2026-08-05","l":[["BRD/06763",22261.0],["BRD/06764",22261.0]]},{"c":"RAJKOT MUNICIPAL CORPORATION","b":"2627/BRD/0129","d":"2026-08-06","l":[["BRD/06767",22261.0],["BRD/06768",22261.0]]}];
export function parseBillingRegister(text){
  const tokens = []; const re = />([^<>]+)</g; let m;
  text = String(text || '');
  while ((m = re.exec(text))){ const tk = m[1].replace(/&amp;/g, '&').trim(); if (tk) tokens.push(tk); }
  const hdr = /^(.+?)\s*-\s*(\d{4}\/[A-Z]{2,5}\/\d+)\s*-\s*\((\d{2})-(\d{2})-(\d{4})\)$/;
  const lrre = /^[A-Z]{2,5}\/\d+$/;
  const num = /^-?[\d,]+(\.\d+)?$/;
  const bills = []; let cur = null, curlr = null, nums = [];
  const flush = () => {
    if (cur && curlr){
      const amt = nums.length >= 2 ? Number(nums[1].replace(/,/g, '')) : (nums.length ? Number(nums[0].replace(/,/g, '')) : 0);
      cur.lines.push([curlr, Math.round(amt * 100) / 100]);
    }
    curlr = null; nums = [];
  };
  tokens.forEach(t => {
    const h = hdr.exec(t);
    if (h){ flush(); if (cur) bills.push(cur); cur = { client: h[1], billNo: h[2], date: h[5] + '-' + h[4] + '-' + h[3], lines: [] }; }
    else if (lrre.test(t)){ flush(); curlr = t; }
    else if (num.test(t) && curlr){ nums.push(t); }
  });
  flush(); if (cur) bills.push(cur);
  bills.forEach(b => { b.total = Math.round(b.lines.reduce((a, x) => a + x[1], 0) * 100) / 100; });
  return bills;
}
export function isBillingRegister(text){
  text = String(text || '');
  return /<html/i.test(text.slice(0, 500)) && text.indexOf('LR NO') >= 0 && /\d{4}\/[A-Z]{2,5}\/\d+\s*-\s*\(\d{2}-\d{2}-\d{4}\)/.test(text);
}
export function registerToInvoiceAoa(bills){
  /* convert parsed register bills into the invoice-import AOA shape (company-wise) */
  const rows = [['invoice_no', 'date', 'client_name', 'taxable_amount', 'gst_pct', 'total', 'notes']];
  bills.forEach(b => rows.push([b.billNo, b.date, b.client, b.total, 0, b.total, b.lines.length + ' LR lines from billing register']));
  return rows;
}
export function ensureBillingBackup(db){
  if (db.billingBackup && db.billingBackup.length && db.billingBackup[0].client) return db;
  db.billingBackup = BGTS_BILLING_BACKUP.map(g => {
    let total = 0; g.l.forEach(x => { total += x[1]; });
    return { no: g.b, client: g.c, date: g.d, lines: g.l, total: Math.round(total * 100) / 100 };
  });
  return db;
}

/* ---------- outstanding report reconciliation + sample purge ---------- */
export const BGTS_OUTSTANDING = {"88|DEEPAK NITRITE LIMITED":[44486.0,44486.0,"2026-07-10","DEEPAK NITRITE LIMITED","0088"],"89|DEEPAK NITRITE LIMITED":[44486.0,44486.0,"2026-07-10","DEEPAK NITRITE LIMITED","0089"],"92|DEEPAK NITRITE LIMITED":[44486.0,44486.0,"2026-07-11","DEEPAK NITRITE LIMITED","0092"],"93|DEEPAK NITRITE LIMITED":[44486.0,44486.0,"2026-07-13","DEEPAK NITRITE LIMITED","0093"],"97|DEEPAK NITRITE LIMITED":[44486.0,44486.0,"2026-07-14","DEEPAK NITRITE LIMITED","0097"],"98|DEEPAK NITRITE LIMITED":[44486.0,44486.0,"2026-07-14","DEEPAK NITRITE LIMITED","0098"],"100|DEEPAK NITRITE LIMITED":[44486.0,44486.0,"2026-07-16","DEEPAK NITRITE LIMITED","0100"],"103|DEEPAK NITRITE LIMITED":[44486.0,44486.0,"2026-07-19","DEEPAK NITRITE LIMITED","0103"],"108|DEEPAK NITRITE LIMITED":[44486.0,44486.0,"2026-07-22","DEEPAK NITRITE LIMITED","0108"],"110|DEEPAK NITRITE LIMITED":[44486.0,44486.0,"2026-07-24","DEEPAK NITRITE LIMITED","0110"],"114|DEEPAK NITRITE LIMITED":[44486.0,44486.0,"2026-07-28","DEEPAK NITRITE LIMITED","0114"],"115|DEEPAK NITRITE LIMITED":[31777.4,31777.4,"2026-07-28","DEEPAK NITRITE LIMITED","0115"],"118|DEEPAK NITRITE LIMITED":[44486.0,44486.0,"2026-07-30","DEEPAK NITRITE LIMITED","0118"],"124|DEEPAK NITRITE LIMITED":[44486.0,44486.0,"2026-08-02","DEEPAK NITRITE LIMITED","0124"],"127|DEEPAK NITRITE LIMITED":[44486.0,44486.0,"2026-08-04","DEEPAK NITRITE LIMITED","0127"],"81|GUJARAT ALKALIES & CHEMICALS LTD":[59000.0,59000.0,"2026-07-03","GUJARAT ALKALIES & CHEMICALS LTD","0081"],"85|GUJARAT ALKALIES & CHEMICALS LTD":[59000.0,59000.0,"2026-07-08","GUJARAT ALKALIES & CHEMICALS LTD","0085"],"99|GUJARAT ALKALIES & CHEMICALS LTD":[36327.17,36327.17,"2026-07-16","GUJARAT ALKALIES & CHEMICALS LTD","0099"],"119|GUJARAT ALKALIES & CHEMICALS LTD":[59000.0,59000.0,"2026-08-01","GUJARAT ALKALIES & CHEMICALS LTD","0119"],"122|GUJARAT ALKALIES & CHEMICALS LTD":[21245.88,21245.88,"2026-08-01","GUJARAT ALKALIES & CHEMICALS LTD","0122"],"90|GUJARAT ALKALIES & CHEMICALS LTD DAHEJ":[31192.71,31192.71,"2026-07-10","GUJARAT ALKALIES & CHEMICALS LTD DAHEJ","0090"],"91|GUJARAT ALKALIES & CHEMICALS LTD DAHEJ":[31192.76,31192.76,"2026-07-10","GUJARAT ALKALIES & CHEMICALS LTD DAHEJ","0091"],"111|GUJARAT ALKALIES & CHEMICALS LTD DAHEJ":[51918.58,51918.58,"2026-07-27","GUJARAT ALKALIES & CHEMICALS LTD DAHEJ","0111"],"112|GUJARAT ALKALIES & CHEMICALS LTD DAHEJ":[51918.58,51918.58,"2026-07-27","GUJARAT ALKALIES & CHEMICALS LTD DAHEJ","0112"],"23|GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR":[135239.97,20669.97,"2026-05-01","GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR","0023"],"47|GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR":[135329.85,20643.85,"2026-06-01","GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR","0047"],"79|GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR":[142499.15,142499.15,"2026-07-01","GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR","0079"],"123|GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR":[129800.0,129800.0,"2026-08-01","GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR","0123"],"4|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-04-06","RAJKOT MUNICIPAL CORPORATION","0004"],"35|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-05-15","RAJKOT MUNICIPAL CORPORATION","0035"],"36|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-05-15","RAJKOT MUNICIPAL CORPORATION","0036"],"62|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-06-11","RAJKOT MUNICIPAL CORPORATION","0062"],"69|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-06-24","RAJKOT MUNICIPAL CORPORATION","0069"],"75|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-06-25","RAJKOT MUNICIPAL CORPORATION","0075"],"78|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-07-01","RAJKOT MUNICIPAL CORPORATION","0078"],"82|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-07-03","RAJKOT MUNICIPAL CORPORATION","0082"],"83|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-07-05","RAJKOT MUNICIPAL CORPORATION","0083"],"84|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-07-06","RAJKOT MUNICIPAL CORPORATION","0084"],"86|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-07-08","RAJKOT MUNICIPAL CORPORATION","0086"],"94|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-07-13","RAJKOT MUNICIPAL CORPORATION","0094"],"95|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-07-13","RAJKOT MUNICIPAL CORPORATION","0095"],"96|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-07-13","RAJKOT MUNICIPAL CORPORATION","0096"],"101|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-07-17","RAJKOT MUNICIPAL CORPORATION","0101"],"102|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-07-19","RAJKOT MUNICIPAL CORPORATION","0102"],"107|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-07-21","RAJKOT MUNICIPAL CORPORATION","0107"],"109|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-07-23","RAJKOT MUNICIPAL CORPORATION","0109"],"113|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-07-27","RAJKOT MUNICIPAL CORPORATION","0113"],"116|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-07-28","RAJKOT MUNICIPAL CORPORATION","0116"],"117|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-07-29","RAJKOT MUNICIPAL CORPORATION","0117"],"120|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-08-01","RAJKOT MUNICIPAL CORPORATION","0120"],"121|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-08-01","RAJKOT MUNICIPAL CORPORATION","0121"],"125|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-08-03","RAJKOT MUNICIPAL CORPORATION","0125"],"126|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-08-03","RAJKOT MUNICIPAL CORPORATION","0126"],"128|RAJKOT MUNICIPAL CORPORATION":[44522.0,44522.0,"2026-08-05","RAJKOT MUNICIPAL CORPORATION","0128"],"1|SARDAR SAROVAR HOLIDAY RESORTS LLP":[5250.0,5250.0,"2025-04-08","SARDAR SAROVAR HOLIDAY RESORTS LLP","0001"]};
export function ensureNoSamples(db){
  ['clients','drivers','vendors','routes','contracts','bookings','invoices','payments','lhcs','advances','expenses','lrs','acctExp','vehicles','renewals','inquiries']
    .forEach(k => { if (!db[k]) db[k] = []; });
  ['c1','c2'].forEach(id => removeById(db.clients, id));
  ['d1','d2'].forEach(id => removeById(db.drivers, id));
  removeById(db.vendors, 've1');
  ['r1','r2'].forEach(id => removeById(db.routes, id));
  removeById(db.contracts, 'ct1');
  const sampleLrIds = [];
  db.lrs = db.lrs.filter(l => {
    if (l.bookingId === 'b1' || l.bookingId === 'b2' || l.bookingId === 'b3'){ sampleLrIds.push(l.id); return false; }
    return true;
  });
  ['b1','b2','b3'].forEach(id => removeById(db.bookings, id));
  db.payments = db.payments.filter(p => p.invoiceId !== 'i1');
  removeById(db.invoices, 'i1');
  removeById(db.lhcs, 'lh1');
  removeById(db.advances, 'ad1');
  ['e1','e2','e3'].forEach(id => removeById(db.expenses, id));
  db.acctExp = db.acctExp.filter(e => sampleLrIds.indexOf(e.lrId) < 0);
  const badVeh = [];
  db.vehicles = db.vehicles.filter(v => {
    const rn = String(v.regNo).replace(/\s/g, '').toUpperCase();
    if (rn.indexOf('(SAMPLE)') >= 0 || rn === 'GJ06(SAMPLE)1234'){ badVeh.push(v.id); return false; }
    return true;
  });
  db.renewals = db.renewals.filter(r => badVeh.indexOf(r.vehicleId) < 0);
  db.vehicles.forEach(v => { if (v.driverId === 'd1' || v.driverId === 'd2') v.driverId = ''; });
  return db;
}
export function ensureRegisterInvoices(db){
  if (db.regSeeded) return db;
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  const cmap = {};
  db.clients.forEach(c => { cmap[norm(c.name).toUpperCase()] = c.id; });
  const clientFor = name => {
    const k = norm(name).toUpperCase();
    if (!cmap[k]){ const c = { id: uid('c'), name: norm(name), gstin: '', phone: '', email: '', creditDays: 45, addr: '' }; db.clients.push(c); cmap[k] = c.id; }
    return cmap[k];
  };
  const main = (db.branches && db.branches[0]) ? db.branches[0].id : '';
  const usedKeys = {};
  const seedOne = (invNo, client, date, total, balance, hasOut) => {
    if (db.invoices.some(i => i.invNo === invNo)) return;
    const inv = { id: uid('i'), invNo, date, branchId: main, clientId: clientFor(client), amount: total, gstPct: 0, total, dueDate: '', notes: 'Billing register reconciliation', bookingIds: [] };
    db.invoices.push(inv);
    const payAmt = hasOut ? Math.round((total - balance) * 100) / 100 : total;
    if (payAmt > 0.005){
      db.payments.push({ id: uid('p'), mrNo: 'MR-' + String(db.seq.mr).padStart(4, '0'), invoiceId: inv.id, date, amount: payAmt, mode: 'NEFT/RTGS', ref: hasOut ? 'Receipts/deductions per Outstanding Report 07-08-2026' : 'Paid — opening reconciliation' });
      db.seq.mr++;
    }
  };
  BGTS_BILLING_BACKUP.forEach(g => {
    const short = String(g.b.split('/').pop()).replace(/^0+/, '') || '0';
    const key = short + '|' + norm(g.c).toUpperCase();
    const o = BGTS_OUTSTANDING[key];
    if (o){ usedKeys[key] = 1; seedOne(g.b, o[3], o[2], o[0], o[1], true); }
    else {
      let total = 0; g.l.forEach(x => { total += x[1]; });
      seedOne(g.b, g.c, g.d, Math.round(total * 100) / 100, 0, false);
    }
  });
  Object.keys(BGTS_OUTSTANDING).forEach(key => {
    if (usedKeys[key]) return;
    const o = BGTS_OUTSTANDING[key];
    seedOne(o[4] + ' (' + o[3].split(' ')[0] + ')', o[3], o[2], o[0], o[1], true);
  });
  db.regSeeded = true;
  return db;
}
/* Reconcile ANY pre-existing invoices (e.g. imported in an earlier build and living in device storage)
   against the Outstanding Report 07-08-2026: bills on the report keep exactly the PDF balance, every other
   2627/BRD register bill is marked fully paid. Runs once (flag pdfRecon) so later genuine receipts are untouched. */
export function ensureOutstandingRecon(db){
  if (db.pdfRecon === '2026-08-07') return db;
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toUpperCase();
  const cname = {}; db.clients.forEach(c => { cname[c.id] = norm(c.name); });
  const paidOf = inv => { let s = 0; db.payments.forEach(p => { if (p.invoiceId === inv.id) s += Number(p.amount) || 0; }); return s; };
  db.invoices.forEach(inv => {
    let short = null;
    const m1 = String(inv.invNo).match(/^\d{4}\/[A-Z]{2,5}\/(\d+)\s*$/);
    if (m1) short = String(m1[1]).replace(/^0+/, '') || '0';
    else { const m2 = String(inv.invNo).match(/^0*(\d+)\s*\(/); if (m2) short = m2[1]; }
    if (short === null) return;
    const key = short + '|' + (cname[inv.clientId] || '');
    let target = null;
    if (BGTS_OUTSTANDING[key]){
      const o = BGTS_OUTSTANDING[key];
      /* PDF is authoritative for open bills: correct total to the PDF bill amount (legacy imports carried pre-GST register totals) */
      if (Math.abs((Number(inv.total) || 0) - o[0]) > 0.005){ inv.amount = o[0]; inv.total = o[0]; }
      target = o[1];
    }
    else if (/^2627\/BRD\//.test(inv.invNo)) target = 0;
    if (target === null) return;
    let out = Math.round(((Number(inv.total) || 0) - paidOf(inv)) * 100) / 100;
    let diff = Math.round((out - target) * 100) / 100;
    if (Math.abs(diff) <= 0.005) return;
    if (diff < 0){
      /* over-collected vs the PDF: drop earlier auto-reconciliation receipts, then recompute */
      db.payments = db.payments.filter(p => !(p.invoiceId === inv.id && /reconciliation|Outstanding Report/.test(p.ref || '')));
      out = Math.round(((Number(inv.total) || 0) - paidOf(inv)) * 100) / 100;
      diff = Math.round((out - target) * 100) / 100;
    }
    if (diff > 0.005){
      db.payments.push({ id: uid('p'), mrNo: 'MR-' + String(db.seq.mr).padStart(4, '0'), invoiceId: inv.id, date: inv.date, amount: diff, mode: 'NEFT/RTGS', ref: 'Reconciled per Outstanding Report 07-08-2026' });
      db.seq.mr++;
    }
  });
  db.pdfRecon = '2026-08-07';
  return db;
}

/* ---------- inquiries ---------- */
export function blankInquiry(){
  return { id: '', inqNo: '', status: 'OPEN', date: todayISO(), branchId: '', clientId: '', partyName: '', contact: '',
    fromPlace: '', toPlace: '', vehicleType: '', cargo: '', weightMT: '', expectedDate: '', rateQuoted: '',
    ownershipPref: '', notes: '', assignType: '', assignedVehicleId: '', assignedVendorId: '', assignedTruckNo: '', lrId: '' };
}
export function inqPartyName(db, q){ return q.clientId ? clientName(db, q.clientId) : (q.partyName || '—'); }
export function convertInquiryToLRDraft(db, inq){
  const l = blankLR();
  const iCli = inq.clientId ? byId(db.clients, inq.clientId) : null;
  l.fromPlace = inq.fromPlace || ''; l.toPlace = inq.toPlace || '';
  l.lorryType = inq.vehicleType || '';
  l.ownership = inq.assignType || inq.ownershipPref || 'Owned';
  l.truckNo = (inq.assignType === 'Owned' && inq.assignedVehicleId) ? vehicleReg(db, inq.assignedVehicleId) : (inq.assignedTruckNo || '');
  l.bookingBranch = branchName(db, inq.branchId) !== '—' ? branchName(db, inq.branchId) : (db.branches && db.branches[0] ? db.branches[0].name : 'VADODARA');
  const pn = inqPartyName(db, inq);
  l.consignor = { name: pn === '—' ? '' : pn, city: iCli ? (iCli.addr || '') : '', contact: inq.contact || (iCli ? iCli.phone || '' : ''), pan: '', gst: iCli ? (iCli.gstin || '') : '' };
  if (inq.cargo) l.goods = [{ desc: inq.cargo, pkgType: '', pcs: '', aw: String(inq.weightMT || ''), cw: String(inq.weightMT || ''), l: '', w: '', h: '' }];
  l.hire = { vendorId: inq.assignedVendorId || '', amount: '', advance: '', payments: [] };
  l.remark = inq.notes || '';
  l.charges.freight = String(Number(inq.rateQuoted) || '');
  return l;
}

/* ---------- ageing ---------- */
export function ageingBuckets(db){
  const b = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  db.invoices.forEach(inv => {
    const out = invOutstanding(db, inv); if (out <= 0) return;
    const age = daysSince(inv.date);
    if (age <= 30) b['0-30'] += out; else if (age <= 60) b['31-60'] += out; else if (age <= 90) b['61-90'] += out; else b['90+'] += out;
  });
  return b;
}

/* ---------- bank statement import + reconciliation ---------- */
const BANK_ALIASES = { date:'date', txndate:'date', valuedate:'date', transactiondate:'date',
  narration:'narr', description:'narr', particulars:'narr', details:'narr', remarks:'narr',
  ref:'ref', refno:'ref', utr:'ref', utrno:'ref', chqno:'ref', chequeno:'ref', referenceno:'ref',
  credit:'credit', creditamount:'credit', deposit:'credit', cr:'credit',
  debit:'debit', debitamount:'debit', withdrawal:'debit', dr:'debit',
  amount:'amount', type:'type', drcr:'type' };
export function importBankAoa(db, aoa){
  if (!aoa || aoa.length < 2) return { added: 0, dupes: 0, debits: 0, bad: 0, error: 'No data rows.' };
  const cols = aoa[0].map(hd => BANK_ALIASES[String(hd || '').toLowerCase().replace(/[^a-z0-9]/g, '')] || null);
  const seen = {}; db.bankTxns.forEach(t => { seen[t.dedupe] = 1; });
  let added = 0, dupes = 0, debits = 0, bad = 0;
  const n = v => { const x = Number(String(v == null ? '' : v).replace(/[₹,\s]/g, '')); return isNaN(x) ? 0 : x; };
  for (let r = 1; r < aoa.length; r++){
    const raw = aoa[r]; if (!raw) continue;
    const o = {}; cols.forEach((k, c) => { if (k && raw[c] != null) o[k] = String(raw[c]).trim(); });
    if (!o.date && !o.narr && !o.credit && !o.amount) continue;
    let credit = n(o.credit);
    if (!credit && o.amount){
      const amt = n(o.amount);
      if (/^(cr|c)/i.test(o.type || '')) credit = Math.abs(amt);
      else if (/^(dr|d)/i.test(o.type || '')) credit = 0;
      else credit = amt > 0 ? amt : 0;
    }
    if (credit <= 0){ if (n(o.debit) > 0 || n(o.amount) < 0) debits++; else bad++; continue; }
    const dt = impDate(o.date);
    if (dt === null){ bad++; continue; }
    const key = dt + '|' + credit + '|' + String(o.ref || '').slice(0, 20) + '|' + String(o.narr || '').slice(0, 25);
    if (seen[key]){ dupes++; continue; }
    seen[key] = 1;
    db.bankTxns.push({ id: uid('bt'), date: dt, narration: o.narr || '', ref: o.ref || '', amount: credit, status: 'UNMATCHED', dedupe: key, paymentId: '' });
    added++;
  }
  return { added, dupes, debits, bad };
}
export function bankSuggest(db, txn){
  const open = db.invoices.filter(i => invOutstanding(db, i) > 0);
  const narr = String(txn.narration || '').toUpperCase();
  const score = inv => {
    let s = 0;
    if (Math.abs(invOutstanding(db, inv) - txn.amount) < 0.01) s += 100;
    String(clientName(db, inv.clientId)).toUpperCase().split(/[^A-Z0-9]+/).forEach(w => { if (w.length > 3 && narr.indexOf(w) >= 0) s += 20; });
    return s - daysSince(inv.date) / 1000;
  };
  return open.slice().sort((a, b) => score(b) - score(a));
}
export function matchBankTxn(db, txnId, invoiceId){
  const t = byId(db.bankTxns, txnId), inv = byId(db.invoices, invoiceId);
  if (!t || !inv) return null;
  const p = { id: uid('p'), mrNo: 'MR-' + String(db.seq.mr).padStart(4, '0'), invoiceId: inv.id, date: t.date, amount: t.amount, mode: 'NEFT/RTGS', ref: t.ref || String(t.narration).slice(0, 30), bankTxnId: t.id };
  db.seq.mr++;
  db.payments.push(p);
  t.status = 'MATCHED'; t.paymentId = p.id;
  if (invOutstanding(db, inv) <= 0.01){ (inv.bookingIds || []).forEach(bid => { const b = byId(db.bookings, bid); if (b) b.status = 'Paid'; }); }
  return p;
}

/* ---------- invoice bulk import ---------- */
const INV_ALIASES = { invoiceno:'invNo', invno:'invNo', billno:'invNo', invoicenumber:'invNo',
  date:'date', invoicedate:'date', billdate:'date',
  client:'client', clientname:'client', party:'client', partyname:'client', customer:'client',
  taxable:'amount', taxableamount:'amount', amount:'amount',
  gst:'gstPct', gstpct:'gstPct', gstrate:'gstPct',
  total:'total', grosstotal:'total', grossamount:'total', invoicetotal:'total',
  duedate:'dueDate', branch:'branch', notes:'notes', narration:'notes' };
export function buildInvImportPlan(db, aoa){
  const plan = { items: [], unknownHeaders: [] };
  if (!aoa || aoa.length < 2){ plan.error = 'No data rows — row 1 must be headers.'; return plan; }
  const cols = aoa[0].map(hd => {
    const k = String(hd || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (INV_ALIASES[k]) return INV_ALIASES[k];
    if (String(hd).trim()) plan.unknownHeaders.push(String(hd).trim());
    return null;
  });
  const nos = {}; db.invoices.forEach(i => { nos[i.invNo] = 1; });
  let auto = db.seq.inv;
  const n = v => { const x = Number(String(v == null ? '' : v).replace(/[₹,\s]/g, '')); return isNaN(x) ? 0 : x; };
  for (let r = 1; r < aoa.length; r++){
    const raw = aoa[r]; if (!raw) continue;
    if (raw.every(c => String(c == null ? '' : c).trim() === '')) continue;
    const o = {}; cols.forEach((k, c) => { if (k && raw[c] != null) o[k] = String(raw[c]).trim(); });
    const errs = [], warns = [];
    let invNo = o.invNo, autoNo = false;
    if (!invNo){ invNo = 'INV-' + String(auto).padStart(4, '0'); auto++; autoNo = true; }
    if (nos[invNo]) errs.push('Duplicate invoice no ' + invNo); else nos[invNo] = 1;
    let dt = impDate(o.date);
    if (dt === null){ errs.push('Bad date "' + o.date + '"'); dt = todayISO(); }
    if (!o.client) errs.push('Client name missing');
    let cli = null;
    db.clients.forEach(c => { if (c.name.toUpperCase() === String(o.client || '').toUpperCase()) cli = c; });
    if (o.client && !cli) warns.push('New client "' + o.client + '" will be created');
    const amt = n(o.amount), g = n(o.gstPct);
    const total = n(o.total) || Math.round(amt * (1 + g / 100) * 100) / 100;
    if (total <= 0) errs.push('Amount/total is zero');
    let branchId = db.branches[0].id;
    db.branches.forEach(b => { if (b.name.toUpperCase() === String(o.branch || '').toUpperCase()) branchId = b.id; });
    plan.items.push({ row: r + 1, errors: errs, warns, autoNo, clientNameNew: (o.client && !cli) ? o.client : '',
      inv: { invNo, date: dt, clientId: cli ? cli.id : '', amount: amt || total, gstPct: g, total,
        dueDate: o.dueDate ? (impDate(o.dueDate) || '') : '', branchId, notes: o.notes || '', bookingIds: [] } });
  }
  return plan;
}
export function applyInvImportAoa(db, aoa){
  const plan = buildInvImportPlan(db, aoa);
  if (plan.error) return { created: 0, skipped: 0, error: plan.error };
  const cmap = {}; db.clients.forEach(c => { cmap[c.name.toUpperCase()] = c.id; });
  let created = 0, autoUsed = 0;
  plan.items.filter(it => !it.errors.length).forEach(it => {
    const inv = it.inv;
    if (!inv.clientId && it.clientNameNew){
      const key = it.clientNameNew.toUpperCase();
      if (!cmap[key]){ const nc = { id: uid('c'), name: it.clientNameNew, gstin: '', phone: '', email: '', creditDays: 30, addr: '' }; db.clients.push(nc); cmap[key] = nc.id; }
      inv.clientId = cmap[key];
    }
    if (db.invoices.some(x => x.invNo === inv.invNo)){ inv.invNo = 'INV-' + String(db.seq.inv).padStart(4, '0'); db.seq.inv++; }
    else if (it.autoNo) autoUsed++;
    if (!inv.dueDate){
      const c = byId(db.clients, inv.clientId) || {};
      const dd = new Date(inv.date + 'T00:00:00'); dd.setDate(dd.getDate() + (Number(c.creditDays) || 30));
      inv.dueDate = dd.getFullYear() + '-' + pad(dd.getMonth() + 1) + '-' + pad(dd.getDate());
    }
    inv.id = uid('i');
    db.invoices.push(inv);
    created++;
  });
  if (autoUsed > 0) db.seq.inv += autoUsed;
  return { created, skipped: plan.items.length - created };
}

/* ---------- money receipt ---------- */
export function numWordsIN(n){
  n = Math.round(Number(n) || 0);
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? ones[x] : (tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : ''));
  const three = x => (x >= 100 ? ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  const parts = [];
  const cr = Math.floor(n / 10000000); n %= 10000000;
  const lk = Math.floor(n / 100000); n %= 100000;
  const th = Math.floor(n / 1000); n %= 1000;
  if (cr) parts.push(three(cr) + ' Crore');
  if (lk) parts.push(two(lk) + ' Lakh');
  if (th) parts.push(two(th) + ' Thousand');
  if (n) parts.push(three(n));
  return parts.join(' ');
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

/* Brand mark shared by every printable document (LR, receipt, and any future
   one). `logoUri` is a data: URI resolved at call time via
   src/logoAsset.js's getLogoDataUri() (screens pass it in — see
   LRFormScreen.js/AccountingScreen.js), since this file is plain JS with no
   React Native/expo-asset imports. Falls back to a plain text "BGTS-OS" mark
   if the caller didn't pass one (asset failed to load, or an older call site
   hasn't been updated) so a print action never breaks over a missing logo.
   Landscape artwork — sized by height only, width follows the logo's own
   aspect ratio, so it's never stretched. */
function bgtsLogoImg(logoUri, height){
  height = height || 40;
  if (!logoUri) return '<div style="color:#fff;font-weight:800;font-size:' + Math.round(height * 0.4) + 'px;letter-spacing:.5px">BGTS-OS</div>';
  return '<img src="' + logoUri + '" alt="BGTS" style="height:' + height + 'px;width:auto;display:block" />';
}
/* Shared page chrome (branded header + base table/print styles) so every printable
   document — LR, receipt, and any future one — looks like one consistent, professional
   document family instead of each screen inventing its own look. */
function printDocStyle(){
  /* Brand palette, matching src/ui.js's C object exactly (this file is plain
     JS with no React Native imports, so the values are duplicated here
     rather than imported, to avoid a circular import with ui.js). */
  return '@page{size:A4;margin:12mm}'
    + '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + 'body{font-family:"Segoe UI",Arial,sans-serif;font-size:11.5px;color:#111;margin:16px;background:#ececed}'
    + '.doc{border:2px solid #2b2b2f;border-radius:10px;overflow:hidden;max-width:800px;margin:0 auto;background:#fff}'
    + '.r{text-align:right}.muted{color:#71717a;font-style:italic}'
    + '.head{background:#2b2b2f;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;gap:14px;border-top:3px solid #f6d048}'
    + '.head .brand{display:flex;gap:12px;align-items:center}'
    + '.head h1{margin:0;font-size:18px;letter-spacing:.2px}.head p{margin:3px 0 0;font-size:9.5px;color:#d4d4d8}'
    + '.num{text-align:right;font-size:11px;line-height:1.5;white-space:nowrap}.num b{color:#f6d048;font-size:15px}'
    + 'table{width:100%;border-collapse:collapse}'
    + 'td,th{border:1px solid #d4d4d8;padding:6px 8px;font-size:10.8px;text-align:left;vertical-align:top}'
    + 'th{background:#ececed;font-size:9.5px;text-transform:uppercase;letter-spacing:.3px;color:#302f33}'
    + '.sig{height:60px}'
    + '.totalsTbl td{border-color:#a1a1aa}'
    + '.grossRow td{background:#fbe9de;font-size:13px}'
    + '.terms{font-size:8.5px;color:#555;padding:9px 12px;border-top:1px solid #a1a1aa;background:#f7f7f7}'
    + '@media print{ body{background:#fff;margin:0} .doc{border-radius:0;max-width:none} }';
}

/* ---------- money receipt HTML (for PDF sharing) ---------- */
/* logoUri: optional data: URI from src/logoAsset.js's getLogoDataUri() —
   pass it if you have it (screens await it before calling this), omit it and
   the header falls back to a plain text mark instead of failing. */
export function receiptHtml(db, p, logoUri){
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inv = byId(db.invoices, p.invoiceId) || {};
  const br = byId(db.branches || [], inv.branchId) || {};
  const co = { name: br.entityName || db.company.name, addr: br.addr || db.company.addr, gstin: br.gstin || db.company.gstin };
  const bal = inv.id ? invOutstanding(db, inv) : 0;
  return '<html><head><meta charset="utf-8"><title>Receipt ' + esc(p.mrNo || '') + '</title><style>' + printDocStyle() + '</style></head><body><div class="doc">'
    + '<div class="head"><div class="brand">' + bgtsLogoImg(logoUri, 40) + '<div><h1>' + esc(co.name) + '</h1><p>' + esc(co.addr) + (co.gstin ? ' · GSTIN: ' + esc(co.gstin) : '') + '</p><p>MONEY RECEIPT</p></div></div>'
    + '<div class="num">Receipt No.<br><b>' + esc(p.mrNo || 'MR') + '</b><br>Date: ' + fmtDate(p.date) + '</div></div>'
    + '<table><tr><th style="width:35%">Received with thanks from</th><td><b>' + esc(clientName(db, inv.clientId)) + '</b></td></tr>'
    + '<tr><th>The sum of</th><td><b>' + inr(p.amount) + '</b><br><span style="font-size:10px;color:#555">Rupees ' + esc(numWordsIN(p.amount)) + ' Only</span></td></tr>'
    + '<tr><th>By</th><td>' + esc(p.mode || '—') + (p.ref ? ' · Ref: ' + esc(p.ref) : '') + '</td></tr>'
    + '<tr><th>Against Invoice</th><td>' + esc(inv.invNo || '—') + (inv.total ? ' (invoice total ' + inr(inv.total) + ')' : '') + '</td></tr>'
    + '<tr class="grossRow"><th>Balance after this receipt</th><td><b>' + inr(bal) + '</b></td></tr></table>'
    + '<table><tr><th style="width:50%">Receiver Signature</th><th>For ' + esc(co.name) + '</th></tr><tr><td class="sig"></td><td class="sig"></td></tr></table>'
    + '<div class="terms">Subject to realisation of the instrument/transfer. This is a system-generated receipt from BGTS-OS.</div></div></body></html>';
}

/* ---------- LR document HTML (full v2 format, for PDF sharing) ---------- */
/* logoUri: optional data: URI from src/logoAsset.js's getLogoDataUri() — see
   the same note on receiptHtml() above. */
export function lrHtml(db, l, logoUri){
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const br = byId(db.branches || [], l.branchId) || {};
  const co = { name: br.entityName || db.company.name, addr: br.addr || db.company.addr, gstin: br.gstin || db.company.gstin, phone: br.phone || db.company.phone };
  const party = p => {
    p = p || {};
    let s = '<b>' + esc(p.name || '—') + '</b>';
    if (p.city) s += '<br>' + esc(p.city);
    if (p.contact) s += '<br>Ph: ' + esc(p.contact);
    if (p.gst) s += '<br>GST: ' + esc(p.gst);
    if (p.pan) s += '<br>PAN: ' + esc(p.pan);
    return s;
  };
  const dims = g => (g.l || g.w || g.h) ? esc((g.l || '—') + ' × ' + (g.w || '—') + ' × ' + (g.h || '—')) : '—';
  let goodsRows = '';
  (l.goods || []).forEach((g, i) => {
    goodsRows += '<tr><td>' + (i + 1) + '</td><td>' + esc(g.desc) + '</td><td>' + esc(g.pkgType || '—') + '</td><td class="r">' + esc(g.pcs || '—') + '</td><td class="r">' + esc(g.aw || '—') + '</td><td class="r">' + esc(g.cw || '—') + '</td><td class="r">' + dims(g) + '</td></tr>';
  });
  if (!goodsRows) goodsRows = '<tr><td colspan="7" class="muted">No goods rows recorded.</td></tr>';
  let chg = ''; const ch = l.charges || {};
  if (Number(ch.aboveCh)) chg += '<tr><td>Above ' + esc(ch.abovePct || '') + '%</td><td class="r">' + inr(ch.aboveCh) + '</td></tr>';
  if (Number(ch.belowCh)) chg += '<tr><td>Below ' + esc(ch.belowPct || '') + '%</td><td class="r">' + inr(ch.belowCh) + '</td></tr>';
  LR_CHG.forEach(c => { if (Number(ch[c[0]])) chg += '<tr><td>' + c[1] + '</td><td class="r">' + inr(ch[c[0]]) + '</td></tr>'; });
  if (!chg) chg = '<tr><td class="muted">No charge lines entered.</td><td class="r">—</td></tr>';
  return '<html><head><meta charset="utf-8"><title>LR ' + esc(l.lrNo) + '</title><style>' + printDocStyle()
    + '</style></head><body><div class="doc">'
    + '<div class="head"><div class="brand">' + bgtsLogoImg(logoUri, 40) + '<div><h1>' + esc(co.name) + '</h1><p>' + esc(co.addr) + (co.gstin ? ' · GSTIN: ' + esc(co.gstin) : '') + (co.phone ? ' · Ph: ' + esc(co.phone) : '') + '</p>'
    + '<p>CONSIGNMENT NOTE / LORRY RECEIPT — AT OWNER\'S RISK' + (l.lrType === 'DUMMY' ? ' — <b>DUMMY</b>' : '') + '</p></div></div>'
    + '<div class="num">LR No.<br><b>' + esc(l.lrNo) + '</b><br>Date: ' + fmtDate(l.date) + '<br>' + esc(l.lrType) + '</div></div>'
    + '<table><tr><th>Truck No</th><th>From</th><th>To</th><th>Booking Branch</th><th>To Branch</th><th>Lorry Type</th></tr>'
    + '<tr><td><b>' + esc(l.truckNo) + '</b></td><td>' + esc(l.fromPlace) + '</td><td>' + esc(l.toPlace) + '</td><td>' + esc(l.bookingBranch || '—') + '</td><td>' + esc(l.toBranch || '—') + '</td><td>' + esc(l.lorryType || '—') + '</td></tr></table>'
    + '<table><tr><th style="width:33%">Consignor</th><th style="width:33%">Consignee</th><th>Billing To</th></tr>'
    + '<tr><td>' + party(l.consignor) + '</td><td>' + party(l.consignee) + '</td><td>' + ((l.billingTo && l.billingTo.name) ? party(l.billingTo) : esc(l.billingParty || '—')) + '</td></tr></table>'
    + '<table><tr><th>Invoice No</th><th>Inv. Amt</th><th>Inv. Date</th><th>E-Way No</th><th>E-Way Date</th><th>E-Way Expiry</th><th>P.O. Date</th></tr>'
    + '<tr><td>' + esc(l.invoiceNo || '—') + '</td><td>' + (l.invAmount ? inr(l.invAmount) : '—') + '</td><td>' + fmtDate(l.invoiceDate) + '</td><td>' + esc(l.ewayBillNo || '—') + '</td><td>' + fmtDate(l.ewayBillDate) + '</td><td>' + fmtDate(l.ewayExDate) + '</td><td>' + fmtDate(l.poDate) + '</td></tr></table>'
    + '<table><tr><th>#</th><th>Description</th><th>Pkgs Type</th><th>Pcs</th><th>Actual Wt</th><th>Charged Wt</th><th>L × W × H</th></tr>' + goodsRows
    + '<tr><td colspan="4" class="r"><b>TOTAL</b></td><td class="r"><b>' + esc(l.aWeight || '—') + '</b></td><td class="r"><b>' + esc(l.cWeight || '—') + '</b></td><td></td></tr></table>'
    + '<table><tr><th>Packing</th><th>Private Mark</th><th>LR Mode</th><th>GST Paid By</th><th>GST Slab</th><th>Insurance</th><th>Payment</th><th>Agent</th></tr>'
    + '<tr><td>' + esc(l.packing || '—') + '</td><td>' + esc(l.privateMark || '—') + '</td><td>' + esc(l.lrMode || '—') + '</td><td>' + esc(l.gstPaidBy || '—') + '</td><td>' + esc(l.gstSlab || '—') + '</td><td>' + esc(l.insurance || '—') + '</td><td><b>' + esc(l.payTerms || '—') + '</b></td><td>' + esc(l.agent || '—') + '</td></tr></table>'
    + (l.deliveryAddress ? '<table><tr><th>Delivery Address</th></tr><tr><td>' + esc(l.deliveryAddress) + '</td></tr></table>' : '')
    + '<table class="totalsTbl"><tr><th colspan="2">Freight & Charges</th></tr>' + chg
    + '<tr><td class="r"><b>SUB TOTAL</b></td><td class="r"><b>' + inr(l.subTotal) + '</b></td></tr>'
    + (Number(l.igstAmt) ? '<tr><td class="r">IGST ' + l.igstPct + '%</td><td class="r">' + inr(l.igstAmt) + '</td></tr>' : '')
    + (Number(l.cgstAmt) ? '<tr><td class="r">CGST ' + l.cgstPct + '%</td><td class="r">' + inr(l.cgstAmt) + '</td></tr>' : '')
    + (Number(l.sgstAmt) ? '<tr><td class="r">SGST ' + l.sgstPct + '%</td><td class="r">' + inr(l.sgstAmt) + '</td></tr>' : '')
    + '<tr class="grossRow"><td class="r"><b>GROSS AMOUNT</b></td><td class="r"><b>' + inr(l.gross) + '</b></td></tr></table>'
    + (l.remark ? '<table><tr><th>Remarks</th></tr><tr><td>' + esc(l.remark) + '</td></tr></table>' : '')
    + '<table><tr><th>Employee</th><th>Truck Driver No</th><th style="width:33%">Receiver Signature &amp; Stamp (POD)</th></tr>'
    + '<tr><td>' + esc(l.employee || '—') + '</td><td>' + esc(l.driverNo || '—') + '</td><td class="sig"></td></tr></table>'
    + '<div class="terms">Goods are transported at owner\'s risk. Delivery subject to terms &amp; conditions of carriage of ' + esc(co.name) + '. Consignment must be insured by the consignor. Subject to Vadodara jurisdiction. System-generated from BGTS-OS.</div>'
    + '</div></body></html>';
}
