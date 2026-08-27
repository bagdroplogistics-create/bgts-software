/* BGTS-OS core business logic v2 — pure JS, no React Native imports.
   Shared data model with the web build (v1.2) + v2 additions: full LR entity,
   LHC (truck hire) with TDS 194C, driver advances, accounting expense heads. */
import qrcode from 'qrcode-generator';

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
/* Labels kept Title Case (not ALL CAPS) — the on-screen form always displays
   them uppercase anyway via Fld's own textTransform:'uppercase' CSS, so this
   only affects the printed LR (lrHtml()), where these exact labels ("Freight",
   "Local Cartage", "Loading CHG", etc.) are what the reference printed LR
   format uses, and the charges ledger there is not auto-uppercased. */
export const LR_CHG = [['rateCh', 'Rate Charge'], ['freight', 'Freight'], ['surcharge', 'Surcharge'], ['localCartage', 'Local Cartage'], ['lastMile', 'Last Mile Frt'], ['fov', 'FOV'], ['loading', 'Loading CHG'], ['unloading', 'Unloading CHG'], ['handling', 'Handling CHG'], ['gc', 'GC Charge'], ['other', 'Other Charge'], ['ewayCh', 'Eway Bill CHG'], ['aoc', 'AOC']];
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
    db.branches = [{ id: 'br_main', name: 'VADODARA', entityName: db.company.name, gstin: db.company.gstin || '', panNo: db.company.panNo || '', addr: db.company.addr || '', lrPrefix: db.company.lrPrefix || '', phone: db.company.phone || '' }];
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
    company: { name: 'Baroda Goods Transport Service Pvt. Ltd.', addr: 'Vadodara, Gujarat, India', gstin: '', panNo: '', phone: '', email: '', website: '', lrPrefix: 'BRD/' },
    seq: { lr: 1, inv: 1, bk: 1, lhc: 1 },
    clients: [], vehicles: [], drivers: [], vendors: [], routes: [],
    contracts: [], bookings: [], expenses: [], renewals: [], invoices: [], payments: [],
    lrs: [], lhcs: [], advances: [], acctExp: [], inquiries: [], bankTxns: [], billingBackup: [], truckMaster: [],
    lenders: [], fixedExp: [], auditLog: [], vendorDirectory: [], bills: [], taxMaster: [], accountGroups: [], accounts: [], lhcTrips: [], lhcPayments: []
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

/* ---------- Tax Master — ATTrans's "VIEW TAX DETAILS" register (15 rows,
   screenshots dated 2026-08-26), imported wholesale as its own standalone
   master, independent of BILL_CHG/BILL_PAYMENT_OPTIONS above. This register
   is evidently the authoritative source those two static lists were drawn
   from: rows 1-8 are exactly the original 8 LR Charges, rows 9-10 are the
   2 new ones (Dock Charges, Extra Delivery), and rows 11-15 are deduction-side
   entries (T P Mamul, Balance, Cash, TDS, Other Less) matching the shape of
   a Payment Detail "deduction" row. Kept standalone for now, matching the
   scope of what was asked (Masters tab + Add form) — BILL_CHG/
   BILL_PAYMENT_OPTIONS are NOT wired to read from this yet; that would be a
   reasonable follow-up if wanted, not assumed here.
   Row shape: [srNo, sign, description, accountGroup, modules, createdBy] —
   sign is '+' (adds to the bill) or '-' (deducts), modules is a comma-joined
   list from the fixed TAX_MODULES set (mirrors ATTrans's own comma-joined
   MODULE column and its Add New Tax form's checkbox set exactly).
   Transcribed verbatim, including the source's own spelling — "GANERAL
   SALES"/"GANERAL PURCHASE" and "HAMALI CHAGES"/"BALANCE CHAGES" are typos
   in ATTrans itself, not transcription errors here. */
export const TAX_MODULES = ['LR', 'LHC', 'BILL', 'MR', 'CONTRACT', 'BALANCE ADVICE', 'CONTRACT LHC', 'GANERAL SALES', 'GANERAL PURCHASE'];
const ALL_TAX_MODULES = TAX_MODULES.join(',');

export const LEGACY_TAX_MASTER = [
  [1, '+', 'HAMALI', 'HAMALI CHAGES', ALL_TAX_MODULES, ''],
  [2, '+', 'LOADING', 'LOADING CHARGES', ALL_TAX_MODULES, ''],
  [3, '+', 'UNLOADING', 'UNLOADING CHARGES', ALL_TAX_MODULES, ''],
  [4, '+', 'RTO CHALLAN', 'RTO CHALLAN CHARGES', ALL_TAX_MODULES, ''],
  [5, '+', 'VARAI', 'VARAI CHARGES', ALL_TAX_MODULES, ''],
  [6, '+', 'L R CHARGES', 'L R CHARGES', ALL_TAX_MODULES, ''],
  [7, '+', 'DETENTION', 'DETENTION CHARGES', ALL_TAX_MODULES, ''],
  [8, '+', 'OTHER ADD', 'OTHER ADD', ALL_TAX_MODULES, ''],
  [9, '+', 'DOCK CHARGES', 'DOCK CHARGES', 'BILL', 'DEVELOPER'],
  [10, '+', 'EXTRA DELIVERY', 'EXTRA DELIVERY', ALL_TAX_MODULES, 'DEVELOPER'],
  [11, '-', 'T P MAMUL', 'T P MAMUL', ALL_TAX_MODULES, ''],
  [12, '-', 'BALANCE', 'BALANCE CHAGES', ALL_TAX_MODULES, ''],
  [13, '-', 'CASH', 'DRIVER CASH', ALL_TAX_MODULES, ''],
  [14, '-', 'TDS', 'TDS PAYABLE', ALL_TAX_MODULES, ''],
  [15, '-', 'OTHER LESS', 'OTHER LESS', ALL_TAX_MODULES, '']
];

/* Dedupes by ATTrans SR NO. — safe to re-run. */
export function importLegacyTaxMaster(db){
  db.taxMaster = db.taxMaster || [];
  const have = {};
  db.taxMaster.forEach(t => { if (t.srNo != null) have[t.srNo] = true; });
  let added = 0;
  LEGACY_TAX_MASTER.forEach(([srNo, sign, description, accountGroup, modules, createdBy]) => {
    if (have[srNo]) return;
    have[srNo] = true;
    db.taxMaster.push({ id: uid('tx'), srNo, sign, description, accountGroup, modules, createdBy });
    added++;
  });
  return added;
}

/* ---------- Account Group — ATTrans's "VIEW ACCOUNT GROUP DETAILS" register
   (6 rows, screenshots dated 2026-08-26), imported as its own standalone
   chart-of-accounts master. Distinct from Tax Master's free-text "Account"
   field above (that field was left as-is, unlinked, per the original scope —
   see the note on LEGACY_TAX_MASTER); this is the real hierarchical group
   list ATTrans's own "PARENT" dropdown draws from.
   Row shape: [srNo, name, parentSrNo, status, createdBy] — parentSrNo is
   null for a top-level group, else another row's srNo. Resolved to a live
   parentId (not a hardcoded uid) at import time, same pattern as
   importLegacyBills resolving vendor srNo -> live vendor id. */
export const LEGACY_ACCOUNT_GROUPS = [
  [1, 'ASSETS', null, 'ACTIVE', ''],
  [2, 'BANK', null, 'ACTIVE', ''],
  [3, 'CASH', null, 'ACTIVE', ''],
  [4, 'EXPENSES', null, 'ACTIVE', ''],
  [5, 'INCOME', null, 'ACTIVE', ''],
  [6, 'LIABILITIES', null, 'ACTIVE', '']
];

/* Dedupes by ATTrans SR NO. — safe to re-run. Two-pass so a later row's
   PARENT (given as another row's srNo) resolves to the real live id of an
   already-imported group, even across separate import runs. */
export function importLegacyAccountGroups(db){
  db.accountGroups = db.accountGroups || [];
  const have = {};
  const bySr = {};
  db.accountGroups.forEach(g => { if (g.srNo != null) { have[g.srNo] = true; bySr[g.srNo] = g; } });
  let added = 0;
  const pending = [];
  LEGACY_ACCOUNT_GROUPS.forEach(([srNo, name, parentSrNo, status, createdBy]) => {
    if (have[srNo]) return;
    have[srNo] = true;
    const g = { id: uid('ag'), srNo, name, parentId: '', status: status || 'ACTIVE', createdBy: createdBy || '' };
    db.accountGroups.push(g);
    bySr[srNo] = g;
    pending.push([g, parentSrNo]);
    added++;
  });
  pending.forEach(([g, parentSrNo]) => { if (parentSrNo != null && bySr[parentSrNo]) g.parentId = bySr[parentSrNo].id; });
  return added;
}

/* ---------- Account (Chart of Accounts / ledger) — ATTrans's "VIEW ACCOUNT
   DETAILS" register (266 rows, screenshots dated 2026-08-26), imported
   wholesale as its own standalone ledger-account master. Distinct from
   Account Group above: this is the actual account list (customers, banks,
   charge heads) each tagged with a GROUP name.

   FLAGGED, not silently fixed:
   - Several accounts use GROUP values ("SUNDRY DEBTORS", "SUNDRY CREDITORS")
     that do NOT exist as rows in the 6-row Account Group register imported
     above (Assets, Bank, Cash, Expenses, Income, Liabilities only) — ATTrans's
     own Account Group screen apparently only lists top-level groups, with
     Sundry Debtors/Sundry Creditors as unlisted sub-groups. Rather than guess
     a parent group or invent Account Group rows to satisfy a link, GROUP is
     kept as free text here (same convention as Tax Master's accountGroup
     field), and this gap is surfaced to the user rather than resolved.
   - SR 24 (ACT-0027) has a blank description in the source; SR 143
     (ACT-0146) has a literal backtick "`" as its description. Both
     transcribed verbatim, not guessed.
   - SR 33 (ACT-0036, "DEVELOPER") and SR 34 (ACT-0037, "TESTING") are
     evidently leftover test/dev entries in ATTrans itself, not a
     transcription artifact here.
   - Numerous near-duplicate names are ATTrans's own spelling variants of the
     same party (not merged): "PARESH PARIKH" (SR 100) vs "PAESH PARIKH"
     (SR 99), "CHANDRAVADAN PATEL" (SR 48) vs "CHANDRAVARDHAN PATEL" (SR 53),
     "USHTA INFINITY CONSTRUCTION" vs "USTHA INFINITY CONSTRUCTION" (SR 202),
     "DILIPBHAI SHAH" (SR 123) vs "DILPBHAI" (SR 124), "MONISH JHAVERI"
     (SR 128) vs "MONISH JHAVER" (SR 129), "POLYCOAT" (SR 165) vs "POYCOAT...
     PVY LTD" (SR 166), "RELIABLITY SEALS" (SR 242, sic).
   - "RAILWAY BOOKING" appears twice under two different groups (SR 119,
     SUNDRY DEBTORS; SR 139, SUNDRY CREDITORS) — kept as two separate rows,
     matching the source, not deduped.
   - Every OPENING (DR.)/OPENING (CR.) cell in the source register reads
     either "0.00" or blank; both mean nil, so both are recorded as 0 here
     rather than tracked separately — no non-zero opening balance appears
     anywhere in the 266-row register.
   Row shape: [srNo, code, description, group, createdBy]. */
