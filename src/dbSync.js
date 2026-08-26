/* BGTS-OS <-> Supabase data-access layer.

   This file is the ONLY place that knows how the app's in-memory `db` object
   (see blankDB()/blankLR() in logic.js) maps onto the bgts_os Postgres tables
   (see supabase/migrations/0001_schema.sql). No screen imports this directly —
   store.js is the sole caller, so every screen keeps using useStore()/update()
   exactly as before.

   Two directions:
     - pullDb()     : Supabase -> app db shape (used on load)
     - pushDb(a, b)  : diff(a, b) -> Supabase writes (used on every update())

   Diffing strategy (per requirement: no duplicate records, ever):
     Top-level collections (db.clients, db.bookings, db.lrs, ...) are diffed
     by their own `.id` (the app's uid()-generated string) — changed/new items
     are upserted by id, removed ids are deleted. Re-saving the same record
     always writes to the SAME row because the id never changes.

     Child rows the app itself has no id for (LR goods, LR expense lines,
     contract rate lines, LR trip-expense summaries, LR party rows) use a
     delete-all-for-this-parent-then-reinsert strategy instead — safe because
     they're always rewritten as a whole array by their parent's own screen,
     never independently.

   billing_backup_* is treated as a one-time seed (see seedBillingBackupIfEmpty)
   because the app itself never mutates db.billingBackup after ensureBillingBackup()
   seeds it once in logic.js — there's nothing to diff.
*/
import { supabase } from './supabaseClient';

/* ---------------- generic helpers ---------------- */
async function upsert(table, rows) {
  if (!rows || !rows.length) return;
  const { error } = await supabase.from(table).upsert(rows);
  if (error) throw new Error(table + ': ' + error.message);
}
async function del(table, ids) {
  if (!ids || !ids.length) return;
  const { error } = await supabase.from(table).delete().in('id', ids);
  if (error) throw new Error(table + ': ' + error.message);
}
async function replaceChildren(table, parentCol, parentId, rows) {
  const { error: delErr } = await supabase.from(table).delete().eq(parentCol, parentId);
  if (delErr) throw new Error(table + ': ' + delErr.message);
  if (rows && rows.length) {
    const { error } = await supabase.from(table).insert(rows);
    if (error) throw new Error(table + ': ' + error.message);
  }
}
async function fetchAll(table) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(table + ': ' + error.message);
  return data || [];
}
function byKey(rows, key) {
  const m = {};
  (rows || []).forEach(r => { (m[r[key]] = m[r[key]] || []).push(r); });
  return m;
}
function diffById(oldArr, newArr) {
  const oldMap = {}; (oldArr || []).forEach(x => { if (x && x.id) oldMap[x.id] = x; });
  const newMap = {}; (newArr || []).forEach(x => { if (x && x.id) newMap[x.id] = x; });
  const changed = [];
  Object.keys(newMap).forEach(id => {
    const o = oldMap[id], n = newMap[id];
    if (!o || JSON.stringify(o) !== JSON.stringify(n)) changed.push(n);
  });
  const deletedIds = Object.keys(oldMap).filter(id => !newMap[id]);
  return { changed, deletedIds };
}

/* value coercion helpers — keep these consistent with the nullability rules
   in 0001_schema.sql: FK columns and genuinely optional numeric/date columns
   must get real `null`, not '' (an empty string is not a valid uuid/text FK
   target and Postgres will reject it), everything else mirrors the app's own
   convention of '' / 0 for "no value". */
const s = v => (v == null ? '' : String(v));
const numReq = v => Number(v) || 0;
const numOpt = v => (v === '' || v == null ? null : Number(v));
const dateOpt = v => (v ? v : null);
const fk = v => (v ? v : null);
const bool = v => !!v;

/* ============================================================
   1:1 flat entities — id, table, field map [appKey, dbCol, kind]
   kind: 's' string, 'nr' numeric required, 'no' numeric optional,
         'd' date optional, 'fk' nullable foreign key, 'b' boolean
   ============================================================ */
