import React, { useState } from 'react';
import { View, Text, ScrollView, Linking, TextInput, TouchableOpacity } from 'react-native';
import { useStore } from '../store';
import { downloadFile, printHtml } from '../fileIO';
import { getLogoDataUri } from '../logoAsset';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo, Table, Kpi, alert, PickerField, DatePicker } from '../ui';
import {
  uid, inr, sum, fmtDate, daysTo, todayISO, addDaysISO, daysSince, byId, removeById,
  clientName, invPaid, invOutstanding, mailLink, EXP_HEADS, PAY_THROUGH,
  csvString, receiptHtml, clientExposure, creditGuard, logAudit, fixedExpAmount, vehicleReg
} from '../logic';

/* ---------- Invoices & Receivables filter bar (from bgts-os-app_8.html's invFilterBar/invMatches) ---------- */
function FilterField({ label, grow, children }) {
  return (
    <View style={{ minWidth: grow ? 200 : 140, flexGrow: grow ? 1 : 0, gap: 4 }}>
      <Text style={{ fontSize: 9.5, fontWeight: '800', color: C.mut, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</Text>
      {children}
    </View>
  );
}

/* Subtabs — exact labels/order from bgts-os-app_8.html's vAccounting(). 'overview',
   'banking' and 'backup' already exist as their own screens (AccDash / Banking /
   Backup) rather than being duplicated here, so those three navigate away instead
   of switching in-page content — everything else (receivables/expenses/payments/
   customers) shows/hides the matching card right here, exactly like the HTML's
   ACC_TAB-driven single-page switch. */
const ACC_TABS = [
  ['overview', 'Accounts Dashboard'],
  ['receivables', 'Invoices & Receivables'],
  ['banking', 'Banking / Reconciliation'],
  ['expenses', 'Expenses'],
  ['payments', 'Payments Received'],
  ['customers', 'Customers'],
  ['backup', 'Invoice Backup (Register)'],
  ['fixedexp', 'Monthly Fixed Expenses'],
  ['cashflow', 'Cashflow / Working Capital'],
  ['auditlog', 'Audit Log']
];
const ACC_TAB_SCREEN = { overview: 'AccDash', banking: 'Banking', backup: 'Backup' };

export default function AccountingScreen({ navigation }) {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);
  const [accTab, setAccTab] = useState('receivables');
  const pressAccTab = (id) => {
    if (ACC_TAB_SCREEN[id]) navigation.navigate(ACC_TAB_SCREEN[id]);
    else setAccTab(id);
  };
  const uninv = db.bookings.filter(b => b.status === 'Delivered' && !b.invoiceId);

  const [invF, setInvF] = useState({ from: '', to: '', clientId: '', branchId: '', q: '', sort: 'desc' });
  const setIF = (k, v) => setInvF(prev => ({ ...prev, [k]: v }));
  const resetInvFilter = () => setInvF({ from: '', to: '', clientId: '', branchId: '', q: '', sort: 'desc' });

  const invMatches = (inv) => {
    if (invF.from && String(inv.date) < invF.from) return false;
    if (invF.to && String(inv.date) > invF.to) return false;
    if (invF.clientId && inv.clientId !== invF.clientId) return false;
    if (invF.branchId && inv.branchId !== invF.branchId) return false;
    if (invF.q) {
      const q = invF.q.toLowerCase();
      if ((inv.invNo + ' ' + clientName(db, inv.clientId)).toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  };
  const totalInvCount = db.invoices.length;
  const invList = db.invoices.slice().filter(invMatches).sort((a, b) => {
    const d = String(a.date) < String(b.date) ? -1 : (String(a.date) > String(b.date) ? 1 : 0);
    return invF.sort === 'asc' ? d : -d;
  });
  const invListTotal = sum(invList, i => i.total);
  const invListPaid = sum(invList, i => invPaid(db, i));
  const invListOut = invListTotal - invListPaid;

  const makeInvoice = (b) => {
    const c = byId(db.clients, b.clientId) || { creditDays: 30 };
    setForm({
      title: 'Create Invoice — ' + b.bkNo,
      fields: [
        { key: 'date', label: 'Invoice Date', type: 'date', required: true, value: todayISO() },
        { key: 'amount', label: 'Taxable Amount ₹', type: 'number', required: true, value: b.freight },
        {
          key: 'gstPct', label: 'GST %', type: 'select', required: true, value: '0',
          options: [{ v: '0', l: '0% RCM' }, { v: '5', l: '5% FCM no ITC' }, { v: '12', l: '12% FCM + ITC' }, { v: '18', l: '18%' }],
          hint: 'GTA taxation — confirm the applicable option with your CA'
        },
        { key: 'notes', label: 'Notes', type: 'multiline' }
      ],
      onSubmit: (v) => {
        const amt = Number(v.amount) || 0, g = Number(v.gstPct) || 0;
        const total = Math.round(amt * (1 + g / 100) * 100) / 100;
        const cg = creditGuard(db, b.clientId, total);
        const proceed = () => update(d => {
          const inv = {
            id: uid('i'), invNo: 'INV-' + String(d.seq.inv).padStart(4, '0'), date: v.date, branchId: b.branchId || (d.branches[0] || {}).id, clientId: b.clientId,
            bookingIds: [b.id], amount: amt, gstPct: g, total, dueDate: addDaysISO(Number(c.creditDays) || 30), notes: v.notes
          };
          d.seq.inv++; d.invoices.push(inv);
          const x = byId(d.bookings, b.id); if (x) { x.invoiceId = inv.id; x.status = 'Invoiced'; }
          if (!cg.ok) logAudit(d, 'creditlimit.override', 'Invoice for ' + clientName(d, b.clientId) + ' created over credit limit — exposure ' + inr(cg.projected) + ' / limit ' + inr(cg.limit) + '.');
        });
        if (!cg.ok) {
          alert('Credit Limit Warning', cg.message + '\n\nProceed anyway and create this invoice?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Proceed Anyway', style: 'destructive', onPress: proceed }
          ]);
        } else proceed();
      }
    });
  };

  const recordPayment = (inv) => setForm({
    title: 'Record Payment — ' + inv.invNo,
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
      { key: 'amount', label: 'Amount ₹', type: 'number', required: true, value: invOutstanding(db, inv) },
      { key: 'mode', label: 'Mode', type: 'select', required: true, value: 'NEFT/RTGS', options: ['NEFT/RTGS', 'UPI', 'Cheque', 'Cash', 'Other'].map(x => ({ v: x, l: x })) },
      { key: 'ref', label: 'UTR / Cheque Ref' }
    ],
    onSubmit: (v) => update(d => {
      const target = byId(d.invoices, inv.id); if (!target) return;
      d.payments.push({ id: uid('p'), invoiceId: inv.id, date: v.date, amount: Number(v.amount) || 0, mode: v.mode, ref: v.ref });
      const paid = sum(d.payments.filter(p => p.invoiceId === inv.id), p => p.amount);
      if ((Number(target.total) || 0) - paid <= 0.01) {
        (target.bookingIds || []).forEach(bid => { const b = byId(d.bookings, bid); if (b) b.status = 'Paid'; });
      }
    })
  });

  const emailRemind = (inv, out) => {
    const c = byId(db.clients, inv.clientId);
    if (!c || !c.email) { alert('No email', 'Add an email address for this client in Masters.'); return; }
    const body = 'Dear Sir/Madam,\n\nThis is a gentle reminder that Invoice ' + inv.invNo + ' dated ' + fmtDate(inv.date) + ' has an outstanding amount of ' + inr(out) + '.\n\nKindly arrange payment at the earliest.\n\nRegards,\nBaroda Goods Transport Service Pvt. Ltd.';
    Linking.openURL(mailLink(c.email, 'Payment Reminder — ' + inv.invNo, body)).catch(() => alert('Error', 'Could not open mail app.'));
  };

  const exportInvCsv = async () => {
    try {
      const rows = [['Invoice', 'Date', 'Client', 'Taxable', 'GST %', 'Total', 'Paid', 'Outstanding', 'Due Date', 'Age Days']];
      db.invoices.forEach(inv => rows.push([inv.invNo, inv.date, clientName(db, inv.clientId), inv.amount, inv.gstPct, inv.total, invPaid(db, inv), invOutstanding(db, inv), inv.dueDate, daysSince(inv.date)]));
      await downloadFile('BGTS_Receivables.csv', csvString(rows), 'text/csv');
    } catch (e) { alert('Error', String(e.message || e)); }
  };

  const exportExpCsv = async () => {
    try {
      const rows = [['Date', 'Account', 'Amount', 'Paid Through', 'Vendor', 'Ref', 'Notes']];
      db.acctExp.forEach(e => rows.push([e.date, e.account, e.amount, e.paidThrough, e.vendor, e.ref, e.notes]));
      await downloadFile('BGTS_Business_Expenses.csv', csvString(rows), 'text/csv');
    } catch (e) { alert('Error', String(e.message || e)); }
  };

  const printReceipt = async (p) => {
    try {
      const logoUri = await getLogoDataUri();
      await printHtml(receiptHtml(db, p, logoUri), p.mrNo);
    } catch (e) { alert('Error', String(e.message || e)); }
  };

  const recordPaymentPick = () => {
    const open = db.invoices.filter(i => invOutstanding(db, i) > 0);
    if (!open.length) { alert('No open invoices.'); return; }
    setForm({
      title: 'Record Payment',
      fields: [
        { key: 'invoiceId', label: 'Against Invoice', type: 'select', required: true, value: open[0].id, options: open.map(i => ({ v: i.id, l: i.invNo + ' — ' + clientName(db, i.clientId) + ' — ' + inr(invOutstanding(db, i)) + ' due' })) },
        { key: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
        { key: 'amount', label: 'Amount ₹', type: 'number', required: true },
        { key: 'mode', label: 'Mode', type: 'select', required: true, value: 'NEFT/RTGS', options: ['NEFT/RTGS', 'UPI', 'Cheque', 'Cash', 'Other'].map(x => ({ v: x, l: x })) },
        { key: 'ref', label: 'UTR / Cheque Ref' }
      ],
      onSubmit: (v) => update(d => {
        const inv = byId(d.invoices, v.invoiceId); if (!inv) return;
        d.payments.push({ id: uid('p'), mrNo: 'MR-' + String(d.seq.mr).padStart(4, '0'), invoiceId: inv.id, date: v.date, amount: Number(v.amount) || 0, mode: v.mode, ref: v.ref });
        d.seq.mr++;
        const paid = sum(d.payments.filter(p => p.invoiceId === inv.id), p => p.amount);
        if ((Number(inv.total) || 0) - paid <= 0.01) {
          (inv.bookingIds || []).forEach(bid => { const b = byId(d.bookings, bid); if (b) b.status = 'Paid'; });
        }
      })
    });
  };

  const delPayment = (p) => confirmDo('Delete this payment? The linked invoice/booking status will be recalculated.', () => update(d => {
    removeById(d.payments, p.id);
    const inv = byId(d.invoices, p.invoiceId);
    if (inv) {
      const stillPaid = sum(d.payments.filter(pp => pp.invoiceId === inv.id), pp => pp.amount);
      const out = (Number(inv.total) || 0) - stillPaid;
      if (out > 0.01) {
        (inv.bookingIds || []).forEach(bid => { const bk = byId(d.bookings, bid); if (bk && bk.status === 'Paid') bk.status = 'Invoiced'; });
      }
    }
    logAudit(d, 'payment.delete', 'Deleted payment ' + (p.mrNo || p.id) + ' (' + inr(p.amount) + ')' + (inv ? ' against ' + inv.invNo : '') + '.');
  }));

  const delInvoice = (inv) => confirmDo('Delete invoice? Linked bookings revert to Delivered.', () => update(d => {
    const x = byId(d.invoices, inv.id);
    if (x) { (x.bookingIds || []).forEach(bid => { const b = byId(d.bookings, bid); if (b) { b.invoiceId = ''; b.status = 'Delivered'; } }); }
    d.payments = d.payments.filter(p => p.invoiceId !== inv.id);
    removeById(d.invoices, inv.id);
  }));

  const addBizExpense = () => setForm({
    title: 'Record Business Expense',
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
      { key: 'branchId', label: 'Branch', type: 'select', required: true, value: (db.branches[0] || {}).id, options: (db.branches || []).map(x => ({ v: x.id, l: x.name })) },
      { key: 'account', label: 'Account Head', type: 'select', required: true, value: 'Other Expenses', options: EXP_HEADS.map(x => ({ v: x, l: x })) },
      { key: 'amount', label: 'Amount ₹', type: 'number', required: true },
      { key: 'paidThrough', label: 'Paid Through', type: 'select', required: true, value: PAY_THROUGH[0], options: PAY_THROUGH.map(x => ({ v: x, l: x })) },
      { key: 'vendor', label: 'Vendor / Paid To' },
      { key: 'ref', label: 'Bill / Ref No.' },
      { key: 'notes', label: 'Notes', type: 'multiline' }
    ],
    onSubmit: (v) => update(d => {
      d.acctExp.push({ id: uid('ax'), branchId: v.branchId, date: v.date, account: v.account, amount: Number(v.amount) || 0, paidThrough: v.paidThrough, vendor: v.vendor, ref: v.ref, notes: v.notes, src: 'manual' });
    })
  });

  /* ---------- Monthly Fixed Expenses ---------- */
  const fixedExpFields = (fe) => [
    { key: 'head', label: 'Expense Head', required: true, value: fe && fe.head },
    { key: 'category', label: 'Category', type: 'select', required: true, value: (fe && fe.category) || 'Salary', options: ['Salary', 'Rent', 'Vehicle EMI', 'Admin/Office', 'Utilities', 'Insurance', 'Other'].map(x => ({ v: x, l: x })) },
    { key: 'amount', label: 'Amount (₹) — ignored if Vehicle EMI is linked to a vehicle', type: 'number', value: fe && fe.amount },
    { key: 'linkedVehicleId', label: 'Linked Vehicle (Vehicle EMI only)', type: 'select', value: fe && fe.linkedVehicleId, options: db.vehicles.filter(x => x.owned).map(x => ({ v: x.id, l: x.regNo })) },
    { key: 'active', label: 'Active', type: 'select', value: fe && fe.active === false ? 'no' : 'yes', options: [{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }] },
    { key: 'notes', label: 'Notes', type: 'multiline', value: fe && fe.notes }
  ];
  const addFixedExp = () => setForm({
    title: 'Add Fixed Expense', fields: fixedExpFields(null),
    onSubmit: v => update(d => {
      d.fixedExp = d.fixedExp || [];
      d.fixedExp.push({ id: uid('fx'), head: v.head, category: v.category, amount: Number(v.amount) || 0, linkedVehicleId: v.linkedVehicleId, frequency: 'Monthly', active: v.active !== 'no', notes: v.notes });
    })
  });
  const editFixedExp = (fe) => setForm({
    title: 'Edit Fixed Expense', fields: fixedExpFields(fe),
    onSubmit: v => update(d => {
      const x = byId(d.fixedExp, fe.id);
      if (x) { x.head = v.head; x.category = v.category; x.amount = Number(v.amount) || 0; x.linkedVehicleId = v.linkedVehicleId; x.active = v.active !== 'no'; x.notes = v.notes; }
    })
  });

  /* ---------- Cashflow / Working Capital — lenders ---------- */
  const lenderFields = (ln) => [
    { key: 'name', label: 'Lender Name', required: true, value: ln && ln.name },
    { key: 'type', label: 'Type', type: 'select', required: true, value: (ln && ln.type) || 'Bank', options: ['Bank', 'NBFC', 'Vehicle Financier', 'Other'].map(x => ({ v: x, l: x })) },
    { key: 'sanctionedAmount', label: 'Sanctioned Amount (₹)', type: 'number', value: ln && ln.sanctionedAmount },
    { key: 'outstandingAmount', label: 'Outstanding Amount (₹)', type: 'number', value: ln && ln.outstandingAmount },
    { key: 'interestRate', label: 'Interest Rate (%)', type: 'number', value: ln && ln.interestRate },
    { key: 'emiAmount', label: 'EMI Amount (₹)', type: 'number', value: ln && ln.emiAmount },
    { key: 'nextDueDate', label: 'Next Due Date', type: 'date', value: ln && ln.nextDueDate },
    { key: 'tenureMonths', label: 'Tenure (months)', type: 'number', value: ln && ln.tenureMonths },
    { key: 'notes', label: 'Notes', type: 'multiline', value: ln && ln.notes }
  ];
  const addLender = () => setForm({
    title: 'Add Lender', fields: lenderFields(null),
    onSubmit: v => update(d => {
      d.lenders = d.lenders || [];
      d.lenders.push({ id: uid('ln'), name: v.name, type: v.type, sanctionedAmount: Number(v.sanctionedAmount) || 0, outstandingAmount: Number(v.outstandingAmount) || 0, interestRate: Number(v.interestRate) || 0, emiAmount: Number(v.emiAmount) || 0, nextDueDate: v.nextDueDate, tenureMonths: Number(v.tenureMonths) || 0, notes: v.notes });
    })
  });
  const editLender = (ln) => setForm({
    title: 'Edit Lender', fields: lenderFields(ln),
    onSubmit: v => update(d => {
      const x = byId(d.lenders, ln.id);
      if (x) { x.name = v.name; x.type = v.type; x.sanctionedAmount = Number(v.sanctionedAmount) || 0; x.outstandingAmount = Number(v.outstandingAmount) || 0; x.interestRate = Number(v.interestRate) || 0; x.emiAmount = Number(v.emiAmount) || 0; x.nextDueDate = v.nextDueDate; x.tenureMonths = Number(v.tenureMonths) || 0; x.notes = v.notes; }
    })
  });

  const curMonth = todayISO().slice(0, 7);
  const cashInList = db.payments.filter(p => String(p.date).slice(0, 7) === curMonth);
  const cashIn = sum(cashInList, p => p.amount);
  const fixedTotal = sum((db.fixedExp || []).filter(fe => fe.active !== false), fe => fixedExpAmount(db, fe));
  const lenderEmiTotal = sum(db.lenders || [], ln => ln.emiAmount);
  const periodAcctExp = sum(db.acctExp.filter(e => String(e.date).slice(0, 7) === curMonth), e => e.amount);
  const periodFleetExp = sum(db.expenses.filter(e => String(e.date).slice(0, 7) === curMonth), e => e.amount);
  const cashOut = fixedTotal + lenderEmiTotal + periodAcctExp + periodFleetExp;
  const netWC = cashIn - cashOut;
  const totalReceivables = sum(db.invoices, i => invOutstanding(db, i));
  const totalLenderOutstanding = sum(db.lenders || [], ln => ln.outstandingAmount);

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={[S.wrapRow, { marginBottom: 14 }]}>
        {ACC_TABS.map(([id, label]) => (
          <TouchableOpacity key={id} onPress={() => pressAccTab(id)} style={{
            backgroundColor: accTab === id ? C.navy : '#fff', borderWidth: 1, borderColor: accTab === id ? C.navy : C.line2,
            borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6
          }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: accTab === id ? '#fff' : C.txt }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {accTab === 'receivables' && uninv.length ? (
        <Card title="Ready to Invoice">
          <Table
            cols={[
              { key: 'bkNo', label: 'Bk No', width: 90 },
              { key: 'client', label: 'Client', width: 150 },
              { key: 'route', label: 'Route', width: 160 },
              { key: 'freight', label: 'Freight', width: 90 },
              { key: 'pod', label: 'POD', width: 90 },
              { key: 'actions', label: '', width: 100 }
            ]}
            rows={uninv.map(b => ({
              bkNo: <Text style={{ fontWeight: '700', color: C.navy }}>{b.bkNo}</Text>,
              client: clientName(db, b.clientId),
              route: b.origin + ' → ' + b.destination,
              freight: inr(b.freight),
              pod: b.podReceived ? <Badge text="✓" tone="green" /> : <Badge text="Pending" tone="amber" />,
              actions: <Btn small tone="amber" label="Create Invoice" onPress={() => makeInvoice(b)} />
            }))}
          />
        </Card>
      ) : null}

      {accTab === 'receivables' ? (
      <Card title="Invoices & Receivables Ageing"
        right={
          <View style={S.wrapRow}>
            <Btn small tone="ghost" label="Export CSV" onPress={exportInvCsv} />
            <Btn small label="⬆ Import Invoices CSV / Excel" onPress={() => navigation.navigate('InvoiceImport')} />
          </View>
        }>
        <View style={{
          flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end',
          backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, marginBottom: 14
        }}>
          <FilterField label="From Date"><DatePicker value={invF.from} onChange={v => setIF('from', v)} /></FilterField>
          <FilterField label="To Date"><DatePicker value={invF.to} onChange={v => setIF('to', v)} /></FilterField>
          <FilterField label="Company">
            <PickerField value={invF.clientId} onChange={v => setIF('clientId', v)} placeholder="All Companies"
              options={[{ v: '', l: 'All Companies' }, ...db.clients.map(c => ({ v: c.id, l: c.name }))]} />
          </FilterField>
          <FilterField label="Location / Hub (Branch)">
            <PickerField value={invF.branchId} onChange={v => setIF('branchId', v)} placeholder="All Locations"
              options={[{ v: '', l: 'All Locations' }, ...(db.branches || []).map(b => ({ v: b.id, l: b.name }))]} />
          </FilterField>
          <FilterField label="Date Order">
            <PickerField value={invF.sort} onChange={v => setIF('sort', v)}
              options={[{ v: 'desc', l: 'Newest first (descending)' }, { v: 'asc', l: 'Oldest first (ascending)' }]} />
          </FilterField>
          <FilterField label="Search (Invoice No / Company)" grow>
            <TextInput value={invF.q} onChangeText={v => setIF('q', v)} placeholder="Type to search…" placeholderTextColor={C.mut}
              style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 7, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: C.txt }} />
          </FilterField>
          <Btn small tone="ghost" label="Reset" onPress={resetInvFilter} />
        </View>
        {!invList.length ? (
          <Empty text={totalInvCount ? 'No invoices match this search.' : 'No invoices raised yet.'} />
        ) : (<>
          <Text style={{ fontSize: 11.5, color: C.mut, marginBottom: 8 }}>
            {invList.length} invoice(s) · Turnover {inr(invListTotal)} · Payment Receipt {inr(invListPaid)} · Outstanding {inr(invListOut)}
          </Text>
          <Table
            cols={[
              { key: 'invoice', label: 'Invoice', width: 100 },
              { key: 'date', label: 'Date', width: 80 },
              { key: 'client', label: 'Client', width: 140 },
              { key: 'total', label: 'Total', width: 90 },
              { key: 'paid', label: 'Paid', width: 90 },
              { key: 'outstanding', label: 'Outstanding', width: 100 },
              { key: 'age', label: 'Age (days)', width: 80 },
              { key: 'bucket', label: 'Bucket', width: 90 },
              { key: 'actions', label: 'Actions', width: 340 }
            ]}
            rows={invList.map(inv => {
              const out = invOutstanding(db, inv), age = daysSince(inv.date);
              return {
                invoice: <Text style={{ fontWeight: '700', color: C.navy }}>{inv.invNo}</Text>,
                date: fmtDate(inv.date),
                client: clientName(db, inv.clientId),
                total: inr(inv.total),
                paid: inr(invPaid(db, inv)),
                outstanding: <Text style={{ fontWeight: '800', color: out > 0 ? C.red : C.green }}>{inr(out)}</Text>,
                age: age + 'd',
                bucket: (
                  <Badge
                    text={out <= 0 ? 'PAID' : age <= 30 ? '0–30d' : age <= 60 ? '31–60d' : age <= 90 ? '61–90d' : '90+d'}
                    tone={out <= 0 ? 'green' : age <= 30 ? 'green' : age <= 60 ? 'amber' : 'red'} />
                ),
                actions: (
                  <View style={S.wrapRow}>
                    {out > 0 ? <Btn small tone="green" label="+ Payment" onPress={() => recordPayment(inv)} /> : null}
                    {out > 0 ? <Btn small tone="ghost" label="Email" onPress={() => emailRemind(inv, out)} /> : null}
                    <Btn small tone="red" label="✕" onPress={() => delInvoice(inv)} />
                  </View>
                )
              };
            })}
          />
        </>)}
      </Card>
      ) : null}

      {accTab === 'expenses' ? (
      <Card title="Business Expenses (Zoho-style account heads)"
        right={<View style={S.wrapRow}><Btn small tone="ghost" label="Export CSV" onPress={exportExpCsv} /><Btn small tone="amber" label="+ Record Expense" onPress={addBizExpense} /></View>}>
        {!db.acctExp.length ? <Text style={S.empty}>No expenses yet. LR expenses post here automatically.</Text> : (
          <Table
            cols={[
              { key: 'date', label: 'Date', width: 80 },
              { key: 'account', label: 'Account', width: 150 },
              { key: 'amount', label: 'Amount', width: 90 },
              { key: 'paidThrough', label: 'Paid Through', width: 120 },
              { key: 'vendor', label: 'Vendor', width: 120 },
              { key: 'ref', label: 'Ref', width: 100 },
              { key: 'notes', label: 'Notes', width: 130 },
              { key: 'actions', label: '', width: 60 }
            ]}
            rows={db.acctExp.slice().reverse().slice(0, 15).map(e => ({
              date: fmtDate(e.date),
              account: <Text style={{ fontWeight: '700', color: C.navy }}>{e.account}</Text>,
              amount: inr(e.amount),
              paidThrough: e.paidThrough || '—',
              vendor: e.vendor || '—',
              ref: e.ref || '—',
              notes: e.notes || '—',
              actions: <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete expense entry?', () => update(d => removeById(d.acctExp, e.id)))} />
            }))}
          />
        )}
      </Card>
      ) : null}

      {accTab === 'payments' && (db.payments.length || db.invoices.some(i => invOutstanding(db, i) > 0)) ? (
        <Card title="Payments Received"
          right={db.invoices.some(i => invOutstanding(db, i) > 0) ? <Btn small tone="amber" label="+ Record Payment" onPress={recordPaymentPick} /> : null}>
          {!db.payments.length ? <Empty text="No payments recorded yet." /> : (
            <Table
              cols={[
                { key: 'receipt', label: 'Receipt', width: 100 },
                { key: 'date', label: 'Date', width: 80 },
                { key: 'invoice', label: 'Invoice', width: 100 },
                { key: 'client', label: 'Client', width: 140 },
                { key: 'amount', label: 'Amount', width: 90 },
                { key: 'mode', label: 'Mode', width: 100 },
                { key: 'ref', label: 'Ref', width: 100 },
                { key: 'actions', label: '', width: 170 }
              ]}
              rows={db.payments.slice().reverse().map(p => {
                const inv = byId(db.invoices, p.invoiceId) || {};
                return {
                  receipt: <Text style={{ fontWeight: '700', color: C.navy }}>{p.mrNo || '—'}</Text>,
                  date: fmtDate(p.date),
                  invoice: inv.invNo || '—',
                  client: clientName(db, inv.clientId),
                  amount: <Text style={{ fontWeight: '700', color: C.navy }}>{inr(p.amount)}</Text>,
                  mode: p.mode,
                  ref: p.ref || '—',
                  actions: (
                    <View style={S.wrapRow}>
                      <Btn small tone="ghost" label="Print Receipt" onPress={() => printReceipt(p)} />
                      <Btn small tone="red" label="✕" onPress={() => delPayment(p)} />
                    </View>
                  )
                };
              })}
            />
          )}
        </Card>
      ) : null}

      {accTab === 'customers' ? (
      <Card title="Customer Ledger — Company-wise Turnover & Payment Receipt">
        {!db.clients.length ? <Empty text="No clients." /> : (
          <Table
            cols={[
              { key: 'client', label: 'Client', width: 160 },
              { key: 'invoiced', label: 'Total Turnover', width: 100 },
              { key: 'received', label: 'Payment Receipt', width: 100 },
              { key: 'outstanding', label: 'Outstanding', width: 100 },
              { key: 'exposure', label: 'Exposure', width: 100 },
              { key: 'creditLimit', label: 'Credit Limit', width: 100 },
              { key: 'creditDays', label: 'Credit Days', width: 90 },
              { key: 'oldest', label: 'Oldest Due', width: 130 },
              { key: 'actions', label: '', width: 90 }
            ]}
            rows={db.clients.map(c => {
              const invs = db.invoices.filter(i => i.clientId === c.id);
              const invoiced = sum(invs, i => i.total);
              const received = sum(invs, i => invPaid(db, i));
              const out = invoiced - received;
              const exposure = clientExposure(db, c.id);
              const limit = Number(c.creditLimit) || 0;
              let oldest = null;
              invs.forEach(i => { if (invOutstanding(db, i) > 0) { const a = daysSince(i.date); if (oldest == null || a > oldest) oldest = a; } });
              return {
                client: <Text style={{ fontWeight: '700', color: C.navy }}>{c.name}</Text>,
                invoiced: inr(invoiced),
                received: inr(received),
                outstanding: <Text style={{ fontWeight: '800', color: out > 0 ? C.red : C.green }}>{inr(out)}</Text>,
                exposure: <Text style={{ fontWeight: '700', color: limit > 0 && exposure > limit ? C.red : C.txt }}>{inr(exposure)}</Text>,
                creditLimit: limit > 0 ? inr(limit) : 'No limit',
                creditDays: c.creditDays || '—',
                oldest: oldest == null ? '—' : (
                  <View>
                    <Text style={{ fontSize: 12, color: C.txt }}>{oldest} days</Text>
                    {oldest > 60 ? <Badge text="60+ TRIGGER" tone="red" /> : null}
                  </View>
                ),
                actions: <Btn small label="Open →" onPress={() => navigation.navigate('Company', { clientId: c.id })} />
              };
            })}
          />
        )}
      </Card>
      ) : null}

      {accTab === 'fixedexp' ? (
      <Card title="Monthly Fixed Expenses" right={<Btn small tone="amber" label="+ Add Fixed Expense" onPress={addFixedExp} />}>
        {!(db.fixedExp || []).length ? <Empty text="No fixed expense heads yet." /> : (<>
          <Table
            cols={[
              { key: 'head', label: 'Head', width: 150 },
              { key: 'category', label: 'Category', width: 120 },
              { key: 'amount', label: 'Amount', width: 100 },
              { key: 'vehicle', label: 'Linked Vehicle', width: 120 },
              { key: 'active', label: 'Active', width: 70 },
              { key: 'notes', label: 'Notes', width: 130 },
              { key: 'actions', label: '', width: 120 }
            ]}
            rows={db.fixedExp.map(fe => {
              const amt = fixedExpAmount(db, fe);
              return {
                head: <Text style={{ fontWeight: '700', color: C.navy }}>{fe.head}</Text>,
                category: fe.category,
                amount: (
                  <View style={S.wrapRow}>
                    <Text style={{ fontWeight: '700', color: C.navy }}>{inr(amt)}</Text>
                    {fe.category === 'Vehicle EMI' && fe.linkedVehicleId ? <Badge text="AUTO (VEHICLE)" tone="navy" /> : null}
                  </View>
                ),
                vehicle: fe.linkedVehicleId ? vehicleReg(db, fe.linkedVehicleId) : '—',
                active: fe.active !== false ? 'Yes' : 'No',
                notes: fe.notes || '—',
                actions: (
                  <View style={S.wrapRow}>
                    <Btn small tone="ghost" label="Edit" onPress={() => editFixedExp(fe)} />
                    <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete fixed expense head?', () => update(d => removeById(d.fixedExp, fe.id)))} />
                  </View>
                )
              };
            })}
          />
          <Text style={{ fontSize: 12.5, fontWeight: '800', color: C.navy, marginTop: 10 }}>
            Total Monthly Fixed Outflow (active): {inr(fixedTotal)}
          </Text>
        </>)}
      </Card>
      ) : null}

      {accTab === 'cashflow' ? (<>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Kpi label={'Cash In (Realized, ' + curMonth + ')'} value={inr(cashIn)} sub={cashInList.length + ' receipts'} tone="green" />
          <Kpi label={'Cash Out (Committed, ' + curMonth + ')'} value={inr(cashOut)} sub="fixed + lender EMI + expenses" tone="amber" />
          <Kpi label="Net Working Capital Movement" value={inr(netWC)} sub="cash in − cash out" tone={netWC >= 0 ? 'green' : 'red'} />
          <Kpi label="Total Receivables Outstanding" value={inr(totalReceivables)} sub="across all invoices" tone="amber" />
          <Kpi label="Total Lender Outstanding" value={inr(totalLenderOutstanding)} sub={(db.lenders || []).length + ' lenders'} />
        </View>

        <Card title="Debt Service Calendar">
          {!(db.lenders || []).length ? <Empty text="No lenders on record." /> : (
            <Table
              cols={[
                { key: 'name', label: 'Lender', width: 140 },
                { key: 'type', label: 'Type', width: 110 },
                { key: 'emi', label: 'EMI Amount', width: 100 },
                { key: 'due', label: 'Next Due', width: 130 },
                { key: 'out', label: 'Outstanding', width: 100 },
                { key: 'actions', label: '', width: 120 }
              ]}
              rows={db.lenders.slice().sort((a, b) => String(a.nextDueDate || '9999').localeCompare(String(b.nextDueDate || '9999'))).map(ln => {
                const dLeft = daysTo(ln.nextDueDate);
                const soon = dLeft != null && dLeft <= 7;
                return {
                  name: <Text style={{ fontWeight: '700', color: C.navy }}>{ln.name}</Text>,
                  type: ln.type,
                  emi: inr(ln.emiAmount),
                  due: (
                    <View style={S.wrapRow}>
                      <Text>{ln.nextDueDate ? fmtDate(ln.nextDueDate) : '—'}</Text>
                      {soon ? <Badge text="DUE ≤7d" tone="red" /> : null}
                    </View>
                  ),
                  out: inr(ln.outstandingAmount),
                  actions: (
                    <View style={S.wrapRow}>
                      <Btn small tone="ghost" label="Edit" onPress={() => editLender(ln)} />
                      <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete lender record?', () => update(d => removeById(d.lenders, ln.id)))} />
                    </View>
                  )
                };
              })}
            />
          )}
        </Card>

        <Card title="Lender Register" right={<Btn small tone="amber" label="+ Add Lender" onPress={addLender} />}>
          <Text style={{ fontSize: 11, color: C.mut }}>
            Add banks, NBFCs and vehicle financiers here to drive the Debt Service Calendar and Working Capital snapshot above.
          </Text>
        </Card>
      </>) : null}

      {accTab === 'auditlog' ? (
      <Card title="Audit Log">
        {!(db.auditLog || []).length ? <Empty text="No audit entries yet." /> : (
          <Table
            cols={[
              { key: 'ts', label: 'Timestamp', width: 160 },
              { key: 'action', label: 'Action', width: 160 },
              { key: 'details', label: 'Details', width: 280 }
            ]}
            rows={db.auditLog.slice().sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || ''))).map(a => ({
              ts: a.ts ? new Date(a.ts).toLocaleString() : '—',
              action: <Text style={{ fontWeight: '700', color: C.navy }}>{a.action}</Text>,
              details: a.details || '—'
            }))}
          />
        )}
      </Card>
      ) : null}
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
