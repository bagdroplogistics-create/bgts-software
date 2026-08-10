import React, { useState } from 'react';
import { View, Text, ScrollView, Linking, TextInput, TouchableOpacity } from 'react-native';
import { useStore } from '../store';
import { downloadFile, printHtml } from '../fileIO';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo, Table, alert, PickerField, DatePicker } from '../ui';
import {
  uid, inr, sum, fmtDate, todayISO, addDaysISO, daysSince, byId, removeById,
  clientName, invPaid, invOutstanding, mailLink, EXP_HEADS, PAY_THROUGH,
  csvString, receiptHtml
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
  ['backup', 'Invoice Backup (Register)']
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
      onSubmit: (v) => update(d => {
        const amt = Number(v.amount) || 0, g = Number(v.gstPct) || 0;
        const total = Math.round(amt * (1 + g / 100) * 100) / 100;
        const inv = {
          id: uid('i'), invNo: 'INV-' + String(d.seq.inv).padStart(4, '0'), date: v.date, branchId: b.branchId || (d.branches[0] || {}).id, clientId: b.clientId,
          bookingIds: [b.id], amount: amt, gstPct: g, total, dueDate: addDaysISO(Number(c.creditDays) || 30), notes: v.notes
        };
        d.seq.inv++; d.invoices.push(inv);
        const x = byId(d.bookings, b.id); if (x) { x.invoiceId = inv.id; x.status = 'Invoiced'; }
      })
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
      await printHtml(receiptHtml(db, p), p.mrNo);
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
                { key: 'actions', label: '', width: 110 }
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
                  actions: <Btn small tone="ghost" label="Print Receipt" onPress={() => printReceipt(p)} />
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
              { key: 'creditDays', label: 'Credit Days', width: 90 },
              { key: 'oldest', label: 'Oldest Due', width: 130 },
              { key: 'actions', label: '', width: 90 }
            ]}
            rows={db.clients.map(c => {
              const invs = db.invoices.filter(i => i.clientId === c.id);
              const invoiced = sum(invs, i => i.total);
              const received = sum(invs, i => invPaid(db, i));
              const out = invoiced - received;
              let oldest = null;
              invs.forEach(i => { if (invOutstanding(db, i) > 0) { const a = daysSince(i.date); if (oldest == null || a > oldest) oldest = a; } });
              return {
                client: <Text style={{ fontWeight: '700', color: C.navy }}>{c.name}</Text>,
                invoiced: inr(invoiced),
                received: inr(received),
                outstanding: <Text style={{ fontWeight: '800', color: out > 0 ? C.red : C.green }}>{inr(out)}</Text>,
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
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