const FLAT = {
  clients: { table: 'clients', fields: [['name','name','s'],['gstin','gstin','s'],['phone','phone','s'],['email','email','s'],['creditDays','credit_days','nr'],['addr','addr','s'],['creditLimit','credit_limit','nr']] },
  vehicles: { table: 'vehicles', fields: [
    ['regNo','reg_no','s'],['make','make','s'],['type','type','s'],['owned','owned','b'],['gvw','gvw','s'],['driverId','driver_id','fk'],
    ['model','model','s'],['status','status','s'],['capacityTons','capacity_tons','no'],['fuelType','fuel_type','s'],['yearOfMfg','year_of_mfg','no'],
    ['chassisNo','chassis_no','s'],['engineNo','engine_no','s'],['rcNo','rc_no','s'],['odometerKm','odometer_km','no'],
    ['purchaseDate','purchase_date','d'],['purchasePrice','purchase_price','no'],['financier','financier','s'],['loanAmount','loan_amount','no'],
    ['emiAmount','emi_amount','no'],['emiStartDate','emi_start_date','d'],['emiTenureMonths','emi_tenure_months','no']
  ] },
  drivers: { table: 'drivers', fields: [['name','name','s'],['phone','phone','s'],['licNo','lic_no','s'],['licExpiry','lic_expiry','d']] },
  vendors: { table: 'vendors', fields: [['name','name','s'],['phone','phone','s'],['city','city','s'],['rating','rating','s']] },
  routes: { table: 'routes', fields: [['origin','origin','s'],['destination','destination','s'],['km','km','no']] },
  branches: { table: 'branches', fields: [['name','name','s'],['entityName','entity_name','s'],['gstin','gstin','s'],['addr','addr','s'],['lrPrefix','lr_prefix','s'],['phone','phone','s']] },
  bookings: { table: 'bookings', fields: [
    ['bkNo','bk_no','s'],['date','date','s'],['branchId','branch_id','fk'],['clientId','client_id','fk'],
    ['origin','origin','s'],['destination','destination','s'],['mode','mode','s'],['vehicleType','vehicle_type','s'],
    ['cargo','cargo','s'],['weightMT','weight_mt','no'],['freight','freight','nr'],['rateSource','rate_source','s'],
    ['assignType','assign_type','s'],['vehicleId','vehicle_id','fk'],['hiredVendorId','hired_vendor_id','fk'],
    ['hiredVehicleNo','hired_vehicle_no','s'],['hireCost','hire_cost','no'],['driverId','driver_id','fk'],
    ['status','status','s'],['lrNo','lr_no','s'],['ewayBill','eway_bill','s'],['podReceived','pod_received','b'],
    ['invoiceId','invoice_id','fk']
  ] },
  expenses: { table: 'expenses', fields: [
    ['vehicleId','vehicle_id','fk'],['lrId','lr_id','fk'],['date','date','s'],['category','category','s'],['amount','amount','nr'],['litres','litres','no'],['notes','notes','s'],
    ['odometerAtService','odometer_at_service','no'],['serviceType','service_type','s'],['vendor','vendor','s'],['partsReplaced','parts_replaced','s'],
    ['nextServiceDueKm','next_service_due_km','no'],['nextServiceDueDate','next_service_due_date','d'],['warrantyUntil','warranty_until','d']
  ] },
  renewals: { table: 'renewals', fields: [['vehicleId','vehicle_id','fk'],['docType','doc_type','s'],['ref','ref','s'],['expiry','expiry','d']] },
  payments: { table: 'payments', fields: [['mrNo','mr_no','s'],['invoiceId','invoice_id','fk'],['date','date','s'],['amount','amount','nr'],['mode','mode','s'],['ref','ref','s']] },
  advances: { table: 'advances', fields: [['driverId','driver_id','fk'],['date','date','s'],['amount','amount','nr'],['purpose','purpose','s'],['settledAmount','settled_amount','nr'],['settledAt','settled_at','d']] },
  acctExp: { table: 'acct_expenses', fields: [['lrId','lr_id','fk'],['branchId','branch_id','fk'],['date','date','s'],['account','account','s'],['amount','amount','nr'],['paidThrough','paid_through','s'],['vendor','vendor','s'],['ref','ref','s'],['notes','notes','s'],['src','src','s']] },
  bankTxns: { table: 'bank_txns', fields: [['date','date','s'],['narration','narration','s'],['ref','ref','s'],['amount','amount','nr'],['status','status','s'],['dedupe','dedupe_key','s'],['paymentId','payment_id','fk']] },
  inquiries: { table: 'inquiries', fields: [
    ['inqNo','inq_no','s'],['status','status','s'],['date','date','s'],['branchId','branch_id','fk'],['clientId','client_id','fk'],
    ['partyName','party_name','s'],['contact','contact','s'],['fromPlace','from_place','s'],['toPlace','to_place','s'],
    ['vehicleType','vehicle_type','s'],['cargo','cargo','s'],['weightMT','weight_mt','no'],['expectedDate','expected_date','d'],
    ['rateQuoted','rate_quoted','no'],['ownershipPref','ownership_pref','s'],['notes','notes','s'],['assignType','assign_type','s'],
    ['assignedVehicleId','assigned_vehicle_id','fk'],['assignedVendorId','assigned_vendor_id','fk'],['assignedTruckNo','assigned_truck_no','s'],
    ['bookingId','booking_id','fk'],['lrId','lr_id','fk']
  ] },
  truckMaster: { table: 'truck_master', fields: [
    ['code','code','s'],['truckNo','truck_no','s'],['ownerName','owner_name','s'],['contactNo','contact_no','s'],
    ['panCard','pan_card','b'],['rcNo','rc_no','b'],['createdBy','created_by','s']
  ] },
  lenders: { table: 'lenders', fields: [
    ['name','name','s'],['type','type','s'],['sanctionedAmount','sanctioned_amount','no'],['outstandingAmount','outstanding_amount','no'],
    ['interestRate','interest_rate','no'],['emiAmount','emi_amount','no'],['nextDueDate','next_due_date','d'],['tenureMonths','tenure_months','no'],['notes','notes','s']
  ] },
  fixedExp: { table: 'fixed_exp', fields: [
    ['head','head','s'],['category','category','s'],['amount','amount','no'],['linkedVehicleId','linked_vehicle_id','fk'],
    ['frequency','frequency','s'],['active','active','b'],['notes','notes','s']
  ] },
  auditLog: { table: 'audit_log', fields: [['ts','ts','s'],['action','action','s'],['details','details','s']] },
  vendorDirectory: { table: 'vendor_directory', fields: [
    ['srNo','sr_no','nr'],['vendorCode','vendor_code','s'],['name','name','s'],['contactNo','contact_no','s'],
    ['panCard','pan_card','s'],['gst','gst','s'],['type','type','s'],['createdBy','created_by','s']
  ] },
  taxMaster: { table: 'tax_master', fields: [
    ['srNo','sr_no','nr'],['sign','sign','s'],['description','description','s'],['accountGroup','account_group','s'],
    ['modules','modules','s'],['createdBy','created_by','s']
  ] },
  accountGroups: { table: 'account_groups', fields: [
    ['srNo','sr_no','nr'],['name','name','s'],['parentId','parent_id','fk'],['status','status','s'],['createdBy','created_by','s']
  ] },
  accounts: { table: 'accounts', fields: [
    ['srNo','sr_no','nr'],['code','code','s'],['description','description','s'],['group','group_name','s'],
    ['openingDr','opening_dr','nr'],['openingCr','opening_cr','nr'],['createdBy','created_by','s']
  ] }
};

function toRow(rec, def) {
  const row = { id: rec.id };
  def.fields.forEach(([appKey, col, kind]) => {
    const v = rec[appKey];
    row[col] = kind === 's' ? s(v) : kind === 'nr' ? numReq(v) : kind === 'no' ? numOpt(v) : kind === 'd' ? dateOpt(v) : kind === 'fk' ? fk(v) : kind === 'b' ? bool(v) : v;
  });
  return row;
}
function fromRow(row, def) {
  const rec = { id: row.id };
  def.fields.forEach(([appKey, col]) => { rec[appKey] = row[col] == null ? '' : row[col]; });
  return rec;
}

async function syncFlat(key, def, prevArr, nextArr) {
  const { changed, deletedIds } = diffById(prevArr, nextArr);
  if (changed.length) await upsert(def.table, changed.map(r => toRow(r, def)));
  if (deletedIds.length) await del(def.table, deletedIds);
}

