import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, Logo, Table, RenewalsTable } from '../ui';
import {
  inr, sum, pad, todayISO, invOutstanding, invPaid, riskFlags, allRenewalItems,
  fmtDate, daysSince, daysTo, lrHireBalance, clientName, vehicleReg, vendorName, ageingBuckets
} from '../logic';

/* ---------- helpers ported from the HTML build (vDashboard) ---------- */
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function last6Months() {
  const out = [], d = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({ key: m.getFullYear() + '-' + pad(m.getMonth() + 1), label: MN[m.getMonth()] });
  }
  return out;
}
const PERIODS = [['mtd', 'This Month'], ['lastm', 'Last Month'], ['3m', '3 Months'], ['fy', 'This FY'], ['all', 'All Time']];
function dashRange(period) {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth();
  const iso = dt => dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  if (period === 'mtd') return { from: y + '-' + pad(m + 1) + '-01', to: '9999', label: 'This Month' };
  if (period === 'lastm') { const s = new Date(y, m - 1, 1), e = new Date(y, m, 0); return { from: iso(s), to: iso(e), label: 'Last Month' }; }
  if (period === '3m') { const s3 = new Date(y, m - 2, 1); return { from: iso(s3), to: '9999', label: 'Last 3 Months' }; }
  if (period === 'fy') { const fyStart = (m >= 3) ? (y + '-04-01') : ((y - 1) + '-04-01'); return { from: fyStart, to: '9999', label: 'This FY' }; }
  return { from: '0000', to: '9999', label: 'All Time' };
}

/* ---------- shared bits (kept local to this screen only) ---------- */
function KpiTile({ label, value, sub, tone, onPress, width, marginRight }) {
  const top = tone === 'red' ? C.red : tone === 'amber' ? C.amber : tone === 'green' ? C.green : C.navy3;
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress} style={{
      width, marginRight, marginBottom: 10, backgroundColor: '#fff', borderRadius: 10,
      borderWidth: 1, borderColor: C.line, borderTopWidth: 3, borderTopColor: top, padding: 12
    }}>
      <Text style={{ fontSize: 10.5, fontWeight: '700', color: C.mut, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: '800', color: C.navy, marginTop: 4 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 2 }} numberOfLines={1}>{sub}</Text> : null}
    </Wrap>
  );
}

function KpiRow({ items }) {
  const [w, setW] = useState(0);
  const cols = w ? Math.max(2, Math.min(5, Math.floor(w / 170))) : 2;
  const gap = 10;
  const tileW = w ? (w - gap * (cols - 1)) / cols : undefined;
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {items.map((it, i) => (
        <KpiTile key={i} {...it} width={tileW} marginRight={(i % cols === cols - 1) ? 0 : gap} />
      ))}
    </View>
  );
}