export const LEGACY_ACCOUNTS = [
  [1, 'ACT-0001', 'LORRY HIRE CHARGES', 'EXPENSES', ''],
  [2, 'ACT-0002', 'DIESEL EXPENSES', 'EXPENSES', ''],
  [3, 'ACT-0003', 'TDS RECEIVABLE', 'INCOME', ''],
  [4, 'ACT-0004', 'CASH DISCOUNT', 'EXPENSES', ''],
  [5, 'ACT-0005', 'LATE DELIVERY', 'EXPENSES', ''],
  [6, 'ACT-0006', 'FREIGHT CHARGES', 'INCOME', ''],
  [7, 'ACT-0007', 'CGST OUTPUT', 'EXPENSES', ''],
  [8, 'ACT-0008', 'SGST OUTPUT', 'EXPENSES', ''],
  [9, 'ACT-0009', 'IGST OUTPUT', 'EXPENSES', ''],
  [10, 'ACT-0010', 'HAMALI CHAGES', 'EXPENSES', ''],
  [11, 'ACT-0011', 'LOADING CHARGES', 'EXPENSES', ''],
  [12, 'ACT-0012', 'UNLOADING CHARGES', 'EXPENSES', ''],
  [13, 'ACT-0013', 'RTO CHALLAN CHARGES', 'EXPENSES', ''],
  [14, 'ACT-0014', 'VARAI CHARGES', 'EXPENSES', ''],
  [15, 'ACT-0015', 'L R CHARGES', 'EXPENSES', ''],
  [16, 'ACT-0016', 'DETENTION CHARGES', 'EXPENSES', ''],
  [17, 'ACT-0017', 'T P MAMUL', 'INCOME', ''],
  [18, 'ACT-0018', 'BALANCE CHAGES', 'INCOME', ''],
  [19, 'ACT-0019', 'DRIVER CASH', 'INCOME', ''],
  [20, 'ACT-0020', 'TDS PAYABLE', 'INCOME', ''],
  [21, 'ACT-0021', 'OTHER ADD', 'EXPENSES', ''],
  [22, 'ACT-0022', 'OTHER LESS', 'INCOME', ''],
  [23, 'ACT-0026', 'CASH IN HAND', 'CASH', ''],
  [24, 'ACT-0027', '', 'SUNDRY CREDITORS', 'DEVELOPER'],
  [25, 'ACT-0028', 'GUJARAT ALKALIES & CHEMICALS LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [26, 'ACT-0029', 'GUJARAT STATE ELECTRICITY CORP LTD WANAKBORI', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [27, 'ACT-0030', 'DEEPAK SHAH ( BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [28, 'ACT-0031', 'DEEPAK SHAH (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [29, 'ACT-0032', 'MR. SAMIR VYAS ( BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [30, 'ACT-0033', 'MR. SAMIR VYAS ( DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [31, 'ACT-0034', 'MR. RIYAZ DHRUV ( BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [32, 'ACT-0035', 'MR. RIYAAZ DHRUV (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [33, 'ACT-0036', 'DEVELOPER', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [34, 'ACT-0037', 'TESTING', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [35, 'ACT-0038', 'MITESHBHAI MUMBAI', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [36, 'ACT-0039', 'CENTRAL BANK OF INDIA', 'BANK', 'DEVELOPER'],
  [37, 'ACT-0040', 'HDFC BANK LTD', 'BANK', 'DEVELOPER'],
  [38, 'ACT-0041', 'LOCAL CARTING', 'EXPENSES', 'DEVELOPER'],
  [39, 'ACT-0042', 'OFFICE EXPENSES', 'EXPENSES', 'DEVELOPER'],
  [40, 'ACT-0043', 'MR. SAMIR VYAS (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [41, 'ACT-0044', 'MR SAMIR VYAS (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [42, 'ACT-0045', 'MR SAMIR VYAS (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [43, 'ACT-0046', 'MRS. KRISHNA PATEL (AND)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [44, 'ACT-0047', 'MRS. KRISHNA PATEL (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [45, 'ACT-0048', 'MRS. KRISHNA PATEL (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [46, 'ACT-0049', 'MR GAUTAM AMIN (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [47, 'ACT-0050', 'MRS. MAUSAM PATEL (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [48, 'ACT-0051', 'MR. CHANDRAVADAN PATEL (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [49, 'ACT-0052', 'MR. DHANANJAY JOSHI (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [50, 'ACT-0053', 'MR. RAJIT SHAH (AHD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [51, 'ACT-0054', 'MR. GAUTAM AMIN (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [52, 'ACT-0055', 'MRS. MAUSAM PATEL (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [53, 'ACT-0056', 'MR. CHANDRAVARDHAN PATEL (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [54, 'ACT-0057', 'MR. DHANANJAY JOSHI (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [55, 'ACT-0058', 'SARDAR SAROVAR HOLIDAY RESORTS LLP', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [56, 'ACT-0059', 'SHIVNERI FRESH VEG', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [57, 'ACT-0060', 'MRS. ROSHANI VYAS (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [58, 'ACT-0061', 'MRS. ROSHANI VYAS', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [59, 'ACT-0062', 'RAJKOT MUNICIPAL CORPORATION', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [60, 'ACT-0063', 'SHARP PRINTS', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [61, 'ACT-0064', 'MANVI PRODUCTIONS', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [62, 'ACT-0065', 'BHANU COSPACK PRIVATE LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [63, 'ACT-0066', 'MR RAJIT SHAH (AHD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [64, 'ACT-0067', 'MR. RAJIT SHAH (BGL)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [65, 'ACT-0068', 'SARDAR PATEL EDUCATION TRUST', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [66, 'ACT-0069', 'HITEN SHAH', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [67, 'ACT-0070', 'MR. RISHABH JINGER (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [68, 'ACT-0071', 'MR RISHABH JINGER', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [69, 'ACT-0072', 'MR MOUNANG PATEL', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [70, 'ACT-0073', 'MR DEVENDRA PATEL', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [71, 'ACT-0074', 'MR. ASHOK PATEL (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [72, 'ACT-0075', 'MR. ASHOK PATEL (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [73, 'ACT-0076', 'MR ASHOK PATEL (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [74, 'ACT-0077', 'MITESHBHAI', 'SUNDRY CREDITORS', 'DEVELOPER'],
  [75, 'ACT-0078', 'NTPC', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [76, 'ACT-0079', 'VANISHA DESAI (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [77, 'ACT-0080', 'VANISHA DESAI (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [78, 'ACT-0081', 'VANISHA DESAI', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [79, 'ACT-0082', 'RAKESH PATEL (AND)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [80, 'ACT-0083', 'JAYSHREE SHAH (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [81, 'ACT-0084', 'DENORA INDIA LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [82, 'ACT-0085', 'GUJARAT ALKALIES & CHEMICALS LTD DAHEJ', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [83, 'ACT-0086', 'JAYSHREE SHAH (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [84, 'ACT-0087', 'RONAK PATEL (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [85, 'ACT-0088', 'RONAK PATEL (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [86, 'ACT-0089', 'MR VASUDEV PATEL (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [87, 'ACT-0090', 'MR ANMOL PATEL (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [88, 'ACT-0091', 'SMITA KORADIYA', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [89, 'ACT-0092', 'MR. VASUDEV PATEL (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [90, 'ACT-0093', 'MR ANMOL PATEL (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [91, 'ACT-0094', 'MR. NITYA PATEL (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [92, 'ACT-0095', 'MR. NITYA PATEL ( DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [93, 'ACT-0096', 'MR NITYA PATEL (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [94, 'ACT-0097', 'RITA ENTERPRISES', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [95, 'ACT-0098', 'DECORATIVE PLYWOOD & HARDWARE CO', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [96, 'ACT-0099', 'MOHIT AGRAWAL (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [97, 'ACT-0100', 'MR. CHIRAG PATEL', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [98, 'ACT-0101', 'PARESH PARIKH (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [99, 'ACT-0102', 'PAESH PARIKH (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [100, 'ACT-0103', 'MR. PARESH PARIKH (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [101, 'ACT-0104', 'MRS. PRACHI SHAH (AHD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [102, 'ACT-0105', 'MRS. PRACHI SHAH ( DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [103, 'ACT-0106', 'COLOURIFIC AGENCY', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [104, 'ACT-0107', 'SUN PHARMACEUTICALS INDUSTRIES LTD.', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [105, 'ACT-0108', 'SUN PHARMACEUTICAL INDUSTRIES LTD GURGAON R&D', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [106, 'ACT-0109', 'MR. VIRENDRA MANDERA', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [107, 'ACT-0110', 'MR VIRENDRA MANDERA', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [108, 'ACT-0111', 'MR PRANAV PATEL DELHI', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [109, 'ACT-0112', 'MR PRANAV PATEL BARODA', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [110, 'ACT-0113', 'MR KUNAL SHAH ( BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [111, 'ACT-0114', 'MR KUNAL SHAH (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [112, 'ACT-0115', 'INDIAN OVERSEAS BANK', 'BANK', 'DEVELOPER'],
  [113, 'ACT-0116', 'CLARUS CORPORATION', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [114, 'ACT-0117', 'DHARMESHNANDINI PATEL', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [115, 'ACT-0118', 'SHREE SHYAM TRAVELS', 'EXPENSES', 'DEVELOPER'],
  [116, 'ACT-0119', 'GUJARAT STATE ELECTRICITY CORP LTD BHAVNAGAR', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [117, 'ACT-0120', 'TARU MARKETING SERVICE', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [118, 'ACT-0121', 'SUNPHARMACEUTICAL INDUSTRIES LTD.', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [119, 'ACT-0122', 'RAILWAY BOOKING', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [120, 'ACT-0123', 'MR ADVAIT SARFARE', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [121, 'ACT-0124', 'MR. NIKUNJ PATEL ( BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [122, 'ACT-0125', 'NIKUNJ PATEL', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [123, 'ACT-0126', 'MR DILIPBHAI SHAH ( BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [124, 'ACT-0127', 'MR DILPBHAI (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [125, 'ACT-0128', 'ELESHBHAI SHAH', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [126, 'ACT-0129', 'ADITYA SHAH', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [127, 'ACT-0130', 'MR. ADITYA SHAH', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [128, 'ACT-0131', 'MR. MONISH JHAVERI', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [129, 'ACT-0132', 'MR. MONISH JHAVER (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [130, 'ACT-0133', 'GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [131, 'ACT-0134', 'MR. AMISH BHAVSAR (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [132, 'ACT-0135', 'MR AMISH BHAVSAR (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [133, 'ACT-0136', 'MR. VIJAYBHAI THAKKAR', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [134, 'ACT-0137', 'MR. SAMIR VYAS ( DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [135, 'ACT-0138', 'MR. SUYASH VAISHNAV (DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [136, 'ACT-0139', 'MR. SUYASH VAISHNAV', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [137, 'ACT-0140', 'MR. SNEHAL JAGDISH NAGARSHETH (BRD)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [138, 'ACT-0141', 'MR. SNEHAL JAGDISH NAGARSHETH ( DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [139, 'ACT-0142', 'RAILWAY BOOKING', 'SUNDRY CREDITORS', 'DEVELOPER'],
  [140, 'ACT-0143', 'VIJAYBHAI GAIKWAD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [141, 'ACT-0144', 'BLISS GVS PHARMA LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [142, 'ACT-0145', 'BLISS GVS PHARMA LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [143, 'ACT-0146', '`', 'SUNDRY CREDITORS', 'DEVELOPER'],
  [144, 'ACT-0147', 'MR. SAURABH BAFNA', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [145, 'ACT-0148', 'MR. SAURABH BAFNA(DDR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [146, 'ACT-0149', 'MR SURESH SHAH', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [147, 'ACT-0150', 'MRS. PRIYABEN GAIKWAD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [148, 'ACT-0151', 'MUSLIM BHAI (VADODARA)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [149, 'ACT-0152', 'K M PATEL', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [150, 'ACT-0153', 'VIRAL INDUSTRIES', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [151, 'ACT-0154', 'ADROIT STRUCTURAL ENGINEERS PVT LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [152, 'ACT-0155', 'JAYESH BHARWAD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [153, 'ACT-0156', 'ZENPACK PREMIUM INDUSTRIES PRIVATE LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [154, 'ACT-0157', 'JAGDISH FOOD ZONE PRIVATE LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [155, 'ACT-0158', 'SUN PHARMA ADVANCED RESEARCH COMPANY LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [156, 'ACT-0159', 'ARCELI LIFE SCIENCE PVT LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [157, 'ACT-0160', 'ARCELI LIFESCIENCE PRIVATE LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [158, 'ACT-0161', 'CHEMVAC PROCESS', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [159, 'ACT-0162', 'ASKON HYGIENE PRODUCTS PRIVATE LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [160, 'ACT-0163', 'SHIVAM CARGO', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [161, 'ACT-0164', 'FABWEL ENGINEERING CORPORATION', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [162, 'ACT-0165', 'JWSS', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [163, 'ACT-0166', 'SACHIN INDUSTRIES LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [164, 'ACT-0167', 'JAYHIND ROADWAYS (DAHEJ)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [165, 'ACT-0168', 'POLYCOAT ELECTRA SERVICES (INDIA) PRIVATE LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [166, 'ACT-0169', 'POYCOAT ELECTRA SERVICE PVY LTD.', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [167, 'ACT-0170', 'M/S MICRON ENGINEERS', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [168, 'ACT-0171', 'DHANLAXMI AUTOMOBILES', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [169, 'ACT-0172', 'SHREE RAM RUBTECH PVT LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [170, 'ACT-0173', 'MANOJ PATNI', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [171, 'ACT-0174', 'JIYA KAUNDAL', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [172, 'ACT-0175', 'MRS JHEEL', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [173, 'ACT-0176', 'PURNA GORADIA', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [174, 'ACT-0177', 'V TRANS (INDIA) LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [175, 'ACT-0178', 'PRODEV MANUFACTURING COMPANY', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [176, 'ACT-0179', 'MR. MOHAN BARIA', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [177, 'ACT-0180', 'LALJI MURJI', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [178, 'ACT-0181', 'V TRANS INDIA LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [179, 'ACT-0182', 'LATA PARMAR', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [180, 'ACT-0183', 'DYNA MECH ENGINEERING', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [181, 'ACT-0184', 'USHTA INFINITY CONSTRUCTION CO.PVT.LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [182, 'ACT-0185', 'AADHAR EQUIPMENTS PVT LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [183, 'ACT-0186', 'DUNGSAM CEMENT CORPORATION LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [184, 'ACT-0187', 'ESI SERVICES INDIA LLP', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [185, 'ACT-0188', 'ESI SERVICES INDIA LLP CO SHREE CEMENT LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [186, 'ACT-0189', 'ESI SERVICES INDIA LLP CO BOLTRACK ENGINEERS', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [187, 'ACT-0190', 'JAGAT PANWAR', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [188, 'ACT-0191', 'USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [189, 'ACT-0192', 'AMTECH ELECTRONICS (INDIA) LTD.', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [190, 'ACT-0193', 'FLEXATHERM EXPANLLOW PVT LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [191, 'ACT-0194', 'USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED ( SITAPURAM)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [192, 'ACT-0195', 'USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED ( SILVASSA)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [193, 'ACT-0196', 'ARIHANT FABRICATORS', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [194, 'ACT-0197', 'ASSASSOCITED ROAD CARRIERS LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [195, 'ACT-0198', 'RELIANCE INDUSTRIES LTD.', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [196, 'ACT-0199', 'PRECISE AUTOMATION AND CONTROL PVT. LTD.', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [197, 'ACT-0200', 'USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED ( BHATAPARA)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [198, 'ACT-0201', 'USHTA INFINITY CONSTRUCTION CO.PVT.LTD ( BALODA BAZAAR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [199, 'ACT-0202', 'BOLTRACK ENGINEERS', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [200, 'ACT-0203', 'M/S USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED (SAMBALPUR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [201, 'ACT-0204', 'ELECTRONICS AND QUALITY DEVELOPMENT CENTRE', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [202, 'ACT-0205', 'USTHA INFINITY CONSTRUCTION CO PVT LTD (NARSINGARH)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [203, 'ACT-0206', 'USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED (CHITTORGARH)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [204, 'ACT-0207', 'LALJI MULJI TRANSPORT CO', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [205, 'ACT-0208', 'USHTA INFINITY CONSTRUCTION CO. PVT. LTD. C/O', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [206, 'ACT-0209', 'USHTA INFINITY CONSTRUCTION CO PVT LTD MULDWARKA', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [207, 'ACT-0210', 'SUVIDHI AGENCIES', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [208, 'ACT-0211', 'USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED UDUPI', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [209, 'ACT-0212', 'USHTA INFINITY CONSTRUCTION CO. PVT LTD NARSINGARH', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [210, 'ACT-0213', 'USHTA INFINITY CONSTRUCTION CO PVT LTD GNFC', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [211, 'ACT-0214', 'USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED (ASSAM)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [212, 'ACT-0215', 'USHTA INFINITY CONSTRUCTION CO.PVT.LTD (SRIHARIKOTA )', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [213, 'ACT-0216', 'USHTA INFINITY CONSTRUCTION CO.PVT.LTD (SRIHARIKOTA )', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [214, 'ACT-0217', 'MET HEAT ENGINEERS PVT LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [215, 'ACT-0218', 'USHTA INFINITY CONSTRUCTION CO.PVT.LTD (ANKLESHWAR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [216, 'ACT-0219', 'USHTA INFINITY CONSTRUCTION CO.PVT.LTD C/O VADODARA WAREHOUSE', 'SUNDRY DEBTORS', 'ANIL PANDEY'],
  [217, 'ACT-0220', 'USHTA INFINITY CONSTRUCTION CO.PVT.LTD RAJKOT', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [218, 'ACT-0221', 'RUPRAJ TECHNICAL SERVICES', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [219, 'ACT-0222', 'USHTA INFINITY CONSTRUCTION CO.PVT.LTD C/O', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [220, 'ACT-0223', 'DRM FILTER TECHNOLOGY PVT LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [221, 'ACT-0224', 'VINDI VAK PUMP PVT. LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [222, 'ACT-0225', 'SHIV INDUSTRIES', 'SUNDRY DEBTORS', 'ANIL PANDEY'],
  [223, 'ACT-0226', 'VRUND ENGITECH PRIVATE LIMITED', 'SUNDRY DEBTORS', 'ANIL PANDEY'],
  [224, 'ACT-0227', 'ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED', 'SUNDRY DEBTORS', 'ANIL PANDEY'],
  [225, 'ACT-0228', 'RIHITA CARGO FORWARDERS PVT. LTD.', 'SUNDRY DEBTORS', 'ANIL PANDEY'],
  [226, 'ACT-0229', 'SHREE ISHAN EQUIPMENT PRIVATE LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [227, 'ACT-0230', 'DOCK CHARGES', 'EXPENSES', 'DEVELOPER'],
  [228, 'ACT-0231', 'AIR POWER SERVICES', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [229, 'ACT-0232', 'POWER LINE', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [230, 'ACT-0233', 'THERMAX LTD.', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [231, 'ACT-0234', 'USHTA INFINITY CONSTRUCTION CO PVT LTD C/O HINDALCO INDUSTRIES LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [232, 'ACT-0235', 'USHTA INFINITY CONSTRUCTION CO.PVT.LTD C/O MEGHMANI ORGANICS LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [233, 'ACT-0236', 'M/S SHAKTI TYRE SERVICES', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [234, 'ACT-0237', 'G DALABHAI ROADWAYS', 'SUNDRY DEBTORS', 'MEHUL CHAVDA'],
  [235, 'ACT-0238', 'RED HOT ELECTRICALS', 'SUNDRY DEBTORS', 'MEHUL CHAVDA'],
  [236, 'ACT-0239', 'PATEL HEATERS & CONTROL PVT.LTD.', 'SUNDRY DEBTORS', 'MEHUL CHAVDA'],
  [237, 'ACT-0240', 'ANTICORROSION INDIA PVT LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [238, 'ACT-0241', 'SUNPHARMACEUTICAL INDUSTRIES LTD.(ANKLESHWAR)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [239, 'ACT-0242', 'SUN PHARMACEUTICAL INDUSTRIES LTD (KARAKHADI)', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [240, 'ACT-0243', 'TECHNO ENGINEERING', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [241, 'ACT-0244', 'PFG GLASSKEM EQUIPMENTS PRIVATE LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [242, 'ACT-0245', 'RELIABLITY SEALS', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [243, 'ACT-0246', 'USHTA INFINITY CONSTRUCTION CO. PVT. LTD C/O MUNDRA', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [244, 'ACT-0247', 'USHTA INFINITY CONSTRUCTION CO PVT LTD C/O NAYARA ENERGY LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [245, 'ACT-0248', 'STEELCO GUJARAT LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [246, 'ACT-0249', 'PARAS PIPES', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [247, 'ACT-0250', 'TECHNO FAB ENGINEERS', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [248, 'ACT-0251', 'BRAZEWELL ENGINEERS C/O ACPL TRANSPORT', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [249, 'ACT-0252', 'BASE METAL CHEMICALS', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [250, 'ACT-0253', 'EXTRA DELIVERY', 'EXPENSES', 'DEVELOPER'],
  [251, 'ACT-0254', 'BARODA IND. ELECTRICALS PRO. PVT. LTD.', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [252, 'ACT-0255', 'GALIAKOTWALA ENGINEERING CO PVT LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [253, 'ACT-0256', 'ASSOCIATED ROAD CARRIERS LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [254, 'ACT-0257', 'AMAL LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [255, 'ACT-0258', 'DEEPAK NITRITE LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [256, 'ACT-0259', 'SHREE SULPHURICS P LTD.', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [257, 'ACT-0260', 'ARCH ELECTRICAL', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [258, 'ACT-0261', 'MR. VINAYKANT VARMA', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [259, 'ACT-0262', 'KABRA EXPRESS LOGISTICS PRIVATE LIMITED', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [260, 'ACT-0263', 'AKSHAR ROADLINES', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [261, 'ACT-0264', 'USMAN BHAI', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [262, 'ACT-0265', 'HYDRODYNE TEIKOKU (INDIA) PVT LTD.C/O ACPL TRANSPORT', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [263, 'ACT-0266', 'POOJA ROADLINES', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [264, 'ACT-0267', 'SURAT AHMEDABAD TRANSPORT PVT LTD', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [265, 'ACT-0268', 'M/S CONTINENTAL VALVES LIMITED C/O ACPL TRANSPORT', 'SUNDRY DEBTORS', 'DEVELOPER'],
  [266, 'ACT-0269', 'MR RAGHU BHARWAD', 'SUNDRY DEBTORS', 'DEVELOPER']
];

/* Dedupes by CODE (ATTrans's own unique account code) — safe to re-run. */
export function importLegacyAccounts(db){
  db.accounts = db.accounts || [];
  const have = {};
  db.accounts.forEach(a => { if (a.code) have[a.code] = true; });
  let added = 0;
  LEGACY_ACCOUNTS.forEach(([srNo, code, description, group, createdBy]) => {
    if (have[code]) return;
    have[code] = true;
    db.accounts.push({ id: uid('acc'), srNo, code, description, group, openingDr: 0, openingCr: 0, createdBy: createdBy || '' });
    added++;
  });
  return added;
}

/* ---------- Vendor Directory — imported wholesale from the company's ATTrans
   "View Vendor Details" register (235 rows, screenshots dated 2026-08-11).
   Kept as its own standalone directory, separate from db.vendors (the
   operational vendor list already wired into Bookings/LHC/hired-vehicle
   assignment), since this ATTrans register uses its own Vendor Code scheme,
   PAN/GST/Type/Created By columns that don't exist on db.vendors, and is a
   reference/lookup list rather than a list of vendors actively assigned to
   live bookings. Row shape: [srNo, vendorCode, name, contactNo, panCard, gst,
   type, createdBy] — srNo is the ATTrans "SR NO." column, preserved as-is for
   traceability back to the source register (not renumbered).
   Known data-quality notes carried over as-is from the source (not
   transcription errors — verified by re-reading the screenshots):
     - Row 1 (V-0072) and row 235 (V-0099) have blank names in the source.
     - Several vendor codes repeat across BRD/DDR/AHD/etc. branch-suffix
       variants of the same person (e.g. V-0035, V-0046, V-0039) — this
       matches the source register's own convention, not a duplicate entry.
     - SR NO. 220 and 221 were each listed twice in a row in the source
       table (identical data both times); only included once each here.
     - Row 101 and row 135 (V-0065, "MR VIRENDRA MANDERA") are an exact
       duplicate row in the source.

   Rows 236-283 (srNo) are a SECOND, separate batch appended later: the
   Vendor* dropdown options from ATTrans's own "Add New Bill" form (a
   `<select name="vendor_id">`, pasted by the user as HTML). That dropdown
   is backed by a different ATTrans table (its own numeric vendor_id primary
   key, e.g. option value="82") than the "View Vendor Details" register rows
   1-235 above (which use V-XXXX style Vendor Codes) — so these are kept as
   their own vendorCode scheme, "BV-<attrans vendor_id>" (BV = Bill Vendor),
   rather than invented V-XXXX codes, and srNo here is just a continuing
   sequence number for this array, not an ATTrans "SR NO." column (that
   dropdown had no such column).
   Flagged, not merged (same "flag rather than guess" rule as rows 1-235):
   several of these names look like the same real people as existing rows
   1-235 under a different branch suffix or ATTrans record — e.g. "MR
   VIRENDRA MANDERA" (BV-82) vs. V-0065 "MR VIRENDRA MANDERA" above, and
   "VANISHA DESAI (BRD)" (BV-50) vs. V-0039 "VANISHA DESAI (DDR)" above.
   Left as separate rows rather than silently deduped/merged — worth a
   manual look in Masters -> Vendor Directory. Also note "Mr. samir Vyas
   ( BRD)" appears three times in ATTrans's own dropdown under different
   casing (BV-7, BV-14, BV-16) — transcribed as three distinct rows since
   that's what the source list shows, not a transcription artifact. */
export const LEGACY_VENDORS = [
  [1, "V-0072", "", "", "", "", "AGENT", ""],
  [2, "V-0100", "MR. SAURABH BAFNA", "", "", "", "VENDOR", "DEVELOPER"],
  [3, "V-0101", "MR. SAURABH BAFNA(DDR)", "", "", "", "VENDOR", ""],
  [4, "V-0130", "PURNA GORADIA", "", "", "", "VENDOR", ""],
  [5, "V-0177", "VINDI VAK PUMP PVT. LTD", "", "", "", "VENDOR", ""],
  [6, "V-0139", "AADHAR EQUIPMENTS PVT LTD", "", "AABCA9507G", "24AABCA9507G1ZX", "VENDOR", "DEVELOPER"],
  [7, "V-0083", "ADITYA SHAH", "", "", "", "VENDOR", ""],
  [8, "V-0107", "ADROIT STRUCTURAL ENGINEERS PVT LTD", "", "AADCA0403B", "24AADCA0403B1ZS", "VENDOR", "DEVELOPER"],
  [9, "V-0184", "AIR POWER SERVICES", "", "ACDPP5579Q", "24ACDPP5579Q1ZS", "VENDOR", "DEVELOPER"],
  [10, "V-0195", "AIR POWER SERVICES", "", "ACDPP5579Q", "24ACDPP5579Q1ZS", "VENDOR", "DEVELOPER"],
  [11, "V-0217", "AKSHAR ROADLINES", "9377766352", "", "", "AGENT", "DEVELOPER"],
  [12, "V-0211", "AMAL LIMITED", "", "AAACA1041J", "24AAACA1041J1ZA", "VENDOR", "DEVELOPER"],
  [13, "V-0147", "AMTECH ELECTRONICS (INDIA) LTD.", "", "AABCA2793A", "24AABCA2793A1Z7", "VENDOR", "DEVELOPER"],
  [14, "V-0194", "ANTICORROSION INDIA PVT LTD", "", "", "", "VENDOR", "DEVELOPER"],
  [15, "V-0112", "ARCELI LIFESCIENCE PRIVATE LIMITED", "", "AASCA1911H", "05AASCA1911H1ZU", "VENDOR", "DEVELOPER"],
  [16, "V-0214", "ARCH ELECTRICAL", "", "AFLPR1236H", "27AFLPR1236H2ZA", "VENDOR", "DEVELOPER"],
  [17, "V-0151", "ARIHANT FABRICATORS", "", "ACKPM4863F", "24ACKPM4863F1ZI", "VENDOR", "DEVELOPER"],
  [18, "V-0114", "ASKON HYGIENE PRODUCTS PRIVATE LIMITED", "", "AAFCA1595C", "27AAFCA1595C1ZV", "VENDOR", "DEVELOPER"],
  [19, "V-0152", "ASSASSOCITED ROAD CARRIERS LIMITED", "", "", "", "VENDOR", ""],
  [20, "V-0210", "ASSOCIATED ROAD CARRIERS LIMITED", "", "AACCA4861C", "24AACCA4861C2Z4", "VENDOR", "DEVELOPER"],
  [21, "V-0208", "BARODA IND. ELECTRICALS PRO. PVT. LTD.", "", "AACCB0826G", "24AACCB0826G1Z7", "VENDOR", "DEVELOPER"],
  [22, "V-0207", "BASE METAL CHEMICALS", "", "AABFB7166P", "24AABFB7166P1Z4", "VENDOR", "DEVELOPER"],
  [23, "V-0027", "BHANU COSPACK PRIVATE LTD", "", "", "24AAJCB3408R1ZD", "VENDOR", ""],
  [24, "V-0097", "BLISS GVS PHARMA LIMITED", "", "AABCB1382J", "24AABCB1382J2ZV", "VENDOR", "DEVELOPER"],
  [25, "V-0098", "BLISS GVS PHARMA LTD", "", "AABCB1382J", "27AABCB1382J1ZQ", "VENDOR", "DEVELOPER"],
  [26, "V-0157", "BOLTRACK ENGINEERS", "", "BHRPR1728R", "24BHRPR1728R1ZG", "VENDOR", "DEVELOPER"],
  [27, "V-0206", "BRAZEWELL ENGINEERS C/O ACPL TRANSPORT", "", "", "", "VENDOR", ""],
  [28, "V-0113", "CHEMVAC PROCESS", "", "AJFPN5535K", "27AJFPN5535K1ZV", "VENDOR", "DEVELOPER"],
  [29, "V-0069", "CLARUS CORPORATION", "", "", "24ACTPP2392K2ZY", "VENDOR", "DEVELOPER"],
  [30, "V-0062", "COLOURIFIC AGENCY", "", "", "", "VENDOR", ""],
  [31, "V-0055", "DECORATIVE PLYWOOD & HARDWARE CO", "", "", "", "VENDOR", ""],
  [32, "V-0212", "DEEPAK NITRITE LIMITED", "", "AAACD7468A", "24AAACD7468A1ZZ", "VENDOR", "DEVELOPER"],
  [33, "V-0002", "DEEPAK SHAH ( BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [34, "V-0003", "DEEPAK SHAH (DDR)", "", "", "", "VENDOR", ""],
  [35, "V-0043", "DENORA INDIA LTD", "", "", "30AAACT2583N1Z9", "VENDOR", "DEVELOPER"],
  [36, "V-0006", "DEVELOPER", "", "", "", "VENDOR", ""],
  [37, "V-0125", "DHANLAXMI AUTOMOBILES", "", "", "", "VENDOR", ""],
  [38, "V-0070", "DHARMESHNANDINI PATEL", "", "", "", "VENDOR", ""],
  [39, "V-0176", "DRM FILTER TECHNOLOGY PVT LTD", "", "", "", "VENDOR", ""],
  [40, "V-0140", "DUNGSAM CEMENT CORPORATION LIMITED", "", "", "", "VENDOR", "DEVELOPER"],
  [41, "V-0137", "DYNA MECH ENGINEERING", "", "AATFD7793A", "24AATFD7793A1Z6", "VENDOR", "DEVELOPER"],
  [42, "V-0159", "ELECTRONICS AND QUALITY DEVELOPMENT CENTRE", "", "AAATE0718R", "24AAATE0718R1ZL", "VENDOR", "DEVELOPER"],
  [43, "V-0083", "ELESHBHAI SHAH", "", "", "", "VENDOR", ""],
  [44, "V-0141", "ESI SERVICES INDIA LLP", "", "AADFE5775H", "24AADFE5775H1ZD", "VENDOR", "DEVELOPER"],
  [45, "V-0144", "ESI SERVICES INDIA LLP", "", "AADFE5775H", "24AADFE5775H1ZD", "VENDOR", "DEVELOPER"],
  [46, "V-0143", "ESI SERVICES INDIA LLP CO BOLTRACK ENGINEERS", "", "", "", "VENDOR", "DEVELOPER"],
  [47, "V-0142", "ESI SERVICES INDIA LLP CO SHREE CEMENT LTD", "", "", "", "VENDOR", "DEVELOPER"],
  [48, "V-0118", "FABWEL ENGINEERING CORPORATION", "", "AAAFF4348Q", "24AAAFF4348Q1Z5", "VENDOR", "DEVELOPER"],
  [49, "V-0148", "FLEXATHERM EXPANLLOW PVT LTD", "", "", "", "VENDOR", "DEVELOPER"],
  [50, "V-0191", "G DALABHAI ROADWAYS", "", "", "", "VENDOR", ""],
  [51, "V-0209", "GALIAKOTWALA ENGINEERING CO PVT LTD", "", "AAACG5701D", "24AAACG5701D1ZA", "VENDOR", "DEVELOPER"],
  [52, "V-0001", "GUJARAT ALKALIES & CHEMICALS LTD", "", "AAACG8897M", "24AAACG8897M1ZX", "VENDOR", ""],
  [53, "V-0044", "GUJARAT ALKALIES & CHEMICALS LTD DAHEJ", "", "", "24AAACG8896M1ZX", "VENDOR", ""],
  [54, "V-0073", "GUJARAT STATE ELECTRICITY CORP LTD BHAVNAGAR", "", "", "24AAACG6864F1ZO", "VENDOR", "DEVELOPER"],
  [55, "V-0001", "GUJARAT STATE ELECTRICITY CORP LTD WANAKBORI", "", "AAACG6864F", "24AAACG6864F1ZO", "VENDOR", ""],
  [56, "V-0087", "GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR", "", "AAACG6864F", "24AAACG6864F1ZO", "VENDOR", "DEVELOPER"],
  [57, "V-0030", "HITEN SHAH", "", "", "", "VENDOR", ""],
  [58, "V-0219", "HYDRODYNE TEIKOKU (INDIA) PVT LTD.C/O ACPL TRANSPORT", "", "", "", "VENDOR", ""],
  [59, "V-0145", "JAGAT PANWAR", "", "", "", "AGENT", "DEVELOPER"],
  [60, "V-0110", "JAGDISH FOOD ZONE PRIVATE LIMITED", "", "AADCJ0793M", "24AADCJ0793M1ZB", "VENDOR", "DEVELOPER"],
  [61, "V-0108", "JAYESH BHARWAD", "", "", "", "AGENT", "DEVELOPER"],
  [62, "V-0121", "JAYHIND ROADWAYS (DAHEJ)", "", "", "", "AGENT", "DEVELOPER"],
  [63, "V-0042", "JAYSHREE SHAH (BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [64, "V-0045", "JAYSHREE SHAH (DDR)", "", "", "", "VENDOR", ""],
  [65, "V-0128", "JIYA KAUNDAL", "", "", "", "AGENT", "DEVELOPER"],
  [66, "V-0119", "JWSS", "", "", "", "VENDOR", "DEVELOPER"],
  [67, "V-0104", "K M PATEL", "", "", "", "VENDOR", "DEVELOPER"],
  [68, "V-0216", "KABRA EXPRESS LOGISTICS PRIVATE LIMITED", "", "AAGCK6871L", "24AAGCK6871L1Z2", "VENDOR", "DEVELOPER"],
  [69, "V-0134", "LALJI MULJI TRANSPORT CO", "", "", "", "VENDOR", ""],
  [70, "V-0136", "LATA PARMAR", "", "", "", "VENDOR", ""],
  [71, "V-0124", "M/S MICRON ENGINEERS", "", "AAFFM6432P", "24AAFFM6432P1ZY", "VENDOR", "DEVELOPER"],
  [72, "V-0190", "M/S SHAKTI TYRE SERVICES", "", "", "", "VENDOR", "DEVELOPER"],
  [73, "V-0158", "M/S USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED (SAMBALPUR)", "", "AAACI9029G", "21AAACI9029G1ZV", "VENDOR", "DEVELOPER"],
  [74, "V-0127", "MANOJ PATNI", "", "", "", "AGENT", "DEVELOPER"],
  [75, "V-0105", "MANVI PRODUCTIONS", "", "GGTPS9570J", "27GGTPS9570J1Z4", "VENDOR", "DEVELOPER"],
  [76, "V-0170", "MET HEAT ENGINEERS PVT LTD", "", "", "", "VENDOR", ""],
  [77, "V-0116", "MITESHBHAI", "", "", "", "AGENT", ""],
  [78, "V-0007", "MITESHBHAI MUMBAI", "", "", "", "AGENT", "DEVELOPER"],
  [79, "V-0056", "MOHIT AGRAWAL (DDR)", "", "", "", "VENDOR", ""],
  [80, "V-0077", "MR ADVAIT SARFARE", "", "", "", "VENDOR", ""],
  [81, "V-0089", "MR AMISH BHAVSAR (DDR)", "", "", "", "VENDOR", ""],
  [82, "V-0048", "MR ANMOL PATEL (BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [83, "V-0051", "MR ANMOL PATEL (DDR)", "", "", "", "VENDOR", ""],
  [84, "V-0036", "MR ASHOK PATEL (BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [85, "V-0034", "MR DEVENDRA PATEL", "", "", "", "VENDOR", ""],
  [86, "V-0081", "MR DILIPBHAI SHAH ( BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [87, "V-0082", "MR DILPBHAI (DDR)", "", "", "", "VENDOR", ""],
  [88, "V-0012", "MR GAUTAM AMIN (BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [89, "V-0067", "MR KUNAL SHAH ( BRD)", "7490026134", "", "", "VENDOR", "DEVELOPER"],
  [90, "V-0068", "MR KUNAL SHAH (DDR)", "", "", "", "VENDOR", ""],
  [91, "V-0033", "MR MOUNANG PATEL", "", "", "", "VENDOR", "DEVELOPER"],
  [92, "V-0053", "MR NITYA PATEL (BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [93, "V-0066", "MR PRANAV PATEL BARODA", "", "", "", "VENDOR", ""],
  [94, "V-0066", "MR PRANAV PATEL DELHI", "", "", "", "VENDOR", ""],
  [95, "V-0028", "MR RAJIT SHAH (AHD)", "", "", "", "VENDOR", "DEVELOPER"],
  [96, "V-0032", "MR RISHABH JINGER", "", "", "", "VENDOR", ""],
  [97, "V-0009", "MR SAMIR VYAS (BRD)", "+1 (714) 936-2055", "", "", "VENDOR", "DEVELOPER"],
  [98, "V-0008", "MR SAMIR VYAS (DDR)", "", "", "", "VENDOR", ""],
  [99, "V-0078", "MR SURESH SHAH", "", "", "", "VENDOR", "DEVELOPER"],
  [100, "V-0047", "MR VASUDEV PATEL (BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [101, "V-0065", "MR VIRENDRA MANDERA", "", "", "", "VENDOR", ""],
  [102, "V-0084", "MR. ADITYA SHAH", "", "", "", "VENDOR", "DEVELOPER"],
  [103, "V-0088", "MR. AMISH BHAVSAR (BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [104, "V-0035", "MR. ASHOK PATEL (BRD)", "", "", "", "VENDOR", ""],
  [105, "V-0035", "MR. ASHOK PATEL (DDR)", "", "", "", "VENDOR", ""],
  [106, "V-0014", "MR. CHANDRAVADAN PATEL (BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [107, "V-0019", "MR. CHANDRAVARDHAN PATEL (DDR)", "", "", "", "VENDOR", ""],
  [108, "V-0057", "MR. CHIRAG PATEL", "", "", "", "VENDOR", "DEVELOPER"],
  [109, "V-0015", "MR. DHANANJAY JOSHI (BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [110, "V-0020", "MR. DHANANJAY JOSHI (DDR)", "", "", "", "VENDOR", ""],
  [111, "V-0017", "MR. GAUTAM AMIN (DDR)", "", "", "", "VENDOR", ""],
  [112, "V-0133", "MR. MOHAN BARIA", "", "", "", "AGENT", "DEVELOPER"],
  [113, "V-0086", "MR. MONISH JHAVER (DDR)", "", "", "", "VENDOR", ""],
  [114, "V-0085", "MR. MONISH JHAVERI", "", "", "", "VENDOR", "DEVELOPER"],
  [115, "V-0079", "MR. NIKUNJ PATEL ( BRD)", "7575004000", "", "", "VENDOR", "DEVELOPER"],
  [116, "V-0052", "MR. NITYA PATEL ( DDR)", "", "", "", "VENDOR", ""],
  [117, "V-0052", "MR. NITYA PATEL (BRD)", "", "", "", "VENDOR", ""],
  [118, "V-0059", "MR. PARESH PARIKH (BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [119, "V-0016", "MR. RAJIT SHAH (AHD)", "", "", "", "VENDOR", "DEVELOPER"],
  [120, "V-0029", "MR. RAJIT SHAH (BGL)", "", "", "", "VENDOR", ""],
  [121, "V-0031", "MR. RISHABH JINGER (BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [122, "V-0005", "MR. RIYAAZ DHRUV (DDR)", "", "", "", "VENDOR", ""],
  [123, "V-0005", "MR. RIYAZ DHRUV ( BRD)", "", "", "", "VENDOR", ""],
  [124, "V-0004", "MR. SAMIR VYAS ( BRD)", "", "", "", "VENDOR", ""],
  [125, "V-0004", "MR. SAMIR VYAS ( DDR)", "", "", "", "VENDOR", ""],
  [126, "V-0091", "MR. SAMIR VYAS ( DDR)'", "", "", "", "VENDOR", ""],
  [127, "V-0008", "MR. SAMIR VYAS (BRD)", "", "", "", "VENDOR", ""],
  [128, "V-0094", "MR. SNEHAL JAGDISH NAGARSHETH ( DDR)", "", "", "", "VENDOR", ""],
  [129, "V-0093", "MR. SNEHAL JAGDISH NAGARSHETH (BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [130, "V-0092", "MR. SUYASH VAISHNAV", "", "", "", "VENDOR", "DEVELOPER"],
  [131, "V-0091", "MR. SUYASH VAISHNAV (DDR)", "", "", "", "VENDOR", ""],
  [132, "V-0050", "MR. VASUDEV PATEL (DDR)", "", "", "", "VENDOR", ""],
  [133, "V-0090", "MR. VIJAYBHAI THAKKAR", "", "", "", "VENDOR", "DEVELOPER"],
  [134, "V-0215", "MR. VINAYKANT VARMA", "7208101240", "", "", "VENDOR", "DEVELOPER"],
  [135, "V-0065", "MR. VIRENDRA MANDERA", "", "", "", "VENDOR", ""],
  [136, "V-0129", "MRS JHEEL", "", "", "", "VENDOR", "DEVELOPER"],
  [137, "V-0010", "MRS. KRISHNA PATEL (AND)", "", "", "", "VENDOR", ""],
  [138, "V-0011", "MRS. KRISHNA PATEL (BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [139, "V-0010", "MRS. KRISHNA PATEL (DDR)", "", "", "", "VENDOR", ""],
  [140, "V-0013", "MRS. MAUSAM PATEL (BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [141, "V-0018", "MRS. MAUSAM PATEL (DDR)", "", "", "", "VENDOR", ""],
  [142, "V-0061", "MRS. PRACHI SHAH ( DDR)", "", "", "", "VENDOR", ""],
  [143, "V-0060", "MRS. PRACHI SHAH (AHD)", "", "", "", "VENDOR", "DEVELOPER"],
  [144, "V-0102", "MRS. PRIYABEN GAIKWAD", "", "", "", "VENDOR", ""],
  [145, "V-0024", "MRS. ROSHANI VYAS", "", "", "", "VENDOR", ""],
  [146, "V-0023", "MRS. ROSHANI VYAS (BRD)", "", "", "", "VENDOR", "DEVELOPER"],
  [147, "V-0103", "MUSLIM BHAI (VADODARA)", "", "", "", "VENDOR", "DEVELOPER"],
  [148, "V-0080", "NIKUNJ PATEL", "", "", "", "VENDOR", ""],
  [149, "V-0003", "NTPC", "", "", "24AAACN0255D2Z3", "VENDOR", ""],
  [150, "V-0058", "PAESH PARIKH (DDR)", "", "", "", "VENDOR", ""],
  [151, "V-0204", "PARAS PIPES", "", "AAFFP3665H", "24AAFFP3665H1Z7", "VENDOR", "DEVELOPER"],
  [152, "V-0058", "PARESH PARIKH (BRD)", "", "", "", "VENDOR", ""],
  [153, "V-0193", "PATEL HEATERS & CONTROL PVT.LTD.", "", "AAGCP7970D", "24AAGCP7970D1ZC", "VENDOR", "MEHUL CHAVDA"],
  [154, "V-0199", "PFG GLASSKEM EQUIPMENTS PRIVATE LIMITED", "", "AAKCP5328H", "24AAKCP5328H1ZC", "VENDOR", "DEVELOPER"],
  [155, "V-0122", "POLYCOAT ELECTRA SERVICES (INDIA) PRIVATE LIMITED", "", "AADCP2721M", "24AADCP2721M1ZH", "VENDOR", "DEVELOPER"],
  [156, "V-0220", "POOJA ROADLINES", "9324289700", "", "", "AGENT", "DEVELOPER"],
  [157, "V-0185", "POWER LINE", "", "AAJPC1759K", "24AAJPC1759K1ZP", "VENDOR", "DEVELOPER"],
  [158, "V-0123", "POYCOAT ELECTRA SERVICE PVY LTD.", "", "", "", "VENDOR", ""],
  [159, "V-0154", "PRECISE AUTOMATION AND CONTROL PVT. LTD.", "", "AAECP2646J", "24AAECP2646J1ZE", "VENDOR", "DEVELOPER"],
  [160, "V-0132", "PRODEV MANUFACTURING COMPANY", "", "AJMPS8948L", "24AJMPS8948L2Z7", "VENDOR", "DEVELOPER"],
  [161, "V-0180", "PRODEV MANUFACTURING COMPANY", "", "AJMPS8948L", "24AJMPS8948L2Z7", "VENDOR", "ANIL PANDEY"],
  [162, "V-0076", "RAILWAY BOOKING", "", "", "", "AGENT", "DEVELOPER"],
  [163, "V-0095", "RAILWAY BOOKING", "", "", "", "AGENT", ""],
  [164, "V-0025", "RAJKOT MUNICIPAL CORPORATION", "", "", "24AAAALR0138G1ZD", "VENDOR", "DEVELOPER"],
  [165, "V-0041", "RAKESH PATEL (AND)", "", "", "", "VENDOR", "DEVELOPER"],
  [166, "V-0192", "RED HOT ELECTRICALS", "", "AAOFR8751K", "06AAOFR8751K1ZI", "VENDOR", "MEHUL CHAVDA"],
  [167, "V-0200", "RELIABLITY SEALS", "", "", "", "VENDOR", ""],
  [168, "V-0153", "RELIANCE INDUSTRIES LTD.", "", "AAACR5055K", "24AAACR5055K1ZD", "VENDOR", "DEVELOPER"],
  [169, "V-0182", "RIHITA CARGO FORWARDERS PVT. LTD.", "", "AADCR5741B", "27AADCR5741B1ZM", "VENDOR", "ANIL PANDEY"],
  [170, "V-0054", "RITA ENTERPRISES", "", "", "", "VENDOR", ""],
  [171, "V-0038", "RONAK PAETL (BRD)", "", "", "", "VENDOR", ""],
  [172, "V-0046", "RONAK PATEL (BRD)", "", "", "", "VENDOR", ""],
  [173, "V-0046", "RONAK PATEL (DDR)", "", "", "", "VENDOR", ""],
  [174, "V-0174", "RUPRAJ TECHNICAL SERVICES", "", "AANFR3610C", "24AANFR3610C1ZM", "VENDOR", "DEVELOPER"],
  [175, "V-0120", "SACHIN INDUSTRIES LIMITED", "", "", "24AAFCS5905E1ZL", "VENDOR", "DEVELOPER"],
  [176, "V-0030", "SARDAR PATEL EDUCATION TRUST", "", "", "", "VENDOR", ""],
  [177, "V-0021", "SARDAR SAROVAR HOLIDAY RESORTS LLP", "", "", "24ADRFS2842J1Z0", "VENDOR", "DEVELOPER"],
  [178, "V-0026", "SHARP PRINTS", "", "", "", "VENDOR", ""],
  [179, "V-0178", "SHIV INDUSTRIES", "", "AGLPP8758K", "24AGLPP8758K1ZL", "VENDOR", "ANIL PANDEY"],
  [180, "V-0117", "SHIVAM CARGO", "", "", "", "AGENT", "DEVELOPER"],
  [181, "V-0022", "SHIVNERI FRESH VEG", "", "", "", "VENDOR", ""],
  [182, "V-0183", "SHREE ISHAN EQUIPMENT PRIVATE LIMITED", "", "AAACI4131R", "24AAACI4131R1ZH", "VENDOR", "DEVELOPER"],
  [183, "V-0126", "SHREE RAM RUBTECH PVT LTD", "", "AACCS9776Q", "24AACCS9776Q1ZE", "VENDOR", "DEVELOPER"],
  [184, "V-0071", "SHREE SHYAM TRAVELS", "", "", "", "AGENT", "DEVELOPER"],
  [185, "V-0213", "SHREE SULPHURICS P LTD.", "", "AAECS0968E", "24AAECS0968E1ZH", "VENDOR", "DEVELOPER"],
  [186, "V-0049", "SMITA KORADIYA", "", "", "", "VENDOR", "DEVELOPER"],
  [187, "V-0203", "STEELCO GUJARAT LIMITED", "", "AADCS0880L", "24AADCS0880L2Z7", "VENDOR", "DEVELOPER"],
  [188, "V-0111", "SUN PHARMA ADVANCED RESEARCH COMPANY LTD", "", "AAJCS8340R", "24AAJCS8340R1ZN", "VENDOR", "DEVELOPER"],
  [189, "V-0197", "SUN PHARMACEUTICAL INDUSTRIES LTD (KARAKHADI)", "", "", "24AADCS3124K1ZJ", "VENDOR", "DEVELOPER"],
  [190, "V-0064", "SUN PHARMACEUTICAL INDUSTRIES LTD GURGAON R&D", "", "AADCS3124K", "06AADCS3124K1ZH", "VENDOR", "DEVELOPER"],
  [191, "V-0075", "SUNPHARMACEUTICAL INDUSTRIES LTD.", "", "AADCS3124K", "24AADCS3124K1ZJ", "VENDOR", "DEVELOPER"],
  [192, "V-0115", "SUNPHARMACEUTICAL INDUSTRIES LTD.", "", "AADCS3124K", "24AADCS3124K1ZJ", "VENDOR", "DEVELOPER"],
  [193, "V-0196", "SUNPHARMACEUTICAL INDUSTRIES LTD.(ANKLESHWAR)", "", "AADCS3124K", "24AADCS3124K1ZJ", "VENDOR", "DEVELOPER"],
  [194, "V-0164", "SUVIDHI AGENCIES", "", "", "27AHGPG8241C1ZM", "VENDOR", "DEVELOPER"],
  [195, "V-0074", "TARU MARKETING SERVICE", "", "", "24AKFPM8465J1ZR", "VENDOR", ""],
  [196, "V-0198", "TECHNO ENGINEERING", "", "", "", "VENDOR", ""],
  [197, "V-0205", "TECHNO FAB ENGINEERS", "", "AAHFT3966F", "24AAHFT3966F1Z1", "VENDOR", "DEVELOPER"],
  [198, "V-0006", "TESTING", "", "", "", "VENDOR", ""],
  [199, "V-0186", "THERMAX LTD.", "", "AAACT3910D", "24AAACT3910D1ZY", "VENDOR", "DEVELOPER"],
  [200, "V-0187", "USHTA INFINITY CONSTRUCTION CO PVT LTD C/O HINDALCO INDUSTRIES LTD", "", "AAACI9029G", "21AAACI9029G1ZV", "VENDOR", "DEVELOPER"],
  [201, "V-0202", "USHTA INFINITY CONSTRUCTION CO PVT LTD C/O NAYARA ENERGY LIMITED", "", "AAACE0890P", "24AAACE0890P1ZF", "VENDOR", "DEVELOPER"],
  [202, "V-0167", "USHTA INFINITY CONSTRUCTION CO PVT LTD GNFC", "", "", "24AAACI9029G1ZP", "VENDOR", "DEVELOPER"],
  [203, "V-0163", "USHTA INFINITY CONSTRUCTION CO PVT LTD MULDWARKA", "", "", "24AAACI9029G1ZP", "VENDOR", "DEVELOPER"],
  [204, "V-0166", "USHTA INFINITY CONSTRUCTION CO. PVT LTD NARSINGARH", "", "", "", "VENDOR", "DEVELOPER"],
  [205, "V-0201", "USHTA INFINITY CONSTRUCTION CO. PVT. LTD C/O MUNDRA", "", "", "24AAACI9029G1ZP", "VENDOR", "DEVELOPER"],
  [206, "V-0162", "USHTA INFINITY CONSTRUCTION CO. PVT. LTD. C/O", "", "", "24AAACI9029G1ZP", "VENDOR", "DEVELOPER"],
  [207, "V-0138", "USHTA INFINITY CONSTRUCTION CO.PVT.LTD", "", "AAACI9029G", "24AAACI9029G1ZP", "VENDOR", "DEVELOPER"],
  [208, "V-0188", "USHTA INFINITY CONSTRUCTION CO.PVT.LTD", "", "AAACI9029G", "24AAACI9029G1ZP", "VENDOR", "DEVELOPER"],
  [209, "V-0156", "USHTA INFINITY CONSTRUCTION CO.PVT.LTD ( BALODA BAZAAR)", "", "AAACI9029G", "22AAACI9029G1ZT", "VENDOR", "DEVELOPER"],
  [210, "V-0171", "USHTA INFINITY CONSTRUCTION CO.PVT.LTD (ANKLESHWAR)", "", "AAACI9029G", "24AAACI9029G1ZP", "VENDOR", "DEVELOPER"],
  [211, "V-0169", "USHTA INFINITY CONSTRUCTION CO.PVT.LTD (SRIHARIKOTA )", "", "", "24AAACI9029G1ZP", "VENDOR", "DEVELOPER"],
  [212, "V-0175", "USHTA INFINITY CONSTRUCTION CO.PVT.LTD C/O", "", "", "24AAACI9029G1ZP", "VENDOR", ""],
  [213, "V-0189", "USHTA INFINITY CONSTRUCTION CO.PVT.LTD C/O MEGHMANI ORGANICS LIMITED", "", "AAACI9029G", "24AAACI9029G1ZP", "VENDOR", "DEVELOPER"],
  [214, "V-0172", "USHTA INFINITY CONSTRUCTION CO.PVT.LTD C/O VADODARA WAREHOUSE", "", "AAACI9029G", "24AAACI9029G1ZP", "VENDOR", "ANIL PANDEY"],
  [215, "V-0173", "USHTA INFINITY CONSTRUCTION CO.PVT.LTD RAJKOT", "", "AAACI9029G", "24AAACI9029G1ZP", "VENDOR", "DEVELOPER"],
  [216, "V-0146", "USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED", "", "AAACI9029G", "09AAACI9029G1ZH", "VENDOR", "DEVELOPER"],
  [217, "V-0149", "USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED ( SITAPURAM))", "", "AAACI9029G", "36AAACI9029G1ZK", "VENDOR", "DEVELOPER"],
  [218, "V-0155", "USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED ( BHATAPARA)", "", "AAACI9029G", "22AAACI9029G1ZT", "VENDOR", "DEVELOPER"],
  [219, "V-0150", "USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED ( SILVASSA)", "", "AAACI9029G", "26AAACI9029G1ZL", "VENDOR", "DEVELOPER"],
  [220, "V-0168", "USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED (ASSAM)", "", "", "", "VENDOR", "DEVELOPER"],
  [221, "V-0161", "USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED (CHITTORGARH)", "", "AAACI9029G", "08AAACI9029G1ZJ", "VENDOR", "DEVELOPER"],
  [222, "V-0165", "USHTA INFINITY CONSTRUCTION COMPANY PRIVATE LIMITED UDUPI", "", "AAACI9029G", "29AAACI9029G1ZF", "VENDOR", "DEVELOPER"],
  [223, "V-0218", "USMAN BHAI", "9725613247", "", "", "AGENT", "DEVELOPER"],
  [224, "V-0160", "USTHA INFINITY CONSTRUCTION CO PVT LTD (NARSINGARH)", "", "AAACI9029G", "23AAACI9029G1ZR", "VENDOR", "DEVELOPER"],
  [225, "V-0131", "V TRANS (INDIA) LTD", "", "", "", "VENDOR", ""],
  [226, "V-0135", "V TRANS INDIA LTD", "", "", "", "VENDOR", ""],
  [227, "V-0040", "VANISHA DESAI", "", "", "", "VENDOR", "DEVELOPER"],
  [228, "V-0039", "VANISHA DESAI (BRD)", "", "", "", "VENDOR", ""],
  [229, "V-0039", "VANISHA DESAI (DDR)", "", "", "", "VENDOR", ""],
  [230, "V-0096", "VIJAYBHAI GAIKWAD", "", "", "", "VENDOR", "DEVELOPER"],
  [231, "V-0106", "VIRAL INDUSTRIES", "", "", "24AERPP2729L1ZY", "VENDOR", "DEVELOPER"],
  [232, "V-0179", "VRUND ENGITECH PRIVATE LIMITED", "", "AAKCV0100F", "24AAKCV0100F1ZY", "VENDOR", "ANIL PANDEY"],
  [233, "V-0181", "ZENEX ANIMAL HEALTH INDIA PRIVATE LIMITED", "", "AAHCN4871E", "24AAHCN4871E1ZH", "VENDOR", "ANIL PANDEY"],
  [234, "V-0109", "ZENPACK PREMIUM INDUSTRIES PRIVATE LIMITED", "", "AABCZ2009E", "24AABCZ2009E1ZT", "VENDOR", "DEVELOPER"],
  [235, "V-0099", "", "", "", "", "AGENT", ""],

  [236, "BV-1", "GUJARAT ALKALIES & CHEMICALS LTD", "", "", "", "VENDOR", ""],
  [237, "BV-2", "GUJARAT STATE ELECTRICITY CORP LTD WANAKBORI", "", "", "", "VENDOR", ""],
  [238, "BV-4", "Deepak Shah ( BRD)", "", "", "", "VENDOR", ""],
  [239, "BV-6", "NTPC", "", "", "", "VENDOR", ""],
  [240, "BV-7", "Mr. samir Vyas ( BRD)", "", "", "", "VENDOR", ""],
  [241, "BV-14", "Mr. SAMIR VYAS (BRD)", "", "", "", "VENDOR", ""],
  [242, "BV-16", "MR SAMIR VYAS (BRD)", "", "", "", "VENDOR", ""],
  [243, "BV-17", "MRS. KRISHNA  PATEL (AND)", "", "", "", "VENDOR", ""],
  [244, "BV-20", "MR GAUTAM  AMIN (BRD)", "", "", "", "VENDOR", ""],
  [245, "BV-21", "MRS. MAUSAM PATEL (BRD)", "", "", "", "VENDOR", ""],
  [246, "BV-22", "MR. CHANDRAVADAN PATEL (BRD)", "", "", "", "VENDOR", ""],
  [247, "BV-23", "MR. DHANANJAY JOSHI (BRD)", "", "", "", "VENDOR", ""],
  [248, "BV-29", "SARDAR SAROVAR HOLIDAY RESORTS LLP", "", "", "", "VENDOR", ""],
  [249, "BV-31", "MRS. ROSHANI VYAS (BRD)", "", "", "", "VENDOR", ""],
  [250, "BV-33", "RAJKOT MUNICIPAL CORPORATION", "", "", "", "VENDOR", ""],
  [251, "BV-36", "BHANU COSPACK PRIVATE LTD", "", "", "", "VENDOR", ""],
  [252, "BV-39", "SARDAR PATEL EDUCATION TRUST", "", "", "", "VENDOR", ""],
  [253, "BV-41", "MR. RISHABH JINGER (BRD)", "", "", "", "VENDOR", ""],
  [254, "BV-43", "Mr Mounang Patel", "", "", "", "VENDOR", ""],
  [255, "BV-50", "VANISHA DESAI (BRD)", "", "", "", "VENDOR", ""],
  [256, "BV-55", "DENORA INDIA LTD", "", "", "", "VENDOR", ""],
  [257, "BV-56", "GUJARAT ALKALIES & CHEMICALS LTD DAHEJ", "", "", "", "VENDOR", ""],
  [258, "BV-60", "MR VASUDEV PATEL (BRD)", "", "", "", "VENDOR", ""],
  [259, "BV-61", "MR ANMOL PATEL (BRD)", "", "", "", "VENDOR", ""],
  [260, "BV-62", "SMITA KORADIYA", "", "", "", "VENDOR", ""],
  [261, "BV-68", "MR NITYA PATEL (BRD)", "", "", "", "VENDOR", ""],
  [262, "BV-72", "MR. CHIRAG PATEL", "", "", "", "VENDOR", ""],
  [263, "BV-75", "MR. PARESH PARIKH (BRD)", "", "", "", "VENDOR", ""],
  [264, "BV-76", "MRS. PRACHI SHAH (AHD)", "", "", "", "VENDOR", ""],
  [265, "BV-82", "MR VIRENDRA MANDERA", "", "", "", "VENDOR", ""],
  [266, "BV-84", "MR PRANAV PATEL BARODA", "", "", "", "VENDOR", ""],
  [267, "BV-85", "Mr KUNAL SHAH ( BRD)", "", "", "", "VENDOR", ""],
  [268, "BV-87", "CLARUS CORPORATION", "", "", "", "VENDOR", ""],
  [269, "BV-91", "GUJARAT STATE ELECTRICITY CORP LTD BHAVNAGAR", "", "", "", "VENDOR", ""],
  [270, "BV-97", "MR SURESH SHAH", "", "", "", "VENDOR", ""],
  [271, "BV-98", "Mr. Nikunj Patel ( BRd)", "", "", "", "VENDOR", ""],
  [272, "BV-100", "Mr Dilipbhai  Shah ( BRd)", "", "", "", "VENDOR", ""],
  [273, "BV-104", "Mr. Aditya Shah", "", "", "", "VENDOR", ""],
  [274, "BV-105", "Mr. Monish Jhaveri", "", "", "", "VENDOR", ""],
  [275, "BV-108", "GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR", "", "", "", "VENDOR", ""],
  [276, "BV-109", "Mr. Amish Bhavsar  (BRD)", "", "", "", "VENDOR", ""],
  [277, "BV-111", "Mr. Vijaybhai Thakkar", "", "", "", "VENDOR", ""],
  [278, "BV-119", "BLISS GVS PHARMA LIMITED", "", "", "", "VENDOR", ""],
  [279, "BV-125", "MUSLIM BHAI (VADODARA)", "", "", "", "VENDOR", ""],
  [280, "BV-126", "k m patel", "", "", "", "VENDOR", ""],
  [281, "BV-135", "ARCELI LIFESCIENCE PRIVATE LIMITED", "", "", "", "VENDOR", ""],
  [282, "BV-137", "ASKON HYGIENE PRODUCTS PRIVATE LIMITED", "", "", "", "VENDOR", ""],
  [283, "BV-152", "MRS JHEEL", "", "", "", "VENDOR", ""]
];

/* Dedupes by ATTrans SR NO. (unique per source row) so it's safe to run more
   than once without piling up duplicates. */
export function importLegacyVendors(db){
  db.vendorDirectory = db.vendorDirectory || [];
  const have = {};
  db.vendorDirectory.forEach(v => { if (v.srNo != null) have[v.srNo] = true; });
  let added = 0;
  LEGACY_VENDORS.forEach(([srNo, vendorCode, name, contactNo, panCard, gst, type, createdBy]) => {
    if (have[srNo]) return;
    have[srNo] = true;
    db.vendorDirectory.push({ id: uid('vd'), srNo, vendorCode, name, contactNo, panCard, gst, type, createdBy });
    added++;
  });
  return added;
}

/* ---------- Bill / Invoice (Vendor Bill) — a NEW, independent module, separate
   from LR / Consignment Notes (blankLR/computeLR/LR_CHG above are untouched).
   Modeled on the ATTrans "Add New Bill" screen: a vendor bill that bundles one
   or more of the company's own LRs (looked up read-only from db.lrs — a Bill
   line never writes back to the LR record it was copied from) plus a fixed
   LR Charges block, a free-form Payment Detail grid (additions/deductions),
   and SGST/CGST/IGST computed on the gross. The vendor is picked from the
   ATTrans-imported Vendor Directory (db.vendorDirectory, see importLegacyVendors
   above) rather than db.vendors, since this Bill screen is itself a
   reproduction of that same ATTrans "app.bgts.in" module the vendor register
   came from.
   ASSUMPTIONS (no reference data was given for these — flagged for review):
     - BILL_PAYMENT_OPTIONS (the "SELECT AN OPTION" dropdown) and
       BILL_BANK_OPTIONS are placeholder lists; edit them here once the
       user confirms the real option sets.
     - Calculation order: TOTAL AMOUNT (LR lines + LR Charges) -> + additions
       - deductions = GROSS AMOUNT -> SGST/CGST/IGST % applied to GROSS AMOUNT
       -> + Round Off = NET AMOUNT -> - Advance Receive = BALANCE AMOUNT. */
export const BILL_CHG = [
  ['hamali', 'HAMALI'], ['loading', 'LOADING'], ['unloading', 'UNLOADING'], ['rtoChallan', 'RTO CHALLAN'],
  ['varai', 'VARAI'], ['lrCharges', 'LR CHARGES'], ['detention', 'DETENTION'], ['otherAdd', 'OTHER ADD'],
  ['dockCharges', 'DOCK CHARGES'], ['extraDelivery', 'EXTRA DELIVERY']
];
export const BILL_PAYMENT_OPTIONS = ['TDS', 'ADVANCE ADJUSTMENT', 'COMMISSION', 'PENALTY / LATE DELIVERY', 'DAMAGE / SHORTAGE', 'INCENTIVE', 'OTHER', 'GST / Other (from import)'];
export const BILL_BANK_OPTIONS = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Bank of Baroda', 'Kotak Mahindra Bank', 'IDFC FIRST Bank', 'Yes Bank', 'Other'];
export const BILL_STATUS_OPTIONS = ['PENDING', 'RECEIVED', 'BILLED', 'PAID'];

export function blankBillLine(){
  return { id: uid('bl'), lrId: '', status: 'PENDING', lrNo: '', date: '', from: '', to: '', weight: '', pcs: '', rate: '', amount: '', otherCharges: '', remark: '' };
}
export function blankBill(){
  const ch = {}; BILL_CHG.forEach(c => { ch[c[0]] = ''; });
  return {
    id: '', invoiceNo: '', vendorId: '', date: todayISO(), poNo: '', poDate: '',
    lines: [blankBillLine()], charges: ch, additions: [], deductions: [],
    sgstPct: '', cgstPct: '', igstPct: '', roundOff: '', advanceReceive: '',
    bank: '', remark: '', subject: '', createdAt: ''
  };
}
/* Copies an existing LR's descriptive fields into a bill-line shape — read-only
   lookup, never mutates db.lrs. `amount` defaults to that LR's own billed gross
   so the row starts pre-filled with what the LR already says it's worth; still
   fully editable before the bill is saved. */
export function billLineFromLR(lr){
  const pcs = (lr.goods || []).reduce((sum, g) => sum + (Number(g.pcs) || 0), 0);
  return {
    lrId: lr.id, lrNo: lr.lrNo, date: lr.date, from: lr.fromPlace, to: lr.toPlace,
    weight: lr.cWeight || lr.aWeight || '', pcs: pcs || '',
    rate: (lr.charges && lr.charges.rate) || '', amount: lr.gross || ''
  };
}
export function computeBill(bill){
  const n = v => Number(v) || 0;
  const lineTotal = (bill.lines || []).reduce((sum, l) => sum + n(l.amount) + n(l.otherCharges), 0);
  const chargesTotal = BILL_CHG.reduce((sum, c) => sum + n(bill.charges && bill.charges[c[0]]), 0);
  const totalAmount = lineTotal + chargesTotal;
  const totalAddition = (bill.additions || []).reduce((sum, a) => sum + n(a.amount), 0);
  const totalDeduction = (bill.deductions || []).reduce((sum, a) => sum + n(a.amount), 0);
  const grossAmount = totalAmount + totalAddition - totalDeduction;
  const sgstAmt = grossAmount * n(bill.sgstPct) / 100;
  const cgstAmt = grossAmount * n(bill.cgstPct) / 100;
  const igstAmt = grossAmount * n(bill.igstPct) / 100;
  const netAmount = grossAmount + sgstAmt + cgstAmt + igstAmt + n(bill.roundOff);
  const balanceAmount = netAmount - n(bill.advanceReceive);
  return { lineTotal, chargesTotal, totalAmount, totalAddition, totalDeduction, grossAmount, sgstAmt, cgstAmt, igstAmt, netAmount, balanceAmount };
}

/* ---------- Legacy Bills — imported wholesale from ATTrans's "BILLING SUMMERY"
   PDF export (period 01-04-2026 to 25-08-2026, 148 bills, uploaded 2026-08-25).
   Row shape: [invoiceNo, date, vendorSrNo, gross, net] — invoiceNo is the
   4-digit number from the source's "/BRD/00NN" bill code (the "/BRD/" part is
   ATTrans's own branch-code prefix, not part of the Invoice No field itself —
   matches the Bill Details register screenshot's INVOICE column, which shows
   just "0148" etc). vendorSrNo is a Vendor Directory srNo (see LEGACY_VENDORS
   above) — importLegacyBills() resolves it to that vendor's live `id` at
   import time, so Vendor Directory must be imported first (Masters -> Vendor
   Directory -> Import ATTrans Vendor List) or these rows have nowhere to
   point and get skipped (surfaced back to the caller as skippedNoVendor).

   IMPORTANT — what "gross" and "net" mean here, and why every imported bill
   gets a "GST / Other (from import)" addition line:
   The source PDF is a SUMMARY export — it gives only GROSS AMOUNT and NET
   AMOUNT per bill, not the underlying LR lines / LR Charges / tax breakdown
   that produced them. The gap between the two is NOT a clean, consistent
   percentage (checked: most rows are exactly gross, or gross*1.18 — a normal
   18% GST — but a distinct minority land on other ratios like 1.32, 1.52,
   1.75, which aren't real GST slabs, so the gap is evidently a mix of tax AND
   un-itemized LR charges for those bills). Rather than guess a tax rate that
   would be wrong for those rows, each import: (1) creates ONE synthetic bill
   line carrying the exact GROSS amount, clearly remarked as imported without
   LR-level detail; (2) puts the entire gross-to-net gap into a single
   Payment Detail addition labeled "GST / Other (from import)" — visible,
   editable, and numerically exact, instead of a silently-assumed GST%.
   This reproduces the source's own GROSS AMOUNT (-> Total Amount) and NET
   AMOUNT (-> Net Amount) exactly, and stays exact if the bill is reopened
   and re-saved without changes, since computeBill() derives both from data
   actually stored on the record (not from a guessed rate). */
export const LEGACY_BILLS = [
  ["0001", "2026-04-01", 56, 114583.81, 135208.9],
  ["0002", "2026-04-01", 52, 59239.22, 69902.28],
  ["0003", "2026-04-03", 164, 44522.0, 44522.0],
  ["0004", "2026-04-06", 164, 44522.0, 44522.0],
  ["0005", "2026-04-09", 149, 18282.0, 21572.76],
  ["0006", "2026-04-09", 164, 44522.0, 44522.0],
  ["0007", "2026-04-10", 164, 44522.0, 44522.0],
  ["0008", "2026-04-13", 233, 29635.0, 45058.3],
  ["0009", "2026-04-13", 233, 29635.0, 45058.3],
  ["0010", "2026-04-13", 233, 29635.0, 45058.3],
  ["0011", "2026-04-13", 233, 29635.0, 45058.3],
  ["0012", "2026-04-13", 233, 29635.0, 45058.3],
  ["0013", "2026-04-14", 164, 44522.0, 44522.0],
  ["0014", "2026-04-16", 164, 44522.0, 44522.0],
  ["0015", "2026-04-20", 164, 44522.0, 44522.0],
  ["0016", "2026-04-21", 164, 44522.0, 44522.0],
  ["0017", "2026-04-22", 164, 44522.0, 44522.0],
  ["0018", "2026-04-25", 164, 44522.0, 44522.0],
  ["0019", "2026-04-25", 164, 44522.0, 44522.0],
  ["0020", "2026-04-29", 164, 44522.0, 44522.0],
  ["0021", "2026-05-01", 52, 20990.26, 24768.51],
  ["0022", "2026-05-01", 164, 44522.0, 44522.0],
  ["0023", "2026-05-01", 56, 114610.14, 135239.97],
  ["0024", "2026-05-04", 164, 44522.0, 44522.0],
  ["0025", "2026-05-08", 151, 58300.0, 68794.0],
  ["0026", "2026-05-08", 164, 44522.0, 44522.0],
  ["0027", "2026-05-08", 207, 37000.0, 43660.0],
  ["0028", "2026-05-08", 207, 26000.0, 30680.0],
  ["0029", "2026-05-08", 207, 150500.0, 183490.0],
  ["0030", "2026-05-08", 207, 78200.0, 101716.0],
  ["0031", "2026-05-08", 207, 1000.0, 1180.0],
  ["0032", "2026-05-11", 53, 26434.5, 31192.71],
  ["0033", "2026-05-12", 53, 26434.5, 31192.71],
  ["0034", "2026-05-15", 52, 39741.57, 46895.05],
  ["0035", "2026-05-15", 164, 44522.0, 44522.0],
  ["0036", "2026-05-15", 164, 44522.0, 44522.0],
  ["0037", "2026-05-16", 164, 44522.0, 44522.0],
  ["0038", "2026-05-16", 164, 44522.0, 44522.0],
  ["0039", "2026-05-19", 164, 44522.0, 44522.0],
  ["0040", "2026-05-23", 164, 44522.0, 44522.0],
  ["0041", "2026-05-24", 164, 44522.0, 44522.0],
  ["0042", "2026-05-28", 164, 44522.0, 44522.0],
  ["0043", "2026-05-29", 164, 44522.0, 44522.0],
  ["0044", "2026-06-01", 53, 43998.8, 51918.58],
  ["0045", "2026-06-01", 53, 43998.8, 51918.58],
  ["0046", "2026-06-01", 164, 44522.0, 44522.0],
  ["0047", "2026-06-01", 56, 114686.31, 135329.85],
  ["0048", "2026-06-01", 52, 12687.45, 14971.19],
  ["0049", "2026-06-01", 149, 25910.0, 30573.8],
  ["0050", "2026-06-04", 233, 24635.0, 39158.3],
  ["0051", "2026-06-04", 233, 24635.0, 39158.3],
  ["0052", "2026-06-04", 233, 17285.0, 30249.3],
  ["0053", "2026-06-04", 233, 24635.0, 39158.3],
  ["0054", "2026-06-04", 233, 24635.0, 39158.3],
  ["0055", "2026-06-04", 233, 17285.0, 30249.3],
  ["0056", "2026-06-04", 164, 44522.0, 44522.0],
  ["0057", "2026-06-04", 164, 44522.0, 44522.0],
  ["0058", "2026-06-05", 164, 44522.0, 44522.0],
  ["0059", "2026-06-05", 164, 44522.0, 44522.0],
  ["0060", "2026-06-08", 164, 44522.0, 44522.0],
  ["0061", "2026-06-09", 164, 44522.0, 44522.0],
  ["0062", "2026-06-11", 164, 44522.0, 44522.0],
  ["0063", "2026-06-16", 52, 22389.62, 26419.75],
  ["0064", "2026-06-16", 164, 44522.0, 44522.0],
  ["0065", "2026-06-17", 164, 44522.0, 44522.0],
  ["0066", "2026-06-19", 164, 44522.0, 44522.0],
  ["0067", "2026-06-21", 164, 44522.0, 44522.0],
  ["0068", "2026-06-23", 164, 44522.0, 44522.0],
  ["0069", "2026-06-24", 164, 44522.0, 44522.0],
  ["0070", "2026-06-25", 233, 29635.0, 39158.3],
  ["0071", "2026-06-25", 233, 29635.0, 39158.3],
  ["0072", "2026-06-25", 233, 29635.0, 39158.3],
  ["0073", "2026-06-25", 233, 29635.0, 39158.3],
  ["0074", "2026-06-25", 233, 29635.0, 39158.3],
  ["0075", "2026-06-25", 164, 44522.0, 44522.0],
  ["0076", "2026-06-27", 164, 44522.0, 44522.0],
  ["0077", "2026-06-30", 164, 44522.0, 44522.0],
  ["0078", "2026-07-01", 164, 44522.0, 44522.0],
  ["0079", "2026-07-01", 56, 120761.99, 142499.15],
  ["0080", "2026-07-01", 52, 23882.27, 28181.08],
  ["0081", "2026-07-03", 52, 50000.0, 59000.0],
  ["0082", "2026-07-03", 164, 44522.0, 44522.0],
  ["0083", "2026-07-05", 164, 44522.0, 44522.0],
  ["0084", "2026-07-06", 164, 44522.0, 44522.0],
  ["0085", "2026-07-08", 52, 50000.0, 59000.0],
  ["0086", "2026-07-08", 164, 44522.0, 44522.0],
  ["0087", "2026-07-10", 16, 11000.0, 12980.0],
  ["0088", "2026-07-10", 32, 37700.0, 44486.0],
  ["0089", "2026-07-10", 32, 37700.0, 44486.0],
  ["0090", "2026-07-10", 53, 26434.5, 31192.71],
  ["0091", "2026-07-10", 53, 26434.54, 31192.76],
  ["0092", "2026-07-11", 32, 37700.0, 44486.0],
  ["0093", "2026-07-13", 32, 37700.0, 44486.0],
  ["0094", "2026-07-13", 164, 44522.0, 44522.0],
  ["0095", "2026-07-13", 164, 44522.0, 44522.0],
  ["0096", "2026-07-13", 164, 44522.0, 44522.0],
  ["0097", "2026-07-14", 32, 37700.0, 44486.0],
  ["0098", "2026-07-14", 32, 37700.0, 44486.0],
  ["0099", "2026-07-16", 52, 30785.74, 36327.17],
  ["0100", "2026-07-16", 32, 37700.0, 44486.0],
  ["0101", "2026-07-17", 164, 44522.0, 44522.0],
  ["0102", "2026-07-19", 164, 44522.0, 44522.0],
  ["0103", "2026-07-19", 32, 37700.0, 44486.0],
  ["0104", "2026-07-19", 149, 22500.0, 26550.0],
  ["0105", "2026-07-20", 233, 34635.0, 47418.3],
  ["0106", "2026-07-19", 233, 34635.0, 47418.3],
  ["0107", "2026-07-21", 164, 44522.0, 44522.0],
  ["0108", "2026-07-22", 32, 37700.0, 44486.0],
  ["0109", "2026-07-23", 164, 44522.0, 44522.0],
  ["0110", "2026-07-24", 32, 37700.0, 44486.0],
  ["0111", "2026-07-27", 53, 43998.8, 51918.58],
  ["0112", "2026-07-27", 53, 43998.8, 51918.58],
  ["0113", "2026-07-27", 164, 44522.0, 44522.0],
  ["0114", "2026-07-28", 32, 37700.0, 44486.0],
  ["0115", "2026-07-28", 32, 26930.0, 31777.4],
  ["0116", "2026-07-28", 164, 44522.0, 44522.0],
  ["0117", "2026-07-29", 164, 44522.0, 44522.0],
  ["0118", "2026-07-30", 32, 37700.0, 44486.0],
  ["0119", "2026-08-01", 52, 50000.0, 59000.0],
  ["0120", "2026-08-01", 164, 44522.0, 44522.0],
  ["0121", "2026-08-01", 164, 44522.0, 44522.0],
  ["0122", "2026-08-01", 52, 18004.98, 21245.88],
  ["0123", "2026-08-01", 56, 118009.17, 139250.82],
  ["0124", "2026-08-02", 32, 37700.0, 44486.0],
  ["0125", "2026-08-03", 164, 44522.0, 44522.0],
  ["0126", "2026-08-03", 164, 44522.0, 44522.0],
  ["0127", "2026-08-04", 32, 37700.0, 44486.0],
  ["0128", "2026-08-05", 164, 44522.0, 44522.0],
  ["0129", "2026-08-06", 164, 44522.0, 44522.0],
  ["0130", "2026-08-06", 32, 37700.0, 44486.0],
  ["0131", "2026-08-09", 32, 37700.0, 44486.0],
  ["0132", "2026-08-09", 164, 44522.0, 44522.0],
  ["0133", "2026-08-09", 233, 34635.0, 47418.3],
  ["0134", "2026-08-09", 233, 34635.0, 47418.3],
  ["0135", "2026-08-09", 233, 34635.0, 47191.74],
  ["0136", "2026-08-11", 32, 37700.0, 44486.0],
  ["0137", "2026-08-11", 164, 44522.0, 44522.0],
  ["0138", "2026-08-12", 164, 44522.0, 44522.0],
  ["0139", "2026-08-13", 164, 44522.0, 44522.0],
  ["0140", "2026-08-13", 32, 37700.0, 44486.0],
  ["0141", "2026-08-15", 32, 37700.0, 44486.0],
  ["0142", "2026-08-16", 164, 44522.0, 44522.0],
  ["0143", "2026-08-16", 164, 44522.0, 44522.0],
  ["0144", "2026-08-17", 32, 37700.0, 44486.0],
  ["0145", "2026-08-17", 52, 12874.03, 15191.36],
  ["0146", "2026-08-22", 164, 44522.0, 44522.0],
  ["0147", "2026-08-22", 164, 44522.0, 44522.0],
  ["0148", "2026-08-24", 164, 44522.0, 44522.0]
];

/* Dedupes by Invoice No (unique per source bill). Requires Vendor Directory to
   already be imported — any row whose vendorSrNo isn't found there yet is
   skipped and counted in skippedNoVendor rather than guessed at, so re-running
   after importing Vendor Directory picks up exactly the rows that failed. */
export function importLegacyBills(db){
  db.bills = db.bills || [];
  const have = {};
  db.bills.forEach(b => { if (b.invoiceNo) have[b.invoiceNo] = true; });
  const vendorBySr = {};
  (db.vendorDirectory || []).forEach(v => { vendorBySr[v.srNo] = v; });
  let added = 0, skippedNoVendor = 0;
  LEGACY_BILLS.forEach(([invoiceNo, date, vendorSrNo, gross, net]) => {
    if (have[invoiceNo]) return;
    const vendor = vendorBySr[vendorSrNo];
    if (!vendor) { skippedNoVendor++; return; }
    have[invoiceNo] = true;
    const gap = Math.round((net - gross) * 100) / 100;
    const charges = {}; BILL_CHG.forEach(c => { charges[c[0]] = ''; });
    const bill = {
      id: uid('bill'), invoiceNo, vendorId: vendor.id, date, poNo: '', poDate: '',
      lines: [{
        id: uid('bl'), lrId: '', status: 'BILLED', lrNo: '', date, from: '', to: '', weight: '', pcs: '', rate: '',
        amount: gross, otherCharges: '',
        remark: 'Imported from Billing Summary PDF (01-04-2026 to 25-08-2026) — LR-level detail not itemized in source.'
      }],
      charges,
      additions: gap > 0.005 ? [{ id: uid('bp'), type: 'GST / Other (from import)', amount: gap }] : [],
      deductions: [],
      sgstPct: '', cgstPct: '', igstPct: '', roundOff: '', advanceReceive: '',
      bank: '', remark: '', subject: '', createdAt: new Date().toISOString()
    };
    const t = computeBill(bill);
    bill.totalAmount = t.totalAmount; bill.totalAddition = t.totalAddition; bill.totalDeduction = t.totalDeduction;
    bill.grossAmount = t.grossAmount; bill.sgstAmt = t.sgstAmt; bill.cgstAmt = t.cgstAmt; bill.igstAmt = t.igstAmt;
    bill.netAmount = t.netAmount; bill.balanceAmount = t.balanceAmount;
    db.bills.push(bill);
    added++;
  });
  return { added, skippedNoVendor };
}

/* ---------- LHC (Lorry Hire Contract) trip — a NEW, independent module
   mirroring ATTrans's own "ADD NEW LHC" form (screenshot dated 2026-08-26),
   added as its own tab positioned right after LR / Consignment Notes.

   This does NOT touch the existing db.lhcs / LHCScreen.js — an older,
   simpler LHC form (vendorId + lorryHire/advance/tdsPct/payments) that isn't
   even wired into the sidebar nav currently. Rather than reshape that
   existing array/table to fit this much richer screenshot (header + LR
   table + vehicle/insurance/permit fields + Driver/Owner Info + Payment
   Detail + Expense grid) and risk breaking whatever depends on its current
   shape, this is kept as its own db.lhcTrips array with its own Supabase
   tables (lhc_trips / lhc_trip_lines / lhc_trip_payments / lhc_trip_expenses),
   same "new tab, new module" pattern used for the Bill tab.

   Row/field notes, flagged rather than guessed:
   - AGENT options below are transcribed verbatim from ATTrans's own
     <select name="agent"> dump, including its own duplicates/whitespace
     quirks ("Railway  Booking" with a double space AND a separate
     "Railway Booking" with a single space; "MITESHBHAI MUMBAI" has a
     trailing space in the source). Not merged or cleaned up.
   - LHC_PAYMENT_OPTIONS (the "---SELECT---" dropdown in the Payment Detail
     rows) — ATTrans's real option list wasn't visible in the screenshot
     (only the closed placeholder). Reused Bill's Payment Detail category
     list as a reasonable placeholder; flagged as an assumption to verify
     against ATTrans's actual LHC dropdown.
   - The screenshot's "Pay To" field's real option list also wasn't visible,
     so it's implemented as free text here rather than an invented dropdown.
   - "IMAGE / Choose File" is implemented (camera + gallery, same
     expo-image-picker pattern PODScreen.js already uses elsewhere in this
     app) — stored as a local URI string in imageUri. Same known limitation
     as POD photos: on the web build this is a browser blob: URL that only
     survives the current session (nothing is uploaded to durable storage;
     there's no Supabase Storage bucket wired up anywhere in this app yet).
     On native it's copied into permanent app storage, same as POD. */
export const LHC_AGENTS = [
  'MITESHBHAI MUMBAI ',
  'Shree shyam travels',
  'Railway  Booking',
  'Railway Booking',
  'jayesh bharwad',
  'MITESHBHAI',
  'SHIVAM CARGO',
  'jayhind roadways (dahej)',
  'MANOJ PATNI',
  'JIYA KAUNDAL',
  'Mr. Mohan baria',
  'JAGAT PANWAR',
  'akshar roadlines',
  'usman bhai',
  'pooja roadlines',
  'MR RAGHU BHARWAD'
];
export const LHC_PAYMENT_OPTIONS = ['TDS', 'ADVANCE ADJUSTMENT', 'COMMISSION', 'PENALTY / LATE DELIVERY', 'DAMAGE / SHORTAGE', 'INCENTIVE', 'OTHER', 'BALANCE ADJUSTMENT (from import)'];

export function blankLhcTripLine(){
  return { id: uid('ltl'), lrId: '', lrNo: '', date: '', content: '', pkgs: '', weight: '' };
}
export function lhcTripLineFromLR(lr){
  const pcs = (lr.goods || []).reduce((sum, g) => sum + (Number(g.pcs) || 0), 0);
  return {
    lrId: lr.id, lrNo: lr.lrNo, date: lr.date,
    content: (lr.goods || []).map(g => g.desc).filter(Boolean).join(', '),
    pkgs: pcs || '', weight: lr.cWeight || lr.aWeight || ''
  };
}
export function blankLhcTrip(){
  return {
    id: '', lhcNo: '', date: todayISO(), truckNo: '', fromPlace: '', toPlace: '',
    lines: [blankLhcTripLine()],
    agent: '', lorryType: '', chasisNo: '', engineNo: '', permitNo: '', insuranceCo: '', branch: '', policyNo: '',
    permitFrom: '', permitUpto: '', insuranceUpto: '',
    driverName: '', driverAddress: '', driverLicNo: '', driverLicDate: '', driverIssuedFrom: '', driverMobile: '',
    ownerName: '', ownerAddress: '', ownerPan: '', ownerMobile: '',
    lorryHire: '', advance: '', additions: [], deductions: [], payTo: '',
    expenses: [],
    imageUri: '',
    createdBy: '', createdAt: ''
  };
}
export function blankLhcExpense(){ return { id: uid('lte'), account: '', amount: '' }; }
export function computeLhcTrip(trip){
  const n = v => Number(v) || 0;
  const totalAddition = (trip.additions || []).reduce((sum, a) => sum + n(a.amount), 0);
  const totalDeduction = (trip.deductions || []).reduce((sum, a) => sum + n(a.amount), 0);
  const totalExpense = (trip.expenses || []).reduce((sum, e) => sum + n(e.amount), 0);
  const netAmount = n(trip.lorryHire) + totalAddition - totalDeduction;
  const balanceAmount = netAmount - n(trip.advance);
  return { totalAddition, totalDeduction, totalExpense, netAmount, balanceAmount };
}

/* ---------- LHC historical register — ATTrans's own "VIEW LHC DETAILS"
   list (32 rows, screenshots dated 2026-08-26), imported wholesale into the
   new LHC module above.
   Row shape: [lhcNo, date(ISO), truckNo, lrNo, fromPlace, toPlace,
   lorryHire, advance, balance, payTo, createdBy] — this is exactly what the
   register shows; no per-row Agent name, LR-level detail (content/pkgs/
   weight), driver/owner/vehicle info, or addition/deduction breakdown is
   available from this list view, so those are left blank on import, same
   as the Billing Summary PDF import did for Bills.

   FLAGGED, not silently fixed:
   - The register's own BALANCE column frequently does NOT equal
     Lorry Hire − Advance (e.g. SR 1/3/4: hire 20000, advance 12000, but
     balance shown as 20000, not 8000; SR 14/15/19/32: balance shown as 0.00
     even though hire − advance is positive; SR 21/22: balance shown well
     above hire − advance). Rather than guess why (advance reversed, part-
     settlement, manual override, data-entry error — no way to tell from a
     list view), each row's addition/deduction is set to the exact single
     value needed to reproduce ATTrans's own displayed balance via this
     module's normal netAmount/balance formula, labeled
     'BALANCE ADJUSTMENT (from import)' so it's visibly a reconciling entry,
     not an invented real transaction. See importLegacyLhcTrips().
   - SR 9 and SR 10 (BRD/02825, BRD/02824) share the same date (06-08-2026);
     SR 13/14 share 30-07-2026; SR 20/21 share 15-10-2025 — kept as separate
     rows, not merged; that's how the source register has them.
   - TRUCK NO is transcribed verbatim including the source's own
     inconsistent spacing/punctuation across otherwise-identical vehicles:
     "GJ 06 AY 4675" (SR 14, 19) vs "GJ06AY4675" (SR 15); "GJ-06-BX-7185"
     (SR 28); "GJ7YZ8661" (SR 32, missing the leading 0 that every other
     "GJ07YZ8661" row has). SR 10 (BRD/02824) lists two truck numbers
     separated by " | " in the source ("MH04CP1115 | GJ27TG1769") — kept as
     one verbatim string, not split.
   - The register's own LHC-number sequence isn't strictly chronological
     across its two visible numbering batches ("BRD/028xx" vs "BRD/000xx") —
     e.g. BRD/00016 (SR 17) is dated after BRD/00017 (SR 16). Transcribed as
     shown, not reordered.
   - PAYMENT column reads "AGENT" for all 32 rows — mapped to this module's
     payTo field verbatim; the Agent dropdown field itself (a party name)
     isn't populated since no per-row agent name is shown in this list. */
export const LEGACY_LHC_TRIPS = [
  ['BRD/02833', '2026-08-26', 'GJ07YZ8661', 'BRD/06824', 'BARODA', 'RAJKOT', 20000, 12000, 20000, 'AGENT', 'DEVELOPER'],
  ['BRD/02832', '2026-08-25', 'GJ07YZ8661', 'BRD/06823', 'GACL RANOLI', 'GACL COELHO PLANT', 1000, 0, 1000, 'AGENT', 'DEVELOPER'],
  ['BRD/02831', '2026-08-22', 'GJ06AT6590', 'BRD/06817', 'BARODA', 'RAJKOT', 20000, 12000, 20000, 'AGENT', 'DEVELOPER'],
  ['BRD/02830', '2026-08-20', 'GJ06AT6590', 'BRD/06809', 'BARODA', 'RAJKOT', 20000, 12000, 20000, 'AGENT', 'DEVELOPER'],
  ['BRD/02829', '2026-08-14', 'GJ06BT9525', 'BRD/06801', 'NANDESARI', 'ANKLESHWAR', 20000, 17000, 3000, 'AGENT', 'DEVELOPER'],
  ['BRD/02828', '2026-08-12', 'GJ06BT9525', 'BRD/06797', 'NANDESARI', 'ANKLESHWAR', 20000, 17000, 3000, 'AGENT', 'DEVELOPER'],
  ['BRD/02827', '2026-08-10', 'GJ06BT9525', 'BRD/06790', 'NANDESARI', 'ANKLESHWAR', 20000, 17000, 3000, 'AGENT', 'DEVELOPER'],
  ['BRD/02826', '2026-08-08', 'GJ06BT9525', 'BRD/06785', 'NANDESARI', 'ANKLESHWAR', 20000, 17000, 3000, 'AGENT', 'DEVELOPER'],
  ['BRD/02825', '2026-08-06', 'GJ06BT9525', 'BRD/06775', 'NANDESARI', 'ANKLESHWAR', 20000, 17000, 3000, 'AGENT', 'DEVELOPER'],
  ['BRD/02824', '2026-08-06', 'MH04CP1115 | GJ27TG1769', 'BRD/06776', 'CWC IMPEX JNPT', 'SURENDRANAGAR', 46000, 44000, 2000, 'AGENT', 'DEVELOPER'],
  ['BRD/02823', '2026-08-03', 'GJ06BT9525', 'BRD/06769', 'NANDESARI', 'ANKLESHWAR', 20000, 17000, 3000, 'AGENT', 'DEVELOPER'],
  ['BRD/02822', '2026-08-01', 'GJ06BT9525', 'BRD/06765', 'NANDESARI', 'ANKLESHWAR', 20000, 17000, 3000, 'AGENT', 'DEVELOPER'],
  ['BRD/02821', '2026-07-30', 'GJ06BT9525', 'BRD/06753', 'NANDESARI', 'ANKLESHWAR', 20000, 17000, 3000, 'AGENT', 'DEVELOPER'],
  ['BRD/02820', '2026-07-30', 'GJ 06 AY 4675', 'BRD/06755', 'MAKARPURA', 'GACL RANOLI', 600, 0, 0, 'AGENT', 'DEVELOPER'],
  ['BRD/02819', '2026-07-28', 'GJ06AY4675', 'BRD/06748', 'GACL RANOLI', 'MAKARPURA', 350, 0, 0, 'AGENT', 'DEVELOPER'],
  ['BRD/00017', '2026-07-27', 'GJ06BT9525', 'BRD/06744', 'NANDESARI', 'ANKLESHWAR', 20000, 18000, 2000, 'AGENT', 'DEVELOPER'],
  ['BRD/00016', '2026-07-29', 'GJ27TF9204', 'BRD/06750', 'GACL RANOLI', 'DENORA GOA', 40000, 38000, 2000, 'AGENT', 'DEVELOPER'],
  ['BRD/00015', '2025-11-05', 'GJ01DV2129', 'BRD/06179', 'BEAWER', 'BAKROL', 16000, 13000, 3000, 'AGENT', 'DEVELOPER'],
  ['BRD/00014', '2025-10-28', 'GJ 06 AY 4675', 'BRD/06166', 'GACL RANOLI', 'DAHEJ BHARUCH', 1700, 700, 0, 'AGENT', 'DEVELOPER'],
  ['BRD/00013', '2025-10-15', 'GJ16AW-0776', 'BRD/06148', 'NANDESARI', 'GACL RANOLI', 5000, 5000, 0, 'AGENT', 'DEVELOPER'],
  ['BRD/00012', '2025-10-15', 'GJ06AX8637', 'BRD/06147', 'RANOLI GIDC', 'GACL RANOLI', 900, 900, 900, 'AGENT', 'DEVELOPER'],
  ['BRD/00011', '2025-10-09', 'GJ03AX9201', 'BRD/06135', 'DAHEJ', 'RAJPUR (CHATRAL)', 10500, 10000, 10500, 'AGENT', 'DEVELOPER'],
  ['BRD/00010', '2025-08-06', 'GJ07YZ8661', 'BRD/06065', 'RAJKOT', 'BARODA', 18500, 0, 18500, 'AGENT', 'DEVELOPER'],
  ['BRD/00009', '2025-07-29', 'GJ07YZ8661', 'BRD/06056', 'BARODA', 'RAJKOT', 18500, 0, 18500, 'AGENT', 'DEVELOPER'],
  ['BRD/00008', '2025-07-23', 'GJ07YZ8661', 'BRD/06046', 'BARODA', 'RAJKOT', 18500, 0, 18500, 'AGENT', 'DEVELOPER'],
  ['BRD/00007', '2025-07-18', 'GJ07YZ8661', 'BRD/06038', 'BARODA', 'RAJKOT', 18500, 0, 18500, 'AGENT', 'DEVELOPER'],
  ['BRD/00006', '2025-07-14', 'GJ07YZ8661', 'BRD/06029', 'BARODA', 'RAJKOT', 18500, 0, 18500, 'AGENT', 'DEVELOPER'],
  ['BRD/00005', '2025-07-07', 'GJ-06-BX-7185', 'BRD/06022', 'MANJUSAR BARODA', 'DAHEJ BHARUCH', 9000, 0, 9000, 'AGENT', 'DEVELOPER'],
  ['BRD/00004', '2025-07-02', 'GJ07YZ8661', 'BRD/06014', 'BARODA', 'RAJKOT', 18500, 0, 18500, 'AGENT', 'DEVELOPER'],
  ['BRD/00003', '2025-06-26', 'GJ07YZ8661', 'BRD/06008', 'BARODA', 'RAJKOT', 18500, 0, 18500, 'AGENT', 'DEVELOPER'],
  ['BRD/00002', '2025-06-23', 'GJ07YZ8661', 'BRD/06004', 'BARODA', 'RAJKOT', 18500, 0, 18500, 'AGENT', 'DEVELOPER'],
  ['BRD/00001', '2025-06-19', 'GJ7YZ8661', 'BRD/05996', 'BARODA', 'RAJKOT', 18500, 0, 0, 'AGENT', 'DEVELOPER']
];

/* Dedupes by LHC No — safe to re-run. Reconciles Lorry Hire/Advance against
   the source's own Balance via a single labeled addition or deduction line
   (see the doc comment above LEGACY_LHC_TRIPS) so this module's normal
   computeLhcTrip() reproduces ATTrans's displayed balance exactly. */
export function importLegacyLhcTrips(db){
  db.lhcTrips = db.lhcTrips || [];
  const have = {};
  db.lhcTrips.forEach(t => { if (t.lhcNo) have[t.lhcNo] = true; });
  let added = 0;
  LEGACY_LHC_TRIPS.forEach(([lhcNo, date, truckNo, lrNo, fromPlace, toPlace, lorryHire, advance, balance, payTo, createdBy]) => {
    if (have[lhcNo]) return;
    have[lhcNo] = true;
    const expected = Math.round((lorryHire - advance) * 100) / 100;
    const gap = Math.round((balance - expected) * 100) / 100;
    const additions = [], deductions = [];
    if (gap > 0.005) additions.push({ id: uid('lp'), type: 'BALANCE ADJUSTMENT (from import)', amount: gap });
    else if (gap < -0.005) deductions.push({ id: uid('lp'), type: 'BALANCE ADJUSTMENT (from import)', amount: -gap });
    const trip = {
      id: uid('lht'), lhcNo, date, truckNo, fromPlace, toPlace,
      lines: [{ id: uid('ltl'), lrId: '', lrNo, date: '', content: '', pkgs: '', weight: '' }],
      agent: '', lorryType: '', chasisNo: '', engineNo: '', permitNo: '', insuranceCo: '', branch: '', policyNo: '',
      permitFrom: '', permitUpto: '', insuranceUpto: '',
      driverName: '', driverAddress: '', driverLicNo: '', driverLicDate: '', driverIssuedFrom: '', driverMobile: '',
      ownerName: '', ownerAddress: '', ownerPan: '', ownerMobile: '',
      lorryHire, advance, additions, deductions, payTo,
      expenses: [],
      imageUri: '',
      createdBy, createdAt: new Date().toISOString()
    };
    const t = computeLhcTrip(trip);
    trip.totalAddition = t.totalAddition; trip.totalDeduction = t.totalDeduction; trip.totalExpense = t.totalExpense;
    trip.netAmount = t.netAmount; trip.balanceAmount = t.balanceAmount;
    db.lhcTrips.push(trip);
    added++;
  });
  return added;
}

/* ---------- LHC Balance Payment — a NEW module mirroring ATTrans's own
   "VIEW LHC BALANCE PAYMENT DETAILS" / "ADD NEW LHC BALANCE PAYMENT"
   screens (screenshots dated 2026-08-27). Records payments made against an
   LHC trip (db.lhcTrips above) — its own ledger, db.lhcPayments, each row
   pointing at one lhcTripId. The Add form lets a user page through every
   LHC trip at once (with Owner/Agent/LHC No filters) and enter a Pending-
   reducing "Adjust" amount per row in a single batch; each non-zero row
   becomes one db.lhcPayments record here.

   Paid / Pending formula: PAID(trip) = sum of db.lhcPayments amounts for
   that trip; PENDING(trip) = trip.lorryHire − PAID(trip). This is a
   straightforward running-ledger definition chosen because it's internally
   consistent, not because it was confirmed against ATTrans's own internal
   logic — see the FLAGGED note below on why the source data doesn't let it
   be verified precisely.

   FLAGGED, not silently fixed:
   - The 24-row "VIEW LHC BALANCE PAYMENT DETAILS" register has several
     literal, unexplained duplicate rows for the very same LHC (BRD/02827
     appears 4 times, BRD/02829/02828/02826/02821/02822/02823/02820/00017
     each appear twice) — same date, same amount, same agent, every time.
     Transcribed as-is (not de-duplicated), on the assumption a real
     register shouldn't be silently trimmed, but this is very likely a
     data-entry artifact (e.g. a double-submitted form) in ATTrans itself.
   - The imported AMOUNT values do not cleanly reconcile against each LHC
     trip's own `advance` field: some match exactly (BRD/00016, BRD/00017,
     BRD/02825, BRD/02823, BRD/02822, BRD/02821), some are exactly double
     the trip's advance (BRD/02829/02828/02827/02826, each 34000 vs a
     17000 advance), and two (BRD/02820, BRD/02819) show 950 despite an
     advance of 0. This looks like real payments may have been split or
     batched across multiple LHCs in a way this list view doesn't fully
     disambiguate — rather than guess a redistribution, every row is
     imported with its literal AMOUNT, unmodified.
   - OWNER NAME is blank for all 24 rows in the source register — imported
     as blank, not guessed.
   - Where an LHC trip's own `agent` field is still blank (Bill/LHC import
     doesn't carry an agent name), importLegacyLhcPayments() backfills it
     from this register's AGENT NAME column — real given data, not a
     guess — matched case-insensitively against LHC_AGENTS so the Agent
     dropdown on that trip's Add/Edit form highlights correctly; falls
     back to the literal source string if no LHC_AGENTS entry matches.
   - The Add form's own header "LHC NO*: 00018" field doesn't match any real
     "BRD/xxxxx" LHC number, so it's treated as this payment voucher's OWN
     auto-incrementing document number (blankLhcPayment().voucherNo,
     counter db.seq.lhcPay) — analogous to Bill's Invoice No — not a
     reference to a specific LHC trip. The 24-row View list doesn't expose
     this per-row, so all imported legacy rows get voucherNo: ''.
   Row shape: [srNo, lhcNo, date(ISO), ownerName, agentName, payTo, amount,
   createdBy]. */
export function blankLhcPayment(){
  return {
    id: '', voucherNo: '', lhcTripId: '', lhcNo: '', date: todayISO(), ownerName: '', agentName: '',
    payTo: 'AGENT', amount: '', otherAdd: '', otherLess: '', paymentType: 'ADVANCE',
    mode: '', cashAmount: '', bankAmount: '', name: '',
    createdBy: '', createdAt: ''
  };
}
export function lhcPaymentsFor(payments, tripId){ return (payments || []).filter(p => p.lhcTripId === tripId); }
export function lhcPaidTotal(payments, tripId){ return lhcPaymentsFor(payments, tripId).reduce((sum, p) => sum + (Number(p.amount) || 0), 0); }
export function lhcPendingAmount(trip, payments){ return (Number(trip.lorryHire) || 0) - lhcPaidTotal(payments, trip.id); }

export const LEGACY_LHC_PAYMENTS = [
  [1, 'BRD/02829', '2026-08-14', '', 'USMAN BHAI', 'AGENT', 34000, 'DEVELOPER'],
  [2, 'BRD/02829', '2026-08-14', '', 'USMAN BHAI', 'AGENT', 34000, 'DEVELOPER'],
  [3, 'BRD/02828', '2026-08-12', '', 'USMAN BHAI', 'AGENT', 34000, 'DEVELOPER'],
  [4, 'BRD/02828', '2026-08-12', '', 'USMAN BHAI', 'AGENT', 34000, 'DEVELOPER'],
  [5, 'BRD/02827', '2026-08-10', '', 'USMAN BHAI', 'AGENT', 34000, 'DEVELOPER'],
  [6, 'BRD/02827', '2026-08-10', '', 'USMAN BHAI', 'AGENT', 34000, 'DEVELOPER'],
  [7, 'BRD/02827', '2026-08-10', '', 'USMAN BHAI', 'AGENT', 34000, 'DEVELOPER'],
  [8, 'BRD/02827', '2026-08-10', '', 'USMAN BHAI', 'AGENT', 34000, 'DEVELOPER'],
  [9, 'BRD/02826', '2026-08-08', '', 'USMAN BHAI', 'AGENT', 34000, 'DEVELOPER'],
  [10, 'BRD/02826', '2026-08-08', '', 'USMAN BHAI', 'AGENT', 34000, 'DEVELOPER'],
  [11, 'BRD/02825', '2026-08-06', '', 'USMAN BHAI', 'AGENT', 17000, 'DEVELOPER'],
  [12, 'BRD/02825', '2026-08-06', '', 'USMAN BHAI', 'AGENT', 17000, 'DEVELOPER'],
  [13, 'BRD/02823', '2026-08-03', '', 'USMAN BHAI', 'AGENT', 17000, 'DEVELOPER'],
  [14, 'BRD/02823', '2026-08-03', '', 'USMAN BHAI', 'AGENT', 17000, 'DEVELOPER'],
  [15, 'BRD/02822', '2026-08-01', '', 'USMAN BHAI', 'AGENT', 17000, 'DEVELOPER'],
  [16, 'BRD/02822', '2026-08-01', '', 'USMAN BHAI', 'AGENT', 17000, 'DEVELOPER'],
  [17, 'BRD/02821', '2026-07-30', '', 'USMAN BHAI', 'AGENT', 17000, 'DEVELOPER'],
  [18, 'BRD/02821', '2026-07-30', '', 'USMAN BHAI', 'AGENT', 17000, 'DEVELOPER'],
  [19, 'BRD/02820', '2026-07-30', '', 'MR. MOHAN BARIA', 'AGENT', 950, 'DEVELOPER'],
  [20, 'BRD/02820', '2026-07-30', '', 'MR. MOHAN BARIA', 'AGENT', 950, 'DEVELOPER'],
  [21, 'BRD/02819', '2026-07-28', '', 'MR. MOHAN BARIA', 'AGENT', 950, 'DEVELOPER'],
  [22, 'BRD/00017', '2026-07-27', '', 'USMAN BHAI', 'AGENT', 18000, 'DEVELOPER'],
  [23, 'BRD/00017', '2026-07-27', '', 'USMAN BHAI', 'AGENT', 18000, 'DEVELOPER'],
  [24, 'BRD/00016', '2026-07-29', '', 'AKSHAR ROADLINES', 'AGENT', 38000, 'DEVELOPER']
];

/* Dedupes by SR NO (not by content — several rows are legitimate-looking
   duplicates in the source register, see the doc comment above). Skips a
   row if its LHC No isn't in db.lhcTrips yet (import Masters -> the LHC
   register first, same pattern as importLegacyBills's vendor-not-found
   skip). */
export function importLegacyLhcPayments(db){
  db.lhcPayments = db.lhcPayments || [];
  const have = {};
  db.lhcPayments.forEach(p => { if (p.srNo != null) have[p.srNo] = true; });
  const tripByLhcNo = {};
  (db.lhcTrips || []).forEach(t => { tripByLhcNo[t.lhcNo] = t; });
  const agentByLower = {};
  LHC_AGENTS.forEach(a => { agentByLower[a.trim().toLowerCase()] = a; });
  let added = 0, skippedNoTrip = 0;
  LEGACY_LHC_PAYMENTS.forEach(([srNo, lhcNo, date, ownerName, agentName, payTo, amount, createdBy]) => {
    if (have[srNo]) return;
    const trip = tripByLhcNo[lhcNo];
    if (!trip) { skippedNoTrip++; return; }
    have[srNo] = true;
    if (!trip.agent) trip.agent = agentByLower[agentName.trim().toLowerCase()] || agentName;
    db.lhcPayments.push({
      id: uid('lhp'), voucherNo: '', srNo, lhcTripId: trip.id, lhcNo, date, ownerName, agentName, payTo,
      amount, otherAdd: 0, otherLess: 0, paymentType: 'ADVANCE', mode: '', cashAmount: '', bankAmount: '', name: '',
      createdBy, createdAt: new Date().toISOString()
    });
    added++;
  });
  return { added, skippedNoTrip };
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
    expenses: [], remark: '', employee: '', driverNo: '', preparedBy: '', transportMode: 'ROAD',
    charges: { abovePct: '', aboveCh: '', belowPct: '', belowCh: '', rate: '', rateCh: '', freight: '', surcharge: '', localCartage: '', lastMile: '', fov: '', loading: '', unloading: '', handling: '', gc: '', other: '', ewayCh: '', aoc: '' },
    igstPct: '', cgstPct: '', sgstPct: '',
    subTotal: 0, igstAmt: 0, cgstAmt: 0, sgstAmt: 0, gross: 0, pod: false,
    ownership: 'Owned', vehicleId: '',
    hire: { vendorId: '', amount: '', advance: '', payments: [] },
    tripExpenses: []
  };
}

/* ---------- LR register — ATTrans's own "LR / Consignment Notes" list view
   (42 rows across 3 screenshots dated 2026-08-28) — a standalone import into
   this app's OWN db.lrs, same standalone-master pattern as the LHC/Bill/Tax
   Master imports above.

   This register is a summary LIST view, not the detailed "ADD NEW LR" form,
   so it only gives: LR No, Date, Truck No, From, To, Consignor, Consignee, an
   Agent column (blank for all rows except one), and a single lump-sum Amount
   — no goods/package description, no GST breakdown, no consignor/consignee
   address/GSTIN. Rather than invent any of that, each imported LR is built
   with: goods left empty (flagged, not fabricated), GST% left at 0, and the
   Amount posted as the sole "Freight" charge line — since computeLR() with
   0% GST makes gross === subTotal === that Freight line exactly, this
   reproduces the register's Amount column exactly with NO reconciliation
   fudge-factor needed (unlike the Bill/LHC imports, where the source total
   didn't cleanly decompose and a labeled adjustment line was needed).

   FLAGGED, not silently fixed:
   - LR No BRD/06802 is missing from the sequence (jumps 06803 -> 06801) —
     a genuine gap in ATTrans's own numbering, not a transcription error.
   - SR 6 (BRD/06823) and SR 14 (BRD/06815) were shown highlighted (pink) in
     the source register — some status/flag ATTrans itself was tracking that
     isn't decodable from a list screenshot alone. Imported like any other
     row; not marked cancelled/duplicate without evidence of what the color
     actually meant.
   - Both "Created By" columns in the source show "DEVELOPER" for every row
     (evident placeholder/test authorship data, same as prior imports) — this
     app's LR record has no createdBy field at all, so it isn't carried in.
   - Every row is assigned to this app's main branch (db.branches[0]) and
     lrType 'ORIGINAL' with blankLR()'s other defaults (GST Exempt (RCM),
     Door Delivery, etc.) since the register doesn't expose those per row.
   Row shape: [srNo, lrNo, date(ISO), truckNo, fromPlace, toPlace,
   consignorName, consigneeName, agent, amount]. */
export const LEGACY_LRS = [
  [1, 'BRD/06828', '2026-08-28', '', 'NTPC JHANOR', 'GACL RANOLI', 'NTPC', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 0],
  [2, 'BRD/06827', '2026-08-27', '', 'GACL RANOLI', 'NTPC JHANOR', 'GUJARAT ALKALIES & CHEMICALS LTD', 'NTPC', '', 0],
  [3, 'BRD/06826', '2026-08-26', 'GJ06BY1577', 'DASHRATH', 'GACL RANOLI', 'ASSOCIATED ROAD CARRIERS LIMITED', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 1541.15],
  [4, 'BRD/06825', '2026-08-27', 'GJ07YZ8661', 'RAJKOT', 'BARODA', 'RAJKOT MUNICIPAL CORPORATION', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 0],
  [5, 'BRD/06824', '2026-08-26', 'GJ07YZ8661', 'BARODA', 'RAJKOT', 'GUJARAT ALKALIES & CHEMICALS LTD', 'RAJKOT MUNICIPAL CORPORATION', '', 0],
  [6, 'BRD/06823', '2026-08-25', 'GJ07YZ8661', 'GACL RANOLI', 'GACL COELHO PLANT', 'GUJARAT ALKALIES & CHEMICALS LTD', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 3302.47],
  [7, 'BRD/06822', '2026-08-26', 'GJ 34 T 2262', 'RAJKOT', 'BARODA', 'RAJKOT MUNICIPAL CORPORATION', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 0],
  [8, 'BRD/06821', '2026-08-25', 'GJ 34 T 2262', 'BARODA', 'RAJKOT', 'GUJARAT ALKALIES & CHEMICALS LTD', 'RAJKOT MUNICIPAL CORPORATION', '', 0],
  [9, 'BRD/06820', '2026-08-24', 'GJ 34 T 2262', 'RAJKOT', 'BARODA', 'RAJKOT MUNICIPAL CORPORATION', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 22261.00],
  [10, 'BRD/06819', '2026-08-23', 'GJ 34 T 2262', 'BARODA', 'RAJKOT', 'GUJARAT ALKALIES & CHEMICALS LTD', 'RAJKOT MUNICIPAL CORPORATION', '', 22261.00],
  [11, 'BRD/06818', '2026-08-23', 'GJ06AT6590', 'RAJKOT', 'BARODA', 'RAJKOT MUNICIPAL CORPORATION', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 22261.00],
  [12, 'BRD/06817', '2026-08-22', 'GJ06AT6590', 'BARODA', 'RAJKOT', 'GUJARAT ALKALIES & CHEMICALS LTD', 'RAJKOT MUNICIPAL CORPORATION', '', 22261.00],
  [13, 'BRD/06816', '2026-08-22', 'GJ 34 T 2262', 'RAJKOT', 'BARODA', 'RAJKOT MUNICIPAL CORPORATION', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 22261.00],
  [14, 'BRD/06815', '2026-08-21', 'GJ 34 T 2262', 'BARODA', 'RAJKOT', 'GUJARAT ALKALIES & CHEMICALS LTD', 'RAJKOT MUNICIPAL CORPORATION', '', 22261.00],
  [15, 'BRD/06814', '2026-08-20', 'GJ06BY1577', 'MAKARPURA', 'GACL RANOLI', 'VRUND ENGITECH PRIVATE LIMITED', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 2421.81],
  [16, 'BRD/06813', '2026-08-19', 'GJ06BY1577', 'GACL RANOLI', 'RANOLI', 'GUJARAT ALKALIES & CHEMICALS LTD', 'M/S CONTINENTAL VALVES LIMITED C/O ACPL TRANSPORT', '', 1541.15],
  [17, 'BRD/06812', '2026-08-19', 'GJ06BY1577', 'DASHRATH', 'GACL RANOLI', 'LALJI MULJI TRANSPORT CO', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 1541.15],
  [18, 'BRD/06811', '2026-08-19', 'GJ06BY1577', 'DASHRATH', 'GACL RANOLI', 'SURAT AHMEDABAD TRANSPORT PVT LTD', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 1541.15],
  [19, 'BRD/06810', '2026-08-21', 'GJ06AT6590', 'RAJKOT', 'BARODA', 'RAJKOT MUNICIPAL CORPORATION', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 22261.00],
  [20, 'BRD/06809', '2026-08-20', 'GJ06AT6590', 'BARODA', 'RAJKOT', 'GUJARAT ALKALIES & CHEMICALS LTD', 'RAJKOT MUNICIPAL CORPORATION', '', 22261.00],
  [21, 'BRD/06808', '2026-08-17', 'GJ 34 T 2262', 'GACL COELHO PLANT', 'GACL RANOLI', 'GUJARAT ALKALIES & CHEMICALS LTD', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 3302.47],
  [22, 'BRD/06807', '2026-08-19', 'GJ 34 T 2262', 'RAJKOT', 'BARODA', 'RAJKOT MUNICIPAL CORPORATION', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 22261.00],
  [23, 'BRD/06806', '2026-08-18', 'GJ 34 T 2262', 'BARODA', 'RAJKOT', 'GUJARAT ALKALIES & CHEMICALS LTD', 'RAJKOT MUNICIPAL CORPORATION', '', 22261.00],
  [24, 'BRD/06805', '2026-08-17', 'GJ 06 AY 4675', 'NANDESARI', 'GACL RANOLI', 'SHREE RAM RUBTECH PVT LTD', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 1541.15],
  [25, 'BRD/06804', '2026-08-17', 'GJ06BT9525', 'NANDESARI', 'ANKLESHWAR', 'DEEPAK NITRITE LIMITED', 'AMAL LIMITED', '', 12708.60],
  [26, 'BRD/06803', '2026-08-15', 'GJ06BT9525', 'ANKLESHWAR', 'NANDESARI', 'AMAL LIMITED', 'DEEPAK NITRITE LIMITED', '', 31777.40],
  [27, 'BRD/06801', '2026-08-14', 'GJ06BT9525', 'NANDESARI', 'ANKLESHWAR', 'DEEPAK NITRITE LIMITED', 'AMAL LIMITED', '', 10770.00],
  [28, 'BRD/06800', '2026-08-16', 'GJ19X6890', 'RAJKOT', 'BARODA', 'RAJKOT MUNICIPAL CORPORATION', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 22261.00],
  [29, 'BRD/06799', '2026-08-15', 'GJ19X6890', 'BARODA', 'RAJKOT', 'GUJARAT ALKALIES & CHEMICALS LTD', 'RAJKOT MUNICIPAL CORPORATION', '', 22261.00],
  [30, 'BRD/06798', '2026-08-13', 'GJ06BT9525', 'ANKLESHWAR', 'NANDESARI', 'AMAL LIMITED', 'DEEPAK NITRITE LIMITED', '', 31777.40],
  [31, 'BRD/06797', '2026-08-12', 'GJ06BT9525', 'NANDESARI', 'ANKLESHWAR', 'DEEPAK NITRITE LIMITED', 'AMAL LIMITED', '', 12708.60],
  [32, 'BRD/06796', '2026-08-13', '', 'RAJKOT', 'BARODA', 'RAJKOT MUNICIPAL CORPORATION', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 22261.00],
  [33, 'BRD/06795', '2026-08-12', '', 'BARODA', 'RAJKOT', 'GUJARAT ALKALIES & CHEMICALS LTD', 'RAJKOT MUNICIPAL CORPORATION', '', 22261.00],
  [34, 'BRD/06794', '2026-08-13', '', 'RAJKOT', 'BARODA', 'RAJKOT MUNICIPAL CORPORATION', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 22261.00],
  [35, 'BRD/06793', '2026-08-12', '', 'BARODA', 'RAJKOT', 'GUJARAT ALKALIES & CHEMICALS LTD', 'RAJKOT MUNICIPAL CORPORATION', '', 22261.00],
  [36, 'BRD/06792', '2026-08-11', 'GJ06BY1577', 'MAKARPURA', 'GACL RANOLI', 'SHIV INDUSTRIES', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 1981.48],
  [37, 'BRD/06791', '2026-08-11', 'GJ06BT9525', 'ANKLESHWAR', 'NANDESARI', 'AMAL LIMITED', 'DEEPAK NITRITE LIMITED', '', 31777.40],
  [38, 'BRD/06790', '2026-08-10', 'GJ06BT9525', 'NANDESARI', 'ANKLESHWAR', 'DEEPAK NITRITE LIMITED', 'AMAL LIMITED', '', 12708.60],
  [39, 'BRD/06789', '2026-08-12', 'GJ 34 T 2262', 'RAJKOT', 'BARODA', 'RAJKOT MUNICIPAL CORPORATION', 'GUJARAT ALKALIES & CHEMICALS LTD', '', 22261.00],
  [40, 'BRD/06788', '2026-08-11', 'GJ 34 T 2262', 'BARODA', 'RAJKOT', 'GUJARAT ALKALIES & CHEMICALS LTD', 'RAJKOT MUNICIPAL CORPORATION', '', 22261.00],
  [41, 'BRD/06787', '2026-08-10', 'GJ06BY1577', 'GACL RANOLI', 'AHMEDABAD', 'GUJARAT ALKALIES & CHEMICALS LTD', 'AIR POWER SERVICES', '', 3302.47],
  [42, 'BRD/06786', '2026-08-09', 'GJ06BT9525', 'ANKLESHWAR', 'NANDESARI', 'AMAL LIMITED', 'DEEPAK NITRITE LIMITED', 'USMAN BHAI', 31777.40]
];

export function importLegacyLRs(db){
  db.lrs = db.lrs || [];
  ensureBranches(db);
  const have = {};
  db.lrs.forEach(l => { if (l.lrNo) have[l.lrNo] = true; });
  const mainBranch = db.branches[0] || {};
  let added = 0;
  LEGACY_LRS.forEach(([srNo, lrNo, date, truckNo, fromPlace, toPlace, consignorName, consigneeName, agent, amount]) => {
    if (have[lrNo]) return;
    have[lrNo] = true;
    const lr = blankLR();
    lr.id = uid('lr');
    lr.lrNo = lrNo; lr.date = date; lr.truckNo = truckNo; lr.fromPlace = fromPlace; lr.toPlace = toPlace;
    lr.branchId = mainBranch.id || ''; lr.bookingBranch = mainBranch.name || lr.bookingBranch;
    lr.consignor = { name: consignorName, city: '', contact: '', pan: '', gst: '' };
    lr.consignee = { name: consigneeName, city: '', contact: '', pan: '', gst: '' };
    lr.agent = agent || '';
    lr.charges.freight = String(amount);
    const t = computeLR(lr.charges, lr.igstPct, lr.cgstPct, lr.sgstPct);
    lr.subTotal = t.subTotal; lr.igstAmt = t.igstAmt; lr.cgstAmt = t.cgstAmt; lr.sgstAmt = t.sgstAmt; lr.gross = t.gross;
    db.lrs.push(lr);
    added++;
  });
  return added;
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
  if (!db.vendorDirectory) db.vendorDirectory = [];
  if (!db.bills) db.bills = [];
  if (!db.taxMaster) db.taxMaster = [];
  if (!db.accountGroups) db.accountGroups = [];
  if (!db.accounts) db.accounts = [];
  if (!db.lhcTrips) db.lhcTrips = [];
  if (!db.lhcPayments) db.lhcPayments = [];
  if (db.company && db.company.panNo === undefined) db.company.panNo = '';
  if (db.company && db.company.website === undefined) db.company.website = '';
  (db.branches || []).forEach(b => { if (b.panNo === undefined) b.panNo = ''; });
  (db.lrs || []).forEach(l => { if (l.transportMode === undefined) l.transportMode = 'ROAD'; });
  db.clients.forEach(c => { if (c.creditLimit === undefined) c.creditLimit = 0; });
  ensureBillingBackup(db);
  if (!db.seq.lhc) db.seq.lhc = 1;
  if (!db.seq.inq) db.seq.inq = 1;
  if (!db.seq.mr) db.seq.mr = 1;
  if (!db.seq.lhcPay) db.seq.lhcPay = 1;
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
  employee:'employee', driverno:'driverNo', truckdriverno:'driverNo', preparedby:'preparedBy', mode:'transportMode', transportmode:'transportMode', privatemark:'privateMark',
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
      remark: o.remark || '', employee: o.employee || '', driverNo: o.driverNo || '', preparedBy: o.preparedBy || '', transportMode: o.transportMode || 'ROAD',
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
/* Inline SVG QR code, built with the qrcode-generator library (pure JS, no
   network/image request needed — the whole thing is just <rect> tags, so it
   prints identically on native (expo-print) and web with zero extra assets).
   text: the string to encode (kept short — LR No + company name); size: px.
   Falls back to a blank bordered box if the text is empty or encoding fails
   (e.g. text too long for the smallest QR version), never throws. */
function qrSvg(text, size){
  size = size || 84;
  if (!text) return '<div style="width:' + size + 'px;height:' + size + 'px;border:1px dashed #a1a1aa"></div>';
  try {
    const qr = qrcode(0, 'M');
    qr.addData(String(text));
    qr.make();
    const n = qr.getModuleCount();
    const cell = size / n;
    let rects = '';
    for (let r = 0; r < n; r++){
      for (let c = 0; c < n; c++){
        if (qr.isDark(r, c)) rects += '<rect x="' + (c * cell).toFixed(2) + '" y="' + (r * cell).toFixed(2) + '" width="' + cell.toFixed(2) + '" height="' + cell.toFixed(2) + '"/>';
      }
    }
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" xmlns="http://www.w3.org/2000/svg" style="background:#fff;fill:#111">' + rects + '</svg>';
  } catch (e) {
    return '<div style="width:' + size + 'px;height:' + size + 'px;border:1px dashed #a1a1aa"></div>';
  }
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
    + '.head{background:#2b2b2f;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;border-top:3px solid #f6d048}'
    + '.head .brand{display:flex;gap:20px;align-items:center;flex:1.4;min-width:200px}'
    + '.head h1{margin:0;font-size:16px;letter-spacing:.2px}.head p{margin:3px 0 0;font-size:9px;color:#d4d4d8}'
    + '.headCol{flex:1;min-width:130px;font-size:10px;line-height:1.5}'
    + '.headCol.mid{border-left:1px solid rgba(255,255,255,.25);border-right:1px solid rgba(255,255,255,.25);padding:0 14px}'
    + '.headCol.right{flex:0 0 auto;text-align:center}'
    + '.tag{margin:0 0 4px;font-size:8.5px;letter-spacing:.5px;text-transform:uppercase;color:#f6d048;font-weight:800}'
    + '.headCol b.big{color:#f6d048;font-size:14px}'
    + '.num{text-align:right;font-size:11px;line-height:1.5;white-space:nowrap}.num b{color:#f6d048;font-size:15px}'
    + 'table{width:100%;border-collapse:collapse}'
    + 'td,th{border:1px solid #d4d4d8;padding:6px 8px;font-size:10.8px;text-align:left;vertical-align:top}'
    + 'th{background:#ececed;font-size:9.5px;text-transform:uppercase;letter-spacing:.3px;color:#302f33}'
    + '.sig{height:60px}'
    + '.totalsTbl td{border-color:#a1a1aa}'
    + '.grossRow td{background:#fbe9de;font-size:13px}'
    + '.terms{font-size:8.5px;color:#555;padding:9px 12px;border-top:1px solid #a1a1aa;background:#f7f7f7}'
    + '.pageFooter{font-size:8.5px;color:#a1a1aa;font-style:italic;text-align:center;padding:6px 0}'
    + '.sealBox{width:70px;height:70px;border:1px dashed #a1a1aa;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:7.5px;color:#a1a1aa;margin:6px auto 0;padding:4px}'
    + '.sectionNote{font-size:8.5px;color:#71717a;padding:4px 8px}'
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
    + '<div class="head"><div class="brand">' + bgtsLogoImg(logoUri, 52) + '<div><h1>' + esc(co.name) + '</h1><p>' + esc(co.addr) + (co.gstin ? ' · GSTIN: ' + esc(co.gstin) : '') + '</p><p>MONEY RECEIPT</p></div></div>'
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
/* Field/label parity note: this mirrors, field-for-field and label-for-label,
   the reference printed LR format (white "GC NO." style consignment note),
   restyled in BGTS-OS's own dark-navy/yellow brand rather than the
   reference's plain black-and-white grid — same content, new look. A few
   labels (e.g. "Billed To (Service Reciever)") keep the reference's exact
   wording, typo included, since matching the label text exactly was the
   point. Fields this app already tracked that AREN'T in the reference
   (Booking/To Branch, Lorry Type, Employee, Truck Driver No, Inv./E-Way
   sub-dates, Packing, Agent, To Be Billed At) are kept as an additional
   "extra details" block near the bottom rather than dropped, so nothing
   already useful is lost. Two flagged simplifications: (1) Consignor/
   Consignee/Billed To only carry name/city/phone/GSTIN/PAN today — the
   reference's full multi-line street address isn't a field this app's
   party forms collect yet; (2) "GC No." reuses this app's own LR numbering
   (Company Settings → LR Number Prefix), not the reference sample's literal
   numbering scheme, since changing the live numbering convention wasn't
   asked for. */
export function lrHtml(db, l, logoUri){
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const br = byId(db.branches || [], l.branchId) || {};
  const co = {
    name: br.entityName || db.company.name, addr: br.addr || db.company.addr, gstin: br.gstin || db.company.gstin,
    panNo: br.panNo || db.company.panNo, phone: br.phone || db.company.phone,
    email: db.company.email, website: db.company.website
  };
  const party = p => {
    p = p || {};
    let s = '<b>' + esc(p.name || '—') + '</b>';
    if (p.city) s += '<br>' + esc(p.city);
    if (p.contact) s += '<br>Ph: ' + esc(p.contact);
    if (p.gst) s += '<br>GSTIN : ' + esc(p.gst);
    if (p.pan) s += '<br>PAN : ' + esc(p.pan);
    return s;
  };
  const dims = g => (g.l || g.w || g.h) ? esc((g.l || '—') + ' × ' + (g.w || '—') + ' × ' + (g.h || '—')) : '—';
  let goodsRows = '', pkgsTotal = 0;
  (l.goods || []).forEach(g => {
    pkgsTotal += Number(g.pcs) || 0;
    const content = esc(g.desc || '—') + (g.pkgType && g.pkgType !== 'OTHER' ? ' <span class="muted">(' + esc(g.pkgType) + ')</span>' : '');
    goodsRows += '<tr><td class="r">' + esc(g.pcs || '—') + '</td><td>' + content + '</td><td class="r">' + esc(g.aw || '—') + '</td><td class="r">' + esc(g.cw || '—') + '</td><td class="r">' + dims(g) + '</td></tr>';
  });
  if (!goodsRows) goodsRows = '<tr><td colspan="5" class="muted">No goods rows recorded.</td></tr>';
  const ch = l.charges || {};
  /* Every fixed charge category always prints (even at 0.00) to match the
     reference's fixed ledger layout, instead of only showing nonzero lines.
     Above%/Below%/Rate are this app's own extras (not in the reference), so
     those stay conditional — only shown when actually used on this LR. */
  let chg = '';
  if (Number(ch.aboveCh)) chg += '<tr><td>Above ' + esc(ch.abovePct || '') + '%</td><td class="r">' + inr(ch.aboveCh) + '</td></tr>';
  if (Number(ch.belowCh)) chg += '<tr><td>Below ' + esc(ch.belowPct || '') + '%</td><td class="r">' + inr(ch.belowCh) + '</td></tr>';
  if (Number(ch.rateCh)) chg += '<tr><td>Rate Charge</td><td class="r">' + inr(ch.rateCh) + '</td></tr>';
  LR_CHG.filter(c => c[0] !== 'rateCh').forEach(c => { chg += '<tr><td>' + c[1] + '</td><td class="r">' + inr(ch[c[0]] || 0) + '</td></tr>'; });
  const qr = qrSvg(l.lrNo + ' | ' + co.name + (co.website ? ' | ' + co.website : ''), 56);

  return '<html><head><meta charset="utf-8"><title>LR ' + esc(l.lrNo) + '</title><style>' + printDocStyle()
    + '</style></head><body><div class="doc">'

    /* ---- header: Head Office details / GC No. + Booking Office / At
       Owner's Risk + QR — three columns, same info as the reference's top
       band, restyled dark-navy + yellow instead of plain white. ---- */
    + '<div class="head">'
      + '<div class="brand">' + bgtsLogoImg(logoUri, 58) + '<div><h1>' + esc(co.name) + '</h1>'
        + '<p>Head Office: ' + esc(db.company.addr) + '</p>'
        + '<p>' + (co.phone ? 'Tele: ' + esc(co.phone) : '') + '</p>'
        + '<p>' + (co.email ? 'Email: ' + esc(co.email) : '') + (co.website ? (co.email ? ' · ' : '') + 'Web: ' + esc(co.website) : '') + '</p>'
      + '</div></div>'
      + '<div class="headCol mid">'
        + '<p class="tag">Consignment' + (l.lrType === 'DUMMY' ? ' — DUMMY' : '') + '</p>'
        + '<p>GC No.<br><b class="big">' + esc(l.lrNo) + '</b></p>'
        + '<p>Booking Office :<br>' + esc(l.bookingBranch || co.name) + (br.addr ? '<br>' + esc(br.addr) : '') + '<br>Mob: ' + esc(br.phone || co.phone || 'NA') + '</p>'
      + '</div>'
      + '<div class="headCol right">'
        + '<p class="tag">At Owner\'s Risk</p>'
        + qr
      + '</div>'
    + '</div>'

    /* ---- PAN No / GSTIN / GC Date / Vehicle No / From / To ---- */
    + '<table><tr><th>PAN No</th><th>GSTIN</th><th>GC Date</th><th>Vehicle No.</th><th>From</th><th>To</th></tr>'
    + '<tr><td>' + esc(co.panNo || '—') + '</td><td>' + esc(co.gstin || '—') + '</td><td>' + fmtDate(l.date) + '</td><td><b>' + esc(l.truckNo) + '</b></td><td>' + esc(l.fromPlace) + '</td><td>' + esc(l.toPlace) + '</td></tr></table>'

    /* ---- Consignors / Consignees ---- */
    + '<table><tr><th style="width:50%">Consignors Name &amp; Address</th><th>Consignees Name &amp; Address</th></tr>'
    + '<tr><td>' + party(l.consignor) + '</td><td>' + party(l.consignee) + '</td></tr></table>'

    /* ---- Billed To / Delivery Address ---- */
    + '<table><tr><th style="width:50%">Billed To (Service Reciever)</th><th>Delivery Address</th></tr>'
    + '<tr><td>' + ((l.billingTo && l.billingTo.name) ? party(l.billingTo) : esc(l.billingParty || '—')) + '</td><td>' + (l.deliveryAddress ? esc(l.deliveryAddress) : '—') + '</td></tr></table>'

    /* ---- Invoice No. / Value / E-way Bill No. / Mode / AOC ---- */
    + '<table><tr><th>Invoice No.</th><th>Value</th><th>E-way Bill No.</th><th>Mode</th><th>AOC</th></tr>'
    + '<tr><td>' + esc(l.invoiceNo || '—') + '</td><td>' + (l.invAmount ? inr(l.invAmount) : '—') + '</td><td>' + esc(l.ewayBillNo || '—') + '</td><td>' + esc(l.transportMode || 'ROAD') + '</td><td>' + (Number(ch.aoc) ? inr(ch.aoc) : '—') + '</td></tr></table>'

    /* ---- Goods: Pkgs / Content / A Weight / C Weight / Size ---- */
    + '<table><tr><th>Pkgs</th><th>Content</th><th>A Weight</th><th>C Weight</th><th>Size (L × W × H)</th></tr>' + goodsRows
    + '<tr><td class="r"><b>' + pkgsTotal + '</b></td><td></td><td class="r"><b>' + (Number(l.aWeight) || 0).toFixed(2) + '</b></td><td class="r"><b>' + (Number(l.cWeight) || 0).toFixed(2) + '</b></td><td></td></tr></table>'
    + '<table><tr><th>Private Mark</th></tr><tr><td>' + esc(l.privateMark || '—') + '</td></tr></table>'

    /* ---- Freight & Charges — every category always shown, matching the
       reference's fixed ledger rather than hiding zero lines ---- */
    + '<table class="totalsTbl"><tr><th colspan="2">Freight &amp; Charges</th></tr>' + chg
    + '<tr><td class="r"><b>Sub Total</b></td><td class="r"><b>' + inr(l.subTotal) + '</b></td></tr>'
    + '<tr><td class="r">IGST' + (l.igstPct ? ' ' + l.igstPct + '%' : '') + '</td><td class="r">' + inr(l.igstAmt) + '</td></tr>'
    + '<tr><td class="r">CGST' + (l.cgstPct ? ' ' + l.cgstPct + '%' : '') + '</td><td class="r">' + inr(l.cgstAmt) + '</td></tr>'
    + '<tr><td class="r">SGST' + (l.sgstPct ? ' ' + l.sgstPct + '%' : '') + '</td><td class="r">' + inr(l.sgstAmt) + '</td></tr>'
    + '<tr class="grossRow"><td class="r"><b>Total Amount</b></td><td class="r"><b>' + inr(l.gross) + '</b></td></tr></table>'

    /* ---- For, Company (blank seal placeholder — a real stamp/signature is
       applied by hand after printing, not fabricated here) + Prepared By ---- */
    + '<table><tr><th style="width:60%">For, ' + esc(co.name) + '</th><th>Prepared By</th></tr>'
    + '<tr><td style="text-align:center"><div class="sealBox">Company<br>Seal</div></td><td>' + esc(l.preparedBy || '—') + '</td></tr></table>'

    /* ---- Insurance / GST Payable By / Payment Terms ---- */
    + '<table><tr><th>Insurance</th><th>GST Payable By</th><th>Payment Terms</th></tr>'
    + '<tr><td>' + esc(l.insurance || '—') + '</td><td>' + esc(l.gstPaidBy || '—') + '<br><span class="muted">GST Slabs : ' + esc(l.gstSlab || '—') + '</span></td><td><b>' + esc(l.payTerms || '—') + '</b></td></tr></table>'

    /* ---- Delivery At / Remarks ---- */
    + '<table><tr><th style="width:50%">Delivery At</th><th>Remarks</th></tr>'
    + '<tr><td>' + esc(l.lrMode || '—') + '</td><td>' + (l.remark ? esc(l.remark) : '—') + '</td></tr></table>'

    /* ---- extra details this app already tracked, kept beyond the
       reference format rather than dropped ---- */
    + '<table><tr><th>Invoice Date</th><th>E-Way Date</th><th>E-Way Expiry</th><th>P.O. Date</th><th>Packing</th><th>Agent</th><th>To Be Billed At</th></tr>'
    + '<tr><td>' + fmtDate(l.invoiceDate) + '</td><td>' + fmtDate(l.ewayBillDate) + '</td><td>' + fmtDate(l.ewayExDate) + '</td><td>' + fmtDate(l.poDate) + '</td><td>' + esc(l.packing || '—') + '</td><td>' + esc(l.agent || '—') + '</td><td>' + esc(l.billedAt || '—') + '</td></tr></table>'
    + '<table><tr><th>Employee</th><th>Truck Driver No</th><th>Booking Branch</th><th>To Branch</th><th>Lorry Type</th><th style="width:22%">Receiver Signature &amp; Stamp (POD)</th></tr>'
    + '<tr><td>' + esc(l.employee || '—') + '</td><td>' + esc(l.driverNo || '—') + '</td><td>' + esc(l.bookingBranch || '—') + '</td><td>' + esc(l.toBranch || '—') + '</td><td>' + esc(l.lorryType || '—') + '</td><td class="sig"></td></tr></table>'

    + '<div class="terms">Goods are transported at owner\'s risk. Delivery subject to terms &amp; conditions of carriage of ' + esc(co.name) + '. Consignment must be insured by the consignor. Subject to Vadodara jurisdiction. System-generated from BGTS-OS.</div>'
    + '<div class="pageFooter">PAGE 1 OF 1</div>'
    + '</div></body></html>';
}