/* bookings <-> invoices is the one circular FK in this schema: a booking can
   point at an invoice (bookings.invoice_id) and an invoice's junction table
   points back at bookings (invoice_bookings.booking_id). The app's own
   "create invoice" action sets both sides in the SAME update() call (see
   AccountingScreen.js: d.invoices.push(inv) and x.invoiceId = inv.id happen
   together), so writing that booking with its real invoice_id before the
   invoice row exists would fail the FK.

   Fix, without breaking ordinary edits of an already-invoiced booking: only
   defer the invoice_id write when it points at an invoice that didn't exist
   before this update() call (i.e. it's being created right now). Everything
   else — including a booking whose invoice_id was already set in an earlier
   save — gets written as-is in pass 1, so an unrelated later edit (e.g.
   marking a booking Delivered) never touches its existing invoice link. */
async function syncBookingsPass1(prevArr, nextArr, prevInvoicesArr) {
  const existingInvoiceIds = new Set((prevInvoicesArr || []).map(i => i.id));
  const { changed, deletedIds } = diffById(prevArr, nextArr);
  const deferred = [];
  if (changed.length) {
    await upsert('bookings', changed.map(r => {
      const row = toRow(r, FLAT.bookings);
      if (row.invoice_id && !existingInvoiceIds.has(row.invoice_id)) { deferred.push(r); row.invoice_id = null; }
      return row;
    }));
  }
  if (deletedIds.length) await del('bookings', deletedIds);
  return deferred;
}
async function syncBookingsPass2(deferred) {
  if (deferred.length) await upsert('bookings', deferred.map(b => ({ id: b.id, invoice_id: b.invoiceId })));
}
async function pullFlat(def, appKey) {
  const rows = await fetchAll(def.table);
  return rows.map(r => fromRow(r, def));
}

/* ============================================================
   contracts (+ contract_rates children, no app id -> replace-all)
   ============================================================ */
const CONTRACT_DEF = { table: 'contracts', fields: [['type','type','s'],['clientId','client_id','fk'],['ref','ref','s'],['validFrom','valid_from','d'],['validTo','valid_to','d'],['emd','emd','no'],['bgExpiry','bg_expiry','d']] };
async function syncContracts(prevArr, nextArr) {
  const { changed, deletedIds } = diffById(prevArr, nextArr);
  for (const c of changed) {
    await upsert('contracts', [toRow(c, CONTRACT_DEF)]);
    await replaceChildren('contract_rates', 'contract_id', c.id, (c.rates || []).map(r => ({
      contract_id: c.id, origin: s(r.origin), destination: s(r.destination), vehicle_type: s(r.vehicleType), rate: numReq(r.rate)
    })));
  }
  if (deletedIds.length) await del('contracts', deletedIds); // contract_rates cascade-deletes
}
async function pullContracts() {
  const [rows, rates] = await Promise.all([fetchAll('contracts'), fetchAll('contract_rates')]);
  const byContract = byKey(rates, 'contract_id');
  return rows.map(r => {
    const rec = fromRow(r, CONTRACT_DEF);
    rec.rates = (byContract[r.id] || []).map(x => ({ origin: x.origin, destination: x.destination, vehicleType: x.vehicle_type, rate: x.rate }));
    return rec;
  });
}

/* ============================================================
   invoices (+ invoice_bookings junction from bookingIds[])
   ============================================================ */
const INVOICE_DEF = { table: 'invoices', fields: [['invNo','inv_no','s'],['date','date','s'],['branchId','branch_id','fk'],['clientId','client_id','fk'],['amount','amount','nr'],['gstPct','gst_pct','nr'],['total','total','nr'],['dueDate','due_date','d'],['notes','notes','s']] };
async function syncInvoices(prevArr, nextArr) {
  const { changed, deletedIds } = diffById(prevArr, nextArr);
  for (const inv of changed) {
    await upsert('invoices', [toRow(inv, INVOICE_DEF)]);
    await replaceChildren('invoice_bookings', 'invoice_id', inv.id, (inv.bookingIds || []).map(bid => ({ invoice_id: inv.id, booking_id: bid })));
  }
  if (deletedIds.length) await del('invoices', deletedIds);
}
async function pullInvoices() {
  const [rows, links] = await Promise.all([fetchAll('invoices'), fetchAll('invoice_bookings')]);
  const byInv = byKey(links, 'invoice_id');
  return rows.map(r => {
    const rec = fromRow(r, INVOICE_DEF);
    rec.bookingIds = (byInv[r.id] || []).map(x => x.booking_id);
    return rec;
  });
}

/* ============================================================
   LHCs (+ lhc_payments — those DO carry a real app id via uid('lp'))
   ============================================================ */
const LHC_DEF = { table: 'lhcs', fields: [
  ['lhcNo','lhc_no','s'],['date','date','s'],['vendorId','vendor_id','fk'],['truckNo','truck_no','s'],
  ['driverName','driver_name','s'],['driverPhone','driver_phone','s'],['fromPlace','from_place','s'],['toPlace','to_place','s'],
  ['lrNos','lr_nos','s'],['lorryHire','lorry_hire','nr'],['advance','advance','nr'],['deductions','deductions','nr'],
  ['tdsPct','tds_pct','nr'],['tdsAmt','tds_amt','nr'],['notes','notes','s']
] };
async function syncLHCs(prevArr, nextArr) {
  const { changed, deletedIds } = diffById(prevArr, nextArr);
  for (const l of changed) {
    await upsert('lhcs', [toRow(l, LHC_DEF)]);
    const { changed: pChanged, deletedIds: pDeleted } = diffById(
      (prevArr.find(x => x.id === l.id) || {}).payments,
      l.payments
    );
    if (pChanged.length) await upsert('lhc_payments', pChanged.map(p => ({ id: p.id, lhc_id: l.id, date: s(p.date), amount: numReq(p.amount), mode: s(p.mode), ref: s(p.ref) })));
    if (pDeleted.length) await del('lhc_payments', pDeleted);
  }
  if (deletedIds.length) await del('lhcs', deletedIds);
}
async function pullLHCs() {
  const [rows, pays] = await Promise.all([fetchAll('lhcs'), fetchAll('lhc_payments')]);
  const byLhc = byKey(pays, 'lhc_id');
  return rows.map(r => {
    const rec = fromRow(r, LHC_DEF);
    rec.payments = (byLhc[r.id] || []).map(p => ({ id: p.id, date: p.date, amount: p.amount, mode: p.mode || '', ref: p.ref || '' }));
    return rec;
  });
}

/* ============================================================
   LRs — the big one. Flat fields on lrs, plus:
     lr_parties        (consignor/consignee/billingTo, replace-all by role)
     lr_goods          (goods[], replace-all, sort_order preserves array order)
     lr_charges        (1:1 charges{})
     lr_expense_lines  (expenses[] on the LR, replace-all)
     lr_hire           (1:1 hire{vendorId,amount,advance})
     lr_hire_payments  (hire.payments[], real app id via uid('hp') -> id diff)
     lr_trip_expenses  (tripExpenses[], replace-all; references expenses.id via expId)
   ============================================================ */