function Bars({ items, fmt }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <View>
      {items.map((it, idx) => {
        const Row = it.onPress ? TouchableOpacity : View;
        return (
          <Row key={idx} onPress={it.onPress} style={{ marginBottom: 8 }}>
            <View style={[S.row, { justifyContent: 'space-between' }]}>
              <Text style={{ fontSize: 11.5, fontWeight: '600', color: C.txt }}>{it.label}</Text>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: C.navy }}>{fmt ? fmt(it.value) : it.value}</Text>
            </View>
            <View style={{ backgroundColor: C.line, borderRadius: 5, height: 12, marginTop: 3, overflow: 'hidden' }}>
              <View style={{ backgroundColor: it.color || C.navy3, height: 12, width: Math.max(Math.round(it.value / max * 100), 1) + '%' }} />
            </View>
          </Row>
        );
      })}
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { db } = useStore();
  const [period, setPeriod] = useState('mtd');
  const [flagsOpen, setFlagsOpen] = useState(false);

  const R = dashRange(period);
  const inR = dt => dt >= R.from && dt <= R.to;

  const active = db.bookings.filter(b => b.status !== 'Delivered' && b.status !== 'Paid').length;
  const lrGrossPeriod = sum(db.lrs.filter(l => inR(l.date)), l => l.gross);
  const lrGrossTotal = sum(db.lrs, l => l.gross);
  const collectedPeriod = sum(db.payments.filter(p => inR(p.date)), p => p.amount);
  const outstanding = sum(db.invoices, i => invOutstanding(db, i));
  const hiredLRs = db.lrs.filter(l => l.ownership === 'Hired');
  const ownedLRs = db.lrs.filter(l => l.ownership !== 'Hired');
  const hireBalTotal = sum(hiredLRs, l => Math.max(lrHireBalance(l), 0));
  const hireMargin = sum(hiredLRs, l => (Number(l.gross) || 0) - (Number((l.hire || {}).amount) || 0));
  const due30 = allRenewalItems(db).filter(r => r.days != null && r.days <= 30).length;
  const owned = db.vehicles.filter(v => v.owned);
  const busy = owned.filter(v => db.bookings.some(b => b.vehicleId === v.id && (b.status === 'Vehicle Assigned' || b.status === 'In Transit'))).length;
  const util = owned.length ? Math.round(busy / owned.length * 100) : 0;
  const pendingInv = db.bookings.filter(b => b.status === 'Delivered' && !b.invoiceId).length;
  const podPending = db.lrs.filter(l => !l.pod).length;
  const flags = riskFlags(db);
  const invoiced = sum(db.invoices, i => i.total);

  const kpis = [
    { label: 'Total Revenue (Invoiced, All-Time)', value: inr(invoiced), sub: db.invoices.length + ' invoices raised', tone: 'green', onPress: () => navigation.navigate('Accounting') },
    { label: 'LR Revenue (' + R.label + ')', value: inr(lrGrossPeriod), sub: 'gross of LRs in period', tone: 'green', onPress: () => navigation.navigate('LR') },
    { label: 'Total Business Done (All-Time)', value: inr(lrGrossTotal), sub: db.lrs.length + ' LRs on record', onPress: () => navigation.navigate('LR') },
    { label: 'Collected (' + R.label + ')', value: inr(collectedPeriod), sub: 'payments received in period', tone: 'green', onPress: () => navigation.navigate('Accounting') },
    { label: 'Outstanding', value: inr(outstanding), sub: 'receivables across clients', tone: outstanding > 0 ? 'amber' : 'green', onPress: () => navigation.navigate('Accounting') },
    { label: 'Hire Balance Due', value: inr(hireBalTotal), sub: hiredLRs.length + ' hired LRs', tone: hireBalTotal > 0 ? 'amber' : 'green', onPress: () => navigation.navigate('Hired') },
    { label: 'Active Trips', value: String(active), sub: 'bookings not yet delivered', onPress: () => navigation.navigate('Bookings') },
    { label: 'Fleet In Use', value: util + '%', sub: busy + ' of ' + owned.length + ' owned on trip', tone: util < 50 ? 'red' : 'green', onPress: () => navigation.navigate('Fleet') },
    { label: 'POD Pending', value: String(podPending), sub: 'LRs without proof of delivery', tone: podPending > 0 ? 'amber' : 'green', onPress: () => navigation.navigate('POD') },
    { label: 'Ready to Invoice', value: String(pendingInv), sub: 'delivered, unbilled trips', tone: pendingInv ? 'amber' : 'green', onPress: () => navigation.navigate('Accounting') },
    { label: 'Renewals ≤30d', value: String(due30), sub: 'documents / contracts / BG', tone: due30 > 0 ? 'red' : 'green', onPress: () => navigation.navigate('Renewals') }
  ];

  /* ---- company-wise performance table ---- */
  const totBooked = sum(db.bookings, b => b.freight);
  const companyRows = db.clients.map(c => {
    const bks = db.bookings.filter(b => b.clientId === c.id);
    const booked = sum(bks, b => b.freight);
    const invs = db.invoices.filter(i => i.clientId === c.id);
    const invTot = sum(invs, i => i.total);
    const col = sum(invs, i => invPaid(db, i));
    const out = invTot - col;
    let oldest = null;
    invs.forEach(i => { if (invOutstanding(db, i) > 0) { const a = daysSince(i.date); if (oldest == null || a > oldest) oldest = a; } });
    const share = totBooked > 0 ? Math.round(booked / totBooked * 100) : 0;
    return { c, bkCount: bks.length, booked, invTot, col, out, oldest, share };
  }).sort((a, b) => b.booked - a.booked);

  /* ---- vehicle planning ---- */
  const actInqs = db.inquiries.filter(q => q.status === 'OPEN' || q.status === 'CONFIRMED');
  const needVeh = actInqs.filter(q => !q.assignType);
  const hiredPlanned = actInqs.filter(q => q.assignType === 'Hired');

  /* ---- transit pipeline ---- */
  const inTransitBk = db.bookings.filter(b => b.status === 'In Transit');

  /* ---- revenue report bars ---- */
  const brBars = (db.branches || []).map(br => ({
    label: br.name, value: sum(db.lrs.filter(l => l.branchId === br.id), l => l.gross), color: C.navy3
  })).filter(x => x.value > 0);
  const byC0 = {};
  db.bookings.forEach(b => { byC0[b.clientId] = (byC0[b.clientId] || 0) + Number(b.freight || 0); });
  const clBars = Object.keys(byC0).map(cid => ({ label: clientName(db, cid), value: byC0[cid], color: C.teal }))
    .sort((a, b) => b.value - a.value).slice(0, 6);

  /* ---- LR revenue trend ---- */
  const months = last6Months();
  const mvals = months.map(m => sum(db.lrs.filter(l => String(l.date).slice(0, 7) === m.key), l => l.gross));
  const mmax = Math.max(...mvals, 1);

  /* ---- total business done till now — month-wise split (all-time accumulation) ---- */
  const mmBuckets = {};
  db.lrs.forEach(l => { const k = String(l.date || '').slice(0, 7); if (!k) return; mmBuckets[k] = (mmBuckets[k] || 0) + (Number(l.gross) || 0); });
  const mmKeys = Object.keys(mmBuckets).sort();
  const PIE_COLORS = ['#1d4d84', '#e8a33d', '#1e8a5f', '#7a5ea8', '#2596a5', '#c14343', '#0f2b4d', '#cf8c28', '#153a66', '#5750a8', '#94a3b8', '#c7d0dc'];
  const pieSegs = [];
  if (mmKeys.length > 12) {
    const recentKeys = mmKeys.slice(-11);
    let earlierTotal = 0;
    mmKeys.slice(0, mmKeys.length - 11).forEach(k => { earlierTotal += mmBuckets[k]; });
    pieSegs.push({ label: 'Earlier', value: earlierTotal, color: '#94a3b8' });
    recentKeys.forEach((k, i) => { const parts = k.split('-'); pieSegs.push({ label: MN[Number(parts[1]) - 1] + ' ' + parts[0].slice(2), value: mmBuckets[k], color: PIE_COLORS[i % PIE_COLORS.length] }); });
  } else {
    mmKeys.forEach((k, i) => { const parts = k.split('-'); pieSegs.push({ label: MN[Number(parts[1]) - 1] + ' ' + parts[0].slice(2), value: mmBuckets[k], color: PIE_COLORS[i % PIE_COLORS.length] }); });
  }
  const pieTotal = sum(pieSegs, s => s.value);

  /* ---- business mix ---- */
  const ownGross = sum(ownedLRs, l => l.gross);
  const hirGross = sum(hiredLRs, l => l.gross);
  const mixTotal = ownGross + hirGross;
  const fleetExpTotal = sum(db.expenses, e => e.amount);
  const hireCostTotal = sum(hiredLRs, l => (l.hire || {}).amount);

  /* ---- ageing ---- */
  const bk = ageingBuckets(db);

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={[S.row, { marginBottom: 12, gap: 12 }]}>
        <Logo size={46} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.navy }}>Baroda Goods Transport Service</Text>
          <Text style={{ fontSize: 10.5, color: C.mut, letterSpacing: 0.4 }}>EST. 1950 · VADODARA · ROAD · RAIL · AIR</Text>
        </View>
      </View>

      {/* ---- period selector ---- */}
      <View style={[S.wrapRow, { marginBottom: 14 }]}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: C.mut, textTransform: 'uppercase' }}>Period:</Text>
        {PERIODS.map(([id, label]) => (
          <TouchableOpacity key={id} onPress={() => setPeriod(id)} style={{
            backgroundColor: period === id ? C.navy : '#fff', borderWidth: 1, borderColor: period === id ? C.navy : C.line2,
            borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6
          }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: period === id ? C.amber : C.txt }}>{label}</Text>
          </TouchableOpacity>
        ))}
        <Text style={{ fontSize: 11, color: C.mut }}>— every tile & chart is clickable</Text>
      </View>

      <KpiRow items={kpis} />

      {/* ---- risk flags strip ---- */}
      <View style={{ backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: C.line, padding: 12, marginBottom: 12 }}>
        <View style={[S.row, { flexWrap: 'wrap', gap: 10 }]}>
          <Badge text={'⚑ ' + flags.length + ' RISK FLAG' + (flags.length === 1 ? '' : 'S')} tone={flags.length ? 'red' : 'green'} />
          <Text style={{ fontSize: 12, color: C.txt, flex: 1 }} numberOfLines={1}>
            {flags.length ? flags[0].msg.slice(0, 110) + (flags.length > 1 ? '  ·  +' + (flags.length - 1) + ' more' : '') : 'All BGTS thresholds clear.'}
          </Text>
          {flags.length ? <Btn small tone="ghost" label={flagsOpen ? 'Hide' : 'Show all'} onPress={() => setFlagsOpen(!flagsOpen)} /> : null}
        </View>
        {flagsOpen ? flags.map((f, i) => (
          <View key={i} style={{
            backgroundColor: f.sev === 'red' ? '#fbe9e9' : '#fdf1de',
            borderLeftWidth: 4, borderLeftColor: f.sev === 'red' ? C.red : C.amber,
            borderRadius: 6, padding: 10, marginTop: 8
          }}>
            <Text style={{ fontSize: 12, color: f.sev === 'red' ? '#7c2d2d' : '#7a5313' }}>{f.msg}</Text>
          </View>
        )) : null}
      </View>

      {/* ---- company-wise performance ---- */}
      <Card title="Company-wise Performance" right={<Text style={{ fontSize: 11, color: C.mut }}>click Open for the company dashboard</Text>}>
        {!companyRows.length ? <Empty text="No clients yet." /> : (
          <Table
            cols={[
              { key: 'client', label: 'Client', width: 180 },
              { key: 'bk', label: 'Bookings', width: 70 },
              { key: 'booked', label: 'Booked ₹', width: 90 },
              { key: 'inv', label: 'Turnover ₹', width: 90 },
              { key: 'col', label: 'Payment Receipt ₹', width: 90 },
              { key: 'out', label: 'Outstanding ₹', width: 100 },
              { key: 'share', label: 'Rev Share', width: 110 },
              { key: 'credit', label: 'Credit', width: 60 },
              { key: 'oldest', label: 'Oldest Due', width: 80 },
              { key: 'status', label: 'Status', width: 110 },
              { key: 'action', label: '', width: 90 }
            ]}
            rows={companyRows.map(r => ({
              client: (
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.navy }}>{r.c.name}</Text>
                  <Text style={{ fontSize: 10, color: C.mut }}>{r.c.gstin || ''}</Text>
                </View>
              ),
              bk: r.bkCount,
              booked: inr(r.booked),
              inv: inr(r.invTot),
              col: inr(r.col),
              out: <Text style={{ fontSize: 12, fontWeight: '800', color: r.out > 0 ? C.red : C.green }}>{inr(r.out)}</Text>,
              share: (
                <View style={[S.row, { gap: 6 }]}>
                  <View style={{ backgroundColor: C.line, borderRadius: 4, height: 8, width: 50, overflow: 'hidden' }}>
                    <View style={{ backgroundColor: r.share > 35 ? C.red : C.navy3, height: 8, width: Math.min(r.share, 100) + '%' }} />
                  </View>
                  <Text style={{ fontSize: 11, color: C.txt }}>{r.share}%</Text>
                </View>
              ),
              credit: (r.c.creditDays || '—') + 'd',
              oldest: r.oldest == null ? '—' : r.oldest + 'd',
              status: r.oldest != null && r.oldest > 60 ? <Badge text="60d+ OVERDUE" tone="red" />
                : r.share > 35 ? <Badge text={'EXPOSURE ' + r.share + '%'} tone="amber" />
                : r.out > 0 ? <Badge text="DUES OPEN" tone="amber" />
                : <Badge text="CLEAR" tone="green" />,
              action: <Btn small label="Open →" onPress={() => navigation.navigate('Company', { clientId: r.c.id })} />
            }))}
          />
        )}
      </Card>

      {/* ---- outstanding ageing ---- */}
      <Card title="Outstanding Report — Receivables Ageing" right={<Btn small tone="ghost" label="Open Receivables →" onPress={() => navigation.navigate('Accounting')} />}>
        <Bars fmt={inr} items={[
          { label: '0–30 days', value: bk['0-30'], color: C.green, onPress: () => navigation.navigate('Accounting') },
          { label: '31–60 days', value: bk['31-60'], color: C.amber, onPress: () => navigation.navigate('Accounting') },
          { label: '61–90 days', value: bk['61-90'], color: C.amberD, onPress: () => navigation.navigate('Accounting') },
          { label: '90+ days', value: bk['90+'], color: C.red, onPress: () => navigation.navigate('Accounting') }
        ]} />
      </Card>

      {/* ---- vehicle planning ---- */}
      <Card title="🚚 Vehicle Planning" right={
        <View style={[S.row, { gap: 8 }]}>
          <Btn small tone="amber" label="+ New Inquiry" onPress={() => navigation.navigate('Inquiries')} />
          <Btn small tone="ghost" label="All Inquiries →" onPress={() => navigation.navigate('Inquiries')} />
        </View>
      }>
        {owned.length ? (
          <Table
            cols={[
              { key: 'veh', label: 'Owned Vehicle', width: 170 },
              { key: 'status', label: 'Status', width: 110 },
              { key: 'on', label: 'Placed On', width: 230 }
            ]}
            rows={owned.map(v => {
              const onTrip = db.bookings.some(b => b.vehicleId === v.id && (b.status === 'Vehicle Assigned' || b.status === 'In Transit'));
              let planned = null;
              actInqs.forEach(q => { if (q.assignedVehicleId === v.id) planned = q; });
              const status = onTrip ? <Badge text="ON TRIP" tone="teal" /> : planned ? <Badge text="PLANNED" tone="amber" /> : <Badge text="AVAILABLE" tone="green" />;
              const on = onTrip ? 'current booking in transit'
                : planned ? (planned.inqNo + ' · ' + (planned.fromPlace || '?') + ' → ' + (planned.toPlace || '?') + (planned.expectedDate ? ' · loads ' + fmtDate(planned.expectedDate) : ''))
                : 'free for placement';
              return {
                veh: <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{v.regNo} <Text style={{ fontSize: 10, fontWeight: '400', color: C.mut }}>{v.type || ''}</Text></Text>,
                status, on
              };
            })}
          />
        ) : <Empty text="No owned vehicles." />}
        {needVeh.length ? (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: C.red }}>Needs vehicle ({needVeh.length}):</Text>
            {needVeh.map(q => (
              <View key={q.id} style={[S.row, { justifyContent: 'space-between', marginTop: 6 }]}>
                <Text style={{ fontSize: 12, color: C.txt, flex: 1 }}>{q.inqNo} · {clientName(db, q.clientId) || q.partyName || '—'} · {q.fromPlace || '?'} → {q.toPlace || '?'}{q.expectedDate ? ' · ' + fmtDate(q.expectedDate) : ''}</Text>
                <Btn small label="Plan Vehicle" onPress={() => navigation.navigate('Inquiries')} />
              </View>
            ))}
          </View>
        ) : null}
        {hiredPlanned.length ? (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: C.purple }}>Hired placements ({hiredPlanned.length}):</Text>
            {hiredPlanned.map(q => (
              <Text key={q.id} style={{ fontSize: 12, color: C.txt, marginTop: 4 }}>
                {q.inqNo} · {vendorName(db, q.assignedVendorId)}{q.assignedTruckNo ? ' · ' + q.assignedTruckNo : ''} · {q.fromPlace || '?'} → {q.toPlace || '?'}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>

      {/* ---- transit pipeline ---- */}
      <Card title="Transit Report — Pipeline">
        <Bars items={[
          { label: 'Open Inquiries', value: db.inquiries.filter(q => q.status === 'OPEN').length, color: C.purple, onPress: () => navigation.navigate('Inquiries') },
          { label: 'Confirmed (vehicle planned)', value: db.inquiries.filter(q => q.status === 'CONFIRMED').length, color: C.amber, onPress: () => navigation.navigate('Inquiries') },
          { label: 'Booked', value: db.bookings.filter(b => b.status === 'Booked').length, color: C.navy3, onPress: () => navigation.navigate('Bookings') },
          { label: 'Vehicle Assigned', value: db.bookings.filter(b => b.status === 'Vehicle Assigned').length, color: C.teal, onPress: () => navigation.navigate('Bookings') },
          { label: 'In Transit', value: inTransitBk.length, color: C.navy, onPress: () => navigation.navigate('Bookings') },
          { label: 'POD Pending', value: podPending, color: C.red, onPress: () => navigation.navigate('LR') },
          { label: 'Delivered / Closed', value: db.bookings.filter(b => b.status === 'Delivered' || b.status === 'Invoiced' || b.status === 'Paid').length, color: C.green, onPress: () => navigation.navigate('Bookings') }
        ]} />
        {inTransitBk.length ? (
          <Text style={{ fontSize: 12, marginTop: 10 }}>
            <Text style={{ fontWeight: '800', color: C.navy }}>On the road now: </Text>
            {inTransitBk.map(b => (b.origin || '') + ' → ' + (b.destination || '') + ' (' + (b.assignType === 'Owned' ? vehicleReg(db, b.vehicleId) : (b.hiredVehicleNo || 'hired')) + ')').join(' · ')}
          </Text>
        ) : null}
      </Card>

      {/* ---- revenue report ---- */}
      <Card title="Revenue Report — Company & Client Split">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
          <View style={{ flex: 1, minWidth: 240 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.mut, textTransform: 'uppercase', marginBottom: 8 }}>By Branch / Entity (LR gross)</Text>
            {brBars.length ? <Bars fmt={inr} items={brBars} /> : <Empty text="No LR revenue yet." />}
          </View>
          <View style={{ flex: 1, minWidth: 240 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.mut, textTransform: 'uppercase', marginBottom: 8 }}>Top Clients (booked)</Text>
            {clBars.length ? <Bars fmt={inr} items={clBars} /> : <Empty text="No bookings yet." />}
          </View>
        </View>
      </Card>

      {/* ---- branch / entity-wise performance ---- */}
      <Card title="Branch / Entity-wise Performance" right={<Btn small tone="ghost" label="Manage Branches →" onPress={() => navigation.navigate('Masters')} />}>
        {!db.branches || !db.branches.length ? <Empty text="No branches configured." /> : (
          <>
            <Table
              cols={[
                { key: 'branch', label: 'Branch', width: 100 },
                { key: 'entity', label: 'Entity', width: 150 },
                { key: 'bk', label: 'Bookings', width: 70 },
                { key: 'booked', label: 'Booked ₹', width: 90 },
                { key: 'lrs', label: 'LRs', width: 50 },
                { key: 'lrGross', label: 'LR Gross ₹', width: 90 },
                { key: 'inv', label: 'Invoiced ₹', width: 90 },
                { key: 'col', label: 'Collected ₹', width: 90 },
                { key: 'out', label: 'Outstanding ₹', width: 100 },
                { key: 'exp', label: 'Expenses ₹', width: 90 },
                { key: 'hire', label: 'Hire Bal ₹', width: 90 }
              ]}
              rows={db.branches.map(br => {
                const bks = db.bookings.filter(b => b.branchId === br.id);
                const lrs = db.lrs.filter(l => l.branchId === br.id);
                const invs = db.invoices.filter(i => i.branchId === br.id);
                const invTot = sum(invs, i => i.total);
                const colTot = sum(invs, i => invPaid(db, i));
                const expTot = sum(db.acctExp.filter(e => e.branchId === br.id), e => e.amount);
                const hb = sum(lrs.filter(l => l.ownership === 'Hired'), l => Math.max(lrHireBalance(l), 0));
                const out = invTot - colTot;
                return {
                  branch: <Text style={{ fontSize: 12, fontWeight: '700', color: C.navy }}>{br.name}</Text>,
                  entity: (
                    <View>
                      <Text style={{ fontSize: 12, color: C.txt }}>{br.entityName || db.company.name}</Text>
                      {br.gstin ? <Text style={{ fontSize: 10, color: C.mut }}>{br.gstin}</Text> : null}
                    </View>
                  ),
                  bk: bks.length,
                  booked: inr(sum(bks, b => b.freight)),
                  lrs: lrs.length,
                  lrGross: <Text style={{ fontWeight: '800' }}>{inr(sum(lrs, l => l.gross))}</Text>,
                  inv: inr(invTot),
                  col: inr(colTot),
                  out: <Text style={{ fontWeight: '800', color: out > 0 ? C.red : C.green }}>{inr(out)}</Text>,
                  exp: inr(expTot),
                  hire: hb > 0 ? <Text style={{ fontWeight: '800', color: C.red }}>{inr(hb)}</Text> : inr(0)
                };
              })}
            />
            <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 6 }}>
              Add a sister entity or new branch under Masters → Branches / Entities — its LRs print with its own entity name, GSTIN and LR prefix.
            </Text>
          </>
        )}
      </Card>

      {/* ---- LR revenue trend ---- */}
      <Card title="LR Revenue Trend — Last 6 Months">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 12, paddingTop: 6 }}>
          {months.map((m, i) => (
            <View key={m.key} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 10.5, fontWeight: '700', color: C.navy }}>{mvals[i] ? inr(mvals[i]) : ''}</Text>
              <View style={{
                width: '80%', maxWidth: 64, height: Math.max(Math.round(mvals[i] / mmax * 110), 2),
                backgroundColor: i === months.length - 1 ? C.amber : C.navy3, borderRadius: 5, marginTop: 4
              }} />
              <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 4, fontWeight: '600' }}>{m.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* ---- total business done till now — month-wise split ---- */}
      <Card title="Total Business Done Till Now — Month-wise Split" right={<Text style={{ fontSize: 11, color: C.mut }}>{inr(lrGrossTotal)} accumulated across {mmKeys.length} month(s)</Text>}>
        {pieSegs.length ? (
          <>
            <View style={{ flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', backgroundColor: C.line }}>
              {pieSegs.map((s, i) => (
                <View key={i} style={{ width: (pieTotal > 0 ? Math.round(s.value / pieTotal * 100) : 0) + '%', backgroundColor: s.color }} />
              ))}
            </View>
            <View style={{ marginTop: 10 }}>
              {pieSegs.map((s, i) => (
                <View key={i} style={[S.row, { alignItems: 'center', gap: 8, marginBottom: 6 }]}>
                  <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: s.color }} />
                  <Text style={{ fontSize: 12, color: C.txt }}>{s.label} — <Text style={{ fontWeight: '800' }}>{inr(s.value)}</Text> ({pieTotal > 0 ? Math.round(s.value / pieTotal * 100) : 0}%)</Text>
                </View>
              ))}
            </View>
          </>
        ) : <Empty text="No LR revenue recorded yet." />}
      </Card>

      {/* ---- business mix ---- */}
      <Card title="Overall Report — Business Mix (Owned vs Hired)">
        {mixTotal > 0 ? (
          <>
            <View style={{ flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', backgroundColor: C.line }}>
              <View style={{ width: Math.round(ownGross / mixTotal * 100) + '%', backgroundColor: C.navy3 }} />
              <View style={{ width: Math.round(hirGross / mixTotal * 100) + '%', backgroundColor: C.purple }} />
            </View>
            <View style={[S.wrapRow, { marginTop: 10 }]}>
              <Text style={{ fontSize: 12, color: C.txt }}><Text style={{ color: C.navy3 }}>■</Text> Owned fleet revenue — <Text style={{ fontWeight: '800' }}>{inr(ownGross)}</Text> ({Math.round(ownGross / mixTotal * 100)}%)</Text>
              <Text style={{ fontSize: 12, color: C.txt }}><Text style={{ color: C.purple }}>■</Text> Hired / market revenue — <Text style={{ fontWeight: '800' }}>{inr(hirGross)}</Text> ({Math.round(hirGross / mixTotal * 100)}%)</Text>
            </View>
          </>
        ) : <Empty text="No data yet." />}
        <View style={{ marginTop: 14 }}>
          <Table
            cols={[
              { key: 'kind', label: '', width: 90 },
              { key: 'lrs', label: 'LRs', width: 60 },
              { key: 'gross', label: 'Gross Revenue', width: 100 },
              { key: 'cost', label: 'Direct Cost', width: 150 },
              { key: 'contrib', label: 'Contribution', width: 110 }
            ]}
            rows={[
              {
                kind: <Badge text="OWNED" tone="navy" />, lrs: ownedLRs.length, gross: inr(ownGross),
                cost: <Text>{inr(fleetExpTotal)} <Text style={{ fontSize: 10, color: C.mut }}>(fleet expenses)</Text></Text>,
                contrib: <Text style={{ fontWeight: '800' }}>{inr(ownGross - fleetExpTotal)}</Text>
              },
              {
                kind: <Badge text="HIRED" tone="purple" />, lrs: hiredLRs.length, gross: inr(hirGross),
                cost: <Text>{inr(hireCostTotal)} <Text style={{ fontSize: 10, color: C.mut }}>(lorry hire)</Text></Text>,
                contrib: <Text style={{ fontWeight: '800', color: hireMargin >= 0 ? C.green : C.red }}>{inr(hireMargin)}</Text>
              }
            ]}
          />
        </View>
      </Card>

      {/* ---- fleet snapshot ---- */}
      <Card title="Fleet Snapshot" right={<Btn small tone="ghost" label="Full Fleet View →" onPress={() => navigation.navigate('Fleet')} />}>
        {!owned.length ? <Empty text="No owned vehicles." /> : (
          <Table
            cols={[
              { key: 'veh', label: 'Vehicle', width: 110 },
              { key: 'trips', label: 'Trips', width: 60 },
              { key: 'rev', label: 'Revenue', width: 90 },
              { key: 'exp', label: 'Expenses', width: 90 },
              { key: 'fuel', label: 'Fuel %', width: 70 },
              { key: 'net', label: 'Net', width: 90 },
              { key: 'last', label: 'Last Trip', width: 90 },
              { key: 'renewal', label: 'Next Renewal', width: 150 }
            ]}
            rows={owned.map(v => {
              const trips = db.bookings.filter(b => b.vehicleId === v.id);
              const rev = sum(trips, b => b.freight);
              const ex = db.expenses.filter(e => e.vehicleId === v.id);
              const exT = sum(ex, e => e.amount);
              const fuel = sum(ex.filter(e => e.category === 'Fuel'), e => e.amount);
              const fp = rev > 0 ? Math.round(fuel / rev * 100) : 0;
              const last = trips.length ? trips.map(b => b.date).sort().pop() : null;
              let nextRen = null;
              db.renewals.filter(r => r.vehicleId === v.id).forEach(r => {
                const dd = daysTo(r.expiry);
                if (dd != null && (nextRen == null || dd < nextRen.days)) nextRen = { days: dd, doc: r.docType };
              });
              return {
                veh: <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{v.regNo}</Text>,
                trips: trips.length,
                rev: inr(rev),
                exp: inr(exT),
                fuel: rev > 0 ? <Badge text={fp + '%'} tone={fp > 32 ? 'red' : 'green'} /> : '—',
                net: <Text style={{ fontWeight: '800', color: rev - exT >= 0 ? C.green : C.red }}>{inr(rev - exT)}</Text>,
                last: last ? fmtDate(last) : '—',
                renewal: nextRen ? <Badge text={nextRen.doc + ' ' + (nextRen.days < 0 ? 'EXPIRED' : nextRen.days + 'd')} tone={nextRen.days < 0 ? 'red' : nextRen.days <= 30 ? 'amber' : 'green'} /> : '—'
              };
            })}
          />
        )}
      </Card>

      {/* ---- quick actions ---- */}
      <Card title="Quick Actions">
        <View style={[S.wrapRow]}>
          <Btn tone="amber" label="+ New Inquiry" onPress={() => navigation.navigate('Inquiries')} />
          <Btn tone="ghost" label="View Bookings" onPress={() => navigation.navigate('Bookings')} />
          <Btn label="+ New LR" onPress={() => navigation.navigate('LRForm')} />
          <Btn tone="ghost" label="✓ POD Update" onPress={() => navigation.navigate('POD')} />
          <Btn tone="ghost" label="Receivables" onPress={() => navigation.navigate('Accounting')} />
          <Btn tone="ghost" label="Bank Reco" onPress={() => navigation.navigate('Banking')} />
          <Btn tone="ghost" label="Reports" onPress={() => navigation.navigate('Reports')} />
        </View>
      </Card>

      {/* ---- upcoming renewals ---- */}
      <Card title="Upcoming Renewals">
        <RenewalsTable items={allRenewalItems(db).slice(0, 6)} />
      </Card>
    </ScrollView>
  );
}