const LR_DEF = { table: 'lrs', fields: [
  ['bookingId','booking_id','fk'],['lrType','lr_type','s'],['truckNo','truck_no','s'],['lrNo','lr_no','s'],['date','date','s'],
  ['bookingBranch','booking_branch','s'],['fromPlace','from_place','s'],['toPlace','to_place','s'],['toBranch','to_branch','s'],
  ['invoiceNo','invoice_no','s'],['invAmount','inv_amount','no'],['invoiceDate','invoice_date','d'],
  ['ewayBillNo','eway_bill_no','s'],['ewayBillDate','eway_bill_date','d'],['ewayExDate','eway_ex_date','d'],['poDate','po_date','d'],
  ['packing','packing','s'],['lorryType','lorry_type','s'],['privateMark','private_mark','s'],['lrMode','lr_mode','s'],
  ['deliveryAddress','delivery_address','s'],['billingParty','billing_party','s'],['gstPaidBy','gst_paid_by','s'],
  ['gstSlab','gst_slab','s'],['insurance','insurance','s'],['payTerms','pay_terms','s'],['agent','agent','s'],['billedAt','billed_at','s'],
  ['aWeight','a_weight','no'],['cWeight','c_weight','no'],['remark','remark','s'],['employee','employee','s'],['driverNo','driver_no','s'],
  ['igstPct','igst_pct','nr'],['cgstPct','cgst_pct','nr'],['sgstPct','sgst_pct','nr'],
  ['subTotal','sub_total','nr'],['igstAmt','igst_amt','nr'],['cgstAmt','cgst_amt','nr'],['sgstAmt','sgst_amt','nr'],['gross','gross','nr'],
  ['pod','pod','b'],['podFileUri','pod_file_uri','s'],['podReceiver','pod_receiver','s'],['podDate','pod_date','d'],['podRemarks','pod_remarks','s'],
  ['ownership','ownership','s'],['vehicleId','vehicle_id','fk'],['branchId','branch_id','fk']
] };
const LR_CHARGE_KEYS = ['abovePct','aboveCh','belowPct','belowCh','rate','rateCh','freight','surcharge','localCartage','lastMile','fov','loading','unloading','handling','gc','other','ewayCh','aoc'];
const LR_CHARGE_COLS = { abovePct: 'above_pct', aboveCh: 'above_ch', belowPct: 'below_pct', belowCh: 'below_ch', rate: 'rate', rateCh: 'rate_ch', freight: 'freight', surcharge: 'surcharge', localCartage: 'local_cartage', lastMile: 'last_mile', fov: 'fov', loading: 'loading', unloading: 'unloading', handling: 'handling', gc: 'gc', other: 'other', ewayCh: 'eway_ch', aoc: 'aoc' };

async function syncLRs(prevArr, nextArr) {
  const { changed, deletedIds } = diffById(prevArr, nextArr);
  const prevMap = {}; (prevArr || []).forEach(x => { prevMap[x.id] = x; });
  for (const lr of changed) {
    await upsert('lrs', [toRow(lr, LR_DEF)]);

    const parties = [];
    if (lr.consignor) parties.push({ lr_id: lr.id, role: 'consignor', name: s(lr.consignor.name), city: s(lr.consignor.city), contact: s(lr.consignor.contact), pan: s(lr.consignor.pan), gst: s(lr.consignor.gst) });
    if (lr.consignee) parties.push({ lr_id: lr.id, role: 'consignee', name: s(lr.consignee.name), city: s(lr.consignee.city), contact: s(lr.consignee.contact), pan: s(lr.consignee.pan), gst: s(lr.consignee.gst) });
    if (lr.billingTo) parties.push({ lr_id: lr.id, role: 'billing_to', name: s(lr.billingTo.name), city: s(lr.billingTo.city), contact: s(lr.billingTo.contact), pan: s(lr.billingTo.pan), gst: s(lr.billingTo.gst) });
    await replaceChildren('lr_parties', 'lr_id', lr.id, parties);

    await replaceChildren('lr_goods', 'lr_id', lr.id, (lr.goods || []).map((g, i) => ({
      lr_id: lr.id, sort_order: i, description: s(g.desc), pkg_type: s(g.pkgType), pcs: numOpt(g.pcs),
      actual_wt: numOpt(g.aw), charged_wt: numOpt(g.cw), length_cm: numOpt(g.l), width_cm: numOpt(g.w), height_cm: numOpt(g.h)
    })));

    const ch = lr.charges || {};
    const chargeRow = { lr_id: lr.id };
    LR_CHARGE_KEYS.forEach(k => { chargeRow[LR_CHARGE_COLS[k]] = numReq(ch[k]); });
    await upsert('lr_charges', [chargeRow]);

    await replaceChildren('lr_expense_lines', 'lr_id', lr.id, (lr.expenses || []).map(e => ({
      lr_id: lr.id, account: s(e.account), amount: numReq(e.amount), remarks: s(e.remarks)
    })));

    const hire = lr.hire || {};
    await upsert('lr_hire', [{ lr_id: lr.id, vendor_id: fk(hire.vendorId), amount: numReq(hire.amount), advance: numReq(hire.advance) }]);

    const prevHirePayments = (prevMap[lr.id] && prevMap[lr.id].hire && prevMap[lr.id].hire.payments) || [];
    const { changed: hpChanged, deletedIds: hpDeleted } = diffById(prevHirePayments, hire.payments);
    if (hpChanged.length) await upsert('lr_hire_payments', hpChanged.map(p => ({ id: p.id, lr_id: lr.id, date: s(p.date), amount: numReq(p.amount), mode: s(p.mode), ref: s(p.ref) })));
    if (hpDeleted.length) await del('lr_hire_payments', hpDeleted);

    await replaceChildren('lr_trip_expenses', 'lr_id', lr.id, (lr.tripExpenses || []).map(t => ({
      lr_id: lr.id, expense_id: t.expId, date: s(t.date), category: s(t.category), amount: numReq(t.amount)
    })));
  }
  if (deletedIds.length) await del('lrs', deletedIds); // children cascade-delete
}

async function pullLRs() {
  const [rows, parties, goods, charges, expLines, hires, hirePays, tripExps] = await Promise.all([
    fetchAll('lrs'), fetchAll('lr_parties'), fetchAll('lr_goods'), fetchAll('lr_charges'),
    fetchAll('lr_expense_lines'), fetchAll('lr_hire'), fetchAll('lr_hire_payments'), fetchAll('lr_trip_expenses')
  ]);
  const partiesByLr = byKey(parties, 'lr_id');
  const goodsByLr = byKey(goods, 'lr_id');
  const chargeByLr = {}; charges.forEach(c => { chargeByLr[c.lr_id] = c; });
  const expByLr = byKey(expLines, 'lr_id');
  const hireByLr = {}; hires.forEach(h => { hireByLr[h.lr_id] = h; });
  const hirePayByLr = byKey(hirePays, 'lr_id');
  const tripByLr = byKey(tripExps, 'lr_id');
  const blankParty = () => ({ name: '', city: '', contact: '', pan: '', gst: '' });

  return rows.map(r => {
    const rec = fromRow(r, LR_DEF);
    const ps = partiesByLr[r.id] || [];
    const findRole = role => { const p = ps.find(x => x.role === role); return p ? { name: p.name, city: p.city, contact: p.contact, pan: p.pan, gst: p.gst } : blankParty(); };
    rec.consignor = findRole('consignor');
    rec.consignee = findRole('consignee');
    rec.billingTo = findRole('billing_to');

    rec.goods = (goodsByLr[r.id] || []).slice().sort((a, b) => a.sort_order - b.sort_order).map(g => ({
      desc: g.description || '', pkgType: g.pkg_type || '', pcs: g.pcs == null ? '' : String(g.pcs),
      aw: g.actual_wt == null ? '' : String(g.actual_wt), cw: g.charged_wt == null ? '' : String(g.charged_wt),
      l: g.length_cm == null ? '' : String(g.length_cm), w: g.width_cm == null ? '' : String(g.width_cm), h: g.height_cm == null ? '' : String(g.height_cm)
    }));

    const chRow = chargeByLr[r.id] || {};
    const charges2 = {};
    LR_CHARGE_KEYS.forEach(k => { charges2[k] = chRow[LR_CHARGE_COLS[k]] == null ? '' : chRow[LR_CHARGE_COLS[k]]; });
    rec.charges = charges2;

    rec.expenses = (expByLr[r.id] || []).map(e => ({ account: e.account || '', amount: e.amount, remarks: e.remarks || '' }));

    const h = hireByLr[r.id];
    rec.hire = {
      vendorId: h ? (h.vendor_id || '') : '', amount: h ? h.amount : 0, advance: h ? h.advance : 0,
      payments: (hirePayByLr[r.id] || []).map(p => ({ id: p.id, date: p.date, amount: p.amount, mode: p.mode || '', ref: p.ref || '' }))
    };

    rec.tripExpenses = (tripByLr[r.id] || []).map(t => ({ expId: t.expense_id, date: t.date, category: t.category || '', amount: t.amount }));

    if (r.pod_file_uri != null) rec.podFileUri = r.pod_file_uri;
    if (r.pod_receiver != null) rec.podReceiver = r.pod_receiver;
    if (r.pod_date != null) rec.podDate = r.pod_date;
    if (r.pod_remarks != null) rec.podRemarks = r.pod_remarks;

    return rec;
  });
}

/* ============================================================
   bills (Bill / Invoice module) — flat fields on bills, plus:
     bill_lines     (lines[], replace-all, sort_order preserves array order)
     bill_charges   (1:1 LR Charges block)
     bill_payments  (additions[]/deductions[] sharing one table via `kind`)
   Independent of LRs — bill_lines.lr_id is a nullable read-only reference
   into lrs, never written back to. Vendor is a reference into
   vendor_directory (the ATTrans-imported register), not vendors.
   ============================================================ */
const BILL_DEF = { table: 'bills', fields: [
  ['invoiceNo','invoice_no','s'],['vendorId','vendor_id','fk'],['date','date','s'],['poNo','po_no','s'],['poDate','po_date','d'],
  ['sgstPct','sgst_pct','nr'],['cgstPct','cgst_pct','nr'],['igstPct','igst_pct','nr'],['roundOff','round_off','nr'],['advanceReceive','advance_receive','nr'],
  ['bank','bank','s'],['remark','remark','s'],['subject','subject','s'],
  ['totalAmount','total_amount','nr'],['totalAddition','total_addition','nr'],['totalDeduction','total_deduction','nr'],
  ['grossAmount','gross_amount','nr'],['sgstAmt','sgst_amt','nr'],['cgstAmt','cgst_amt','nr'],['igstAmt','igst_amt','nr'],
  ['netAmount','net_amount','nr'],['balanceAmount','balance_amount','nr']
] };
const BILL_CHARGE_KEYS = ['hamali','loading','unloading','rtoChallan','varai','lrCharges','detention','otherAdd','dockCharges','extraDelivery'];
const BILL_CHARGE_COLS = { hamali: 'hamali', loading: 'loading', unloading: 'unloading', rtoChallan: 'rto_challan', varai: 'varai', lrCharges: 'lr_charges', detention: 'detention', otherAdd: 'other_add', dockCharges: 'dock_charges', extraDelivery: 'extra_delivery' };

async function syncBills(prevArr, nextArr) {
  const { changed, deletedIds } = diffById(prevArr, nextArr);
  for (const b of changed) {
    await upsert('bills', [toRow(b, BILL_DEF)]);

    await replaceChildren('bill_lines', 'bill_id', b.id, (b.lines || []).map((l, i) => ({
      bill_id: b.id, sort_order: i, lr_id: fk(l.lrId), status: s(l.status), lr_no: s(l.lrNo), date: dateOpt(l.date),
      from_place: s(l.from), to_place: s(l.to), weight: numOpt(l.weight), pcs: numOpt(l.pcs), rate: numOpt(l.rate),
      amount: numReq(l.amount), other_charges: numReq(l.otherCharges), remark: s(l.remark)
    })));

    const ch = b.charges || {};
    const chargeRow = { bill_id: b.id };
    BILL_CHARGE_KEYS.forEach(k => { chargeRow[BILL_CHARGE_COLS[k]] = numReq(ch[k]); });
    await upsert('bill_charges', [chargeRow]);

    const payRows = [
      ...(b.additions || []).map((a, i) => ({ bill_id: b.id, kind: 'addition', sort_order: i, type: s(a.type), amount: numReq(a.amount) })),
      ...(b.deductions || []).map((a, i) => ({ bill_id: b.id, kind: 'deduction', sort_order: i, type: s(a.type), amount: numReq(a.amount) }))
    ];
    await replaceChildren('bill_payments', 'bill_id', b.id, payRows);
  }
  if (deletedIds.length) await del('bills', deletedIds); // children cascade-delete
}
async function pullBills() {
  const [rows, lines, charges, payments] = await Promise.all([
    fetchAll('bills'), fetchAll('bill_lines'), fetchAll('bill_charges'), fetchAll('bill_payments')
  ]);
  const linesByBill = byKey(lines, 'bill_id');
  const chargeByBill = {}; charges.forEach(c => { chargeByBill[c.bill_id] = c; });
  const payByBill = byKey(payments, 'bill_id');

  return rows.map(r => {
    const rec = fromRow(r, BILL_DEF);

    rec.lines = (linesByBill[r.id] || []).slice().sort((a, b2) => a.sort_order - b2.sort_order).map(l => ({
      id: l.id, lrId: l.lr_id || '', status: l.status || '', lrNo: l.lr_no || '', date: l.date || '',
      from: l.from_place || '', to: l.to_place || '', weight: l.weight == null ? '' : String(l.weight),
      pcs: l.pcs == null ? '' : String(l.pcs), rate: l.rate == null ? '' : String(l.rate),
      amount: l.amount == null ? '' : String(l.amount), otherCharges: l.other_charges == null ? '' : String(l.other_charges),
      remark: l.remark || ''
    }));

    const chRow = chargeByBill[r.id] || {};
    const charges2 = {};
    BILL_CHARGE_KEYS.forEach(k => { charges2[k] = chRow[BILL_CHARGE_COLS[k]] == null ? '' : String(chRow[BILL_CHARGE_COLS[k]]); });
    rec.charges = charges2;

    const pays = payByBill[r.id] || [];
    rec.additions = pays.filter(p => p.kind === 'addition').sort((a, b2) => a.sort_order - b2.sort_order)
      .map(p => ({ id: p.id, type: p.type || '', amount: p.amount == null ? '' : String(p.amount) }));
    rec.deductions = pays.filter(p => p.kind === 'deduction').sort((a, b2) => a.sort_order - b2.sort_order)
      .map(p => ({ id: p.id, type: p.type || '', amount: p.amount == null ? '' : String(p.amount) }));

    return rec;
  });
}

/* ============================================================
   lhc_trips (NEW LHC / Lorry Hire Contract module — separate from the
   older, unlinked lhcs table) — flat fields on lhc_trips, plus:
     lhc_trip_lines      (lines[], replace-all, sort_order preserves order)
     lhc_trip_payments   (additions[]/deductions[] sharing one table via `kind`)
     lhc_trip_expenses   (expenses[], replace-all)
   lhc_trip_lines.lr_id is a nullable read-only reference into lrs, mirroring
   bill_lines.lr_id — never written back to the LR.
   ============================================================ */
const LHC_TRIP_DEF = { table: 'lhc_trips', fields: [
  ['lhcNo','lhc_no','s'],['date','date','s'],['truckNo','truck_no','s'],['fromPlace','from_place','s'],['toPlace','to_place','s'],
  ['agent','agent','s'],['lorryType','lorry_type','s'],['chasisNo','chasis_no','s'],['engineNo','engine_no','s'],
  ['permitNo','permit_no','s'],['insuranceCo','insurance_co','s'],['branch','branch','s'],['policyNo','policy_no','s'],
  ['permitFrom','permit_from','d'],['permitUpto','permit_upto','d'],['insuranceUpto','insurance_upto','d'],
  ['driverName','driver_name','s'],['driverAddress','driver_address','s'],['driverLicNo','driver_lic_no','s'],
  ['driverLicDate','driver_lic_date','d'],['driverIssuedFrom','driver_issued_from','s'],['driverMobile','driver_mobile','s'],
  ['ownerName','owner_name','s'],['ownerAddress','owner_address','s'],['ownerPan','owner_pan','s'],['ownerMobile','owner_mobile','s'],
  ['lorryHire','lorry_hire','nr'],['advance','advance','nr'],['payTo','pay_to','s'],
  ['totalAddition','total_addition','nr'],['totalDeduction','total_deduction','nr'],['totalExpense','total_expense','nr'],
  ['netAmount','net_amount','nr'],['balanceAmount','balance_amount','nr'],['createdBy','created_by','s'],['imageUri','image_uri','s']
] };

async function syncLhcTrips(prevArr, nextArr) {
  const { changed, deletedIds } = diffById(prevArr, nextArr);
  for (const t of changed) {
    await upsert('lhc_trips', [toRow(t, LHC_TRIP_DEF)]);

    await replaceChildren('lhc_trip_lines', 'lhc_trip_id', t.id, (t.lines || []).map((l, i) => ({
      lhc_trip_id: t.id, sort_order: i, lr_id: fk(l.lrId), lr_no: s(l.lrNo), date: dateOpt(l.date),
      content: s(l.content), pkgs: numOpt(l.pkgs), weight: numOpt(l.weight)
    })));

    const payRows = [
      ...(t.additions || []).map((a, i) => ({ lhc_trip_id: t.id, kind: 'addition', sort_order: i, type: s(a.type), amount: numReq(a.amount) })),
      ...(t.deductions || []).map((a, i) => ({ lhc_trip_id: t.id, kind: 'deduction', sort_order: i, type: s(a.type), amount: numReq(a.amount) }))
    ];
    await replaceChildren('lhc_trip_payments', 'lhc_trip_id', t.id, payRows);

    await replaceChildren('lhc_trip_expenses', 'lhc_trip_id', t.id, (t.expenses || []).map((e, i) => ({
      lhc_trip_id: t.id, sort_order: i, account: s(e.account), amount: numReq(e.amount)
    })));
  }
  if (deletedIds.length) await del('lhc_trips', deletedIds); // children cascade-delete
}
async function pullLhcTrips() {
  const [rows, lines, payments, expenses] = await Promise.all([
    fetchAll('lhc_trips'), fetchAll('lhc_trip_lines'), fetchAll('lhc_trip_payments'), fetchAll('lhc_trip_expenses')
  ]);
  const linesByTrip = byKey(lines, 'lhc_trip_id');
  const payByTrip = byKey(payments, 'lhc_trip_id');
  const expByTrip = byKey(expenses, 'lhc_trip_id');

  return rows.map(r => {
    const rec = fromRow(r, LHC_TRIP_DEF);

    rec.lines = (linesByTrip[r.id] || []).slice().sort((a, b2) => a.sort_order - b2.sort_order).map(l => ({
      id: l.id, lrId: l.lr_id || '', lrNo: l.lr_no || '', date: l.date || '', content: l.content || '',
      pkgs: l.pkgs == null ? '' : String(l.pkgs), weight: l.weight == null ? '' : String(l.weight)
    }));

    const pays = payByTrip[r.id] || [];
    rec.additions = pays.filter(p => p.kind === 'addition').sort((a, b2) => a.sort_order - b2.sort_order)
      .map(p => ({ id: p.id, type: p.type || '', amount: p.amount == null ? '' : String(p.amount) }));
    rec.deductions = pays.filter(p => p.kind === 'deduction').sort((a, b2) => a.sort_order - b2.sort_order)
      .map(p => ({ id: p.id, type: p.type || '', amount: p.amount == null ? '' : String(p.amount) }));

    rec.expenses = (expByTrip[r.id] || []).slice().sort((a, b2) => a.sort_order - b2.sort_order).map(e => ({
      id: e.id, account: e.account || '', amount: e.amount == null ? '' : String(e.amount)
    }));

    return rec;
  });
}

/* ============================================================
   billing backup — one-time seed only, app never mutates it after
   ensureBillingBackup() runs once in logic.js's migrate().
   ============================================================ */
async function seedBillingBackupIfEmpty(billingBackup) {
  const existing = await fetchAll('billing_backup_bills');
  if (existing.length || !billingBackup || !billingBackup.length) return;
  for (const b of billingBackup) {
    const { data, error } = await supabase.from('billing_backup_bills').insert({
      bill_no: s(b.no), client_name: s(b.client), bill_date: dateOpt(b.date), total: numReq(b.total)
    }).select('id').single();
    if (error) throw new Error('billing_backup_bills: ' + error.message);
    const lines = (b.lines || []).map(([lrNo, amt]) => ({ bill_id: data.id, lr_no: s(lrNo), amount: numReq(amt) }));
    if (lines.length) {
      const { error: lineErr } = await supabase.from('billing_backup_lines').insert(lines);
      if (lineErr) throw new Error('billing_backup_lines: ' + lineErr.message);
    }
  }
}
async function pullBillingBackup() {
  const [bills, lines] = await Promise.all([fetchAll('billing_backup_bills'), fetchAll('billing_backup_lines')]);
  const byBill = byKey(lines, 'bill_id');
  return bills.map(b => ({
    no: b.bill_no, client: b.client_name, date: b.bill_date, total: b.total,
    lines: (byBill[b.id] || []).map(l => [l.lr_no, l.amount])
  }));
}

/* ============================================================
   company (singleton) + counters
   ============================================================ */
async function syncCompany(prevCompany, nextCompany) {
  if (JSON.stringify(prevCompany) === JSON.stringify(nextCompany)) return;
  const c = nextCompany || {};
  const { error } = await supabase.from('company_settings').upsert({
    id: 1, name: s(c.name), addr: s(c.addr), gstin: s(c.gstin), phone: s(c.phone), email: s(c.email), lr_prefix: s(c.lrPrefix)
  });
  if (error) throw new Error('company_settings: ' + error.message);
}
async function pullCompany() {
  const { data, error } = await supabase.from('company_settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error('company_settings: ' + error.message);
  if (!data) return null;
  return { name: data.name, addr: data.addr, gstin: data.gstin, phone: data.phone, email: data.email, lrPrefix: data.lr_prefix };
}
const SEQ_KEYS = ['lr', 'inv', 'bk', 'lhc', 'inq', 'mr'];
async function syncSeq(prevSeq, nextSeq) {
  const rows = [];
  SEQ_KEYS.forEach(k => { if ((prevSeq || {})[k] !== (nextSeq || {})[k]) rows.push({ name: k, value: Number(nextSeq[k]) || 0 }); });
  if (rows.length) {
    const { error } = await supabase.from('counters').upsert(rows);
    if (error) throw new Error('counters: ' + error.message);
  }
}
async function pullSeq() {
  const rows = await fetchAll('counters');
  const seq = {};
  rows.forEach(r => { seq[r.name] = Number(r.value) || 0; });
  SEQ_KEYS.forEach(k => { if (!seq[k]) seq[k] = 1; });
  return seq;
}

/* ============================================================
   public API
   ============================================================ */

/* Pull the full db shape from Supabase. Returns null if company_settings has
   never been seeded (i.e. nothing has been migrated in yet — caller should
   fall back to the local/seed path and then call seedIfEmpty()). */
export async function pullDb() {
  const company = await pullCompany();
  if (!company) return null;
  const [
    seq, clients, vehicles, drivers, vendors, routes, branches, contracts,
    bookings, expenses, renewals, invoices, payments, lrs, lhcs, advances,
    acctExp, inquiries, bankTxns, billingBackup, truckMaster, lenders, fixedExp, auditLog, vendorDirectory, bills, taxMaster, accountGroups, accounts, lhcTrips
  ] = await Promise.all([
    pullSeq(), pullFlat(FLAT.clients), pullFlat(FLAT.vehicles), pullFlat(FLAT.drivers), pullFlat(FLAT.vendors),
    pullFlat(FLAT.routes), pullFlat(FLAT.branches), pullContracts(), pullFlat(FLAT.bookings), pullFlat(FLAT.expenses),
    pullFlat(FLAT.renewals), pullInvoices(), pullFlat(FLAT.payments), pullLRs(), pullLHCs(), pullFlat(FLAT.advances),
    pullFlat(FLAT.acctExp), pullFlat(FLAT.inquiries), pullFlat(FLAT.bankTxns), pullBillingBackup(), pullFlat(FLAT.truckMaster),
    pullFlat(FLAT.lenders), pullFlat(FLAT.fixedExp), pullFlat(FLAT.auditLog), pullFlat(FLAT.vendorDirectory), pullBills(), pullFlat(FLAT.taxMaster), pullFlat(FLAT.accountGroups), pullFlat(FLAT.accounts), pullLhcTrips()
  ]);
  return {
    company, seq, clients, vehicles, drivers, vendors, routes, branches, contracts,
    bookings, expenses, renewals, invoices, payments, lrs, lhcs, advances,
    acctExp, inquiries, bankTxns, billingBackup, truckMaster, lenders, fixedExp, auditLog, vendorDirectory, bills, taxMaster, accountGroups, accounts, lhcTrips, regSeeded: true, pdfRecon: '2026-08-07'
  };
}

/* Write everything in `db` to Supabase, unconditionally — used the very
   first time this device connects to a project whose bgts_os schema is
   still empty (see store.js: only called when pullDb() returns null). */
export async function seedIfEmpty(db) {
  await syncCompany(null, db.company);
  await syncSeq({}, db.seq);
  await syncFlat('branches', FLAT.branches, [], db.branches);
  await syncFlat('clients', FLAT.clients, [], db.clients);
  await syncFlat('drivers', FLAT.drivers, [], db.drivers);
  await syncFlat('vehicles', FLAT.vehicles, [], db.vehicles); // after drivers: vehicles.driver_id is a FK
  await syncFlat('vendors', FLAT.vendors, [], db.vendors);
  await syncFlat('routes', FLAT.routes, [], db.routes);
  await syncContracts([], db.contracts);
  const seededBookings = await syncBookingsPass1([], db.bookings, []);
  await syncFlat('expenses', FLAT.expenses, [], db.expenses);
  await syncFlat('renewals', FLAT.renewals, [], db.renewals);
  await syncInvoices([], db.invoices);
  await syncBookingsPass2(seededBookings);
  await syncFlat('payments', FLAT.payments, [], db.payments);
  await syncLRs([], db.lrs);
  await syncLHCs([], db.lhcs);
  await syncFlat('advances', FLAT.advances, [], db.advances);
  await syncFlat('acctExp', FLAT.acctExp, [], db.acctExp);
  await syncFlat('inquiries', FLAT.inquiries, [], db.inquiries);
  await syncFlat('bankTxns', FLAT.bankTxns, [], db.bankTxns);
  await syncFlat('truckMaster', FLAT.truckMaster, [], db.truckMaster);
  await syncFlat('lenders', FLAT.lenders, [], db.lenders);
  await syncFlat('fixedExp', FLAT.fixedExp, [], db.fixedExp); // after vehicles: fixedExp.linked_vehicle_id is a FK
  await syncFlat('auditLog', FLAT.auditLog, [], db.auditLog);
  await syncFlat('vendorDirectory', FLAT.vendorDirectory, [], db.vendorDirectory);
  await syncBills([], db.bills); // after lrs (bill_lines.lr_id fk) and vendorDirectory (bills.vendor_id fk)
  await syncFlat('taxMaster', FLAT.taxMaster, [], db.taxMaster);
  await syncFlat('accountGroups', FLAT.accountGroups, [], db.accountGroups);
  await syncFlat('accounts', FLAT.accounts, [], db.accounts);
  await syncLhcTrips([], db.lhcTrips); // after lrs (lhc_trip_lines.lr_id fk)
  await seedBillingBackupIfEmpty(db.billingBackup);
}

/* Diff prevDb -> nextDb and write only what changed. Order matters: rows
   referenced by a foreign key must be written before the row that points to
   them (e.g. clients before bookings, vehicles before bookings, bookings
   before invoices/lrs). This mirrors the natural creation order the app's
   own screens already enforce (you can't assign a vehicle to a booking that
   doesn't exist yet), so in practice each update() call only ever touches
   one or two collections and ordering rarely matters — but we still order
   defensively for the initial full-seed case above. */
export async function pushDb(prevDb, nextDb) {
  if (!prevDb || !nextDb) return;
  await syncCompany(prevDb.company, nextDb.company);
  await syncSeq(prevDb.seq, nextDb.seq);
  await syncFlat('branches', FLAT.branches, prevDb.branches, nextDb.branches);
  await syncFlat('clients', FLAT.clients, prevDb.clients, nextDb.clients);
  await syncFlat('drivers', FLAT.drivers, prevDb.drivers, nextDb.drivers);
  await syncFlat('vehicles', FLAT.vehicles, prevDb.vehicles, nextDb.vehicles);
  await syncFlat('vendors', FLAT.vendors, prevDb.vendors, nextDb.vendors);
  await syncFlat('routes', FLAT.routes, prevDb.routes, nextDb.routes);
  await syncContracts(prevDb.contracts, nextDb.contracts);
  const changedBookings = await syncBookingsPass1(prevDb.bookings, nextDb.bookings, prevDb.invoices);
  await syncFlat('expenses', FLAT.expenses, prevDb.expenses, nextDb.expenses);
  await syncFlat('renewals', FLAT.renewals, prevDb.renewals, nextDb.renewals);
  await syncInvoices(prevDb.invoices, nextDb.invoices);
  await syncBookingsPass2(changedBookings);
  await syncFlat('payments', FLAT.payments, prevDb.payments, nextDb.payments);
  await syncLRs(prevDb.lrs, nextDb.lrs);
  await syncLHCs(prevDb.lhcs, nextDb.lhcs);
  await syncFlat('advances', FLAT.advances, prevDb.advances, nextDb.advances);
  await syncFlat('acctExp', FLAT.acctExp, prevDb.acctExp, nextDb.acctExp);
  await syncFlat('inquiries', FLAT.inquiries, prevDb.inquiries, nextDb.inquiries);
  await syncFlat('bankTxns', FLAT.bankTxns, prevDb.bankTxns, nextDb.bankTxns);
  await syncFlat('truckMaster', FLAT.truckMaster, prevDb.truckMaster, nextDb.truckMaster);
  await syncFlat('lenders', FLAT.lenders, prevDb.lenders, nextDb.lenders);
  await syncFlat('fixedExp', FLAT.fixedExp, prevDb.fixedExp, nextDb.fixedExp);
  await syncFlat('auditLog', FLAT.auditLog, prevDb.auditLog, nextDb.auditLog);
  await syncFlat('vendorDirectory', FLAT.vendorDirectory, prevDb.vendorDirectory, nextDb.vendorDirectory);
  await syncBills(prevDb.bills, nextDb.bills);
  await syncFlat('taxMaster', FLAT.taxMaster, prevDb.taxMaster, nextDb.taxMaster);
  await syncFlat('accountGroups', FLAT.accountGroups, prevDb.accountGroups, nextDb.accountGroups);
  await syncFlat('accounts', FLAT.accounts, prevDb.accounts, nextDb.accounts);
  await syncLhcTrips(prevDb.lhcTrips, nextDb.lhcTrips);
  // billingBackup is intentionally not synced here — see seedBillingBackupIfEmpty.
}
