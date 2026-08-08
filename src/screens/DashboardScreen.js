import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Kpi, Badge, Empty, Logo, Btn } from '../ui';
import {
  inr, sum, pad, todayISO, invOutstanding, invPaid, riskFlags, allRenewalItems,
  fmtDate, daysSince, lrHireBalance, clientName
} from '../logic';

const MODULES = [
  ['Inquiries', 'Inquiries', '✆'], ['Bookings', 'Bookings', '⬒'],
  ['LR / CN', 'LR', '▤'], ['POD Update', 'POD', '✓'],
  ['Accounts Dash', 'AccDash', '📊'], ['Banking / Reco', 'Banking', '🏦'],
  ['LHC / Truck Hire', 'LHC', '⇄'], ['Driver Khata', 'Advances', '₸'],
  ['Owned Fleet', 'Fleet', '▣'], ['Hired Vehicles', 'Hired', '▢'],
  ['Renewals', 'Renewals', '⚑'], ['Contracts', 'Contracts', '§'],
  ['Accounting', 'Accounting', '₹'], ['Reports', 'Reports', '≡'],
  ['Masters', 'Masters', '⚙'], ['Settings', 'Settings', '✎']
];
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function last6Months() {
  const out = [], d = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({ key: m.getFullYear() + '-' + pad(m.getMonth() + 1), label: MN[m.getMonth()] });
  }
  return out;
}

export default function DashboardScreen({ navigation }) {
  const { db } = useStore();
  const [flagsOpen, setFlagsOpen] = useState(false);
  const t = todayISO(), mtdStart = t.slice(0, 8) + '01';
  const active = db.bookings.filter(b => b.status !== 'Delivered' && b.status !== 'Paid').length;
  const lrMTD = sum(db.lrs.filter(l => l.date >= mtdStart), l => l.gross);
  const collectedMTD = sum(db.payments.filter(p => p.date >= mtdStart), p => p.amount);
  const outstanding = sum(db.invoices, i => invOutstanding(db, i));
  const hiredLRs = db.lrs.filter(l => l.ownership === 'Hired');
  const hireBal = sum(hiredLRs, l => Math.max(lrHireBalance(l), 0));
  const podPending = db.lrs.filter(l => !l.pod).length;
  const owned = db.vehicles.filter(v => v.owned);
  const busy = owned.filter(v => db.bookings.some(b => b.vehicleId === v.id && (b.status === 'Vehicle Assigned' || b.status === 'In Transit'))).length;
  const util = owned.length ? Math.round(busy / owned.length * 100) : 0;
  const flags = riskFlags(db);
  const renewals = allRenewalItems(db).slice(0, 5);
  const months = last6Months();
  const mvals = months.map(m => sum(db.lrs.filter(l => String(l.date).slice(0, 7) === m.key), l => l.gross));
  const mmax = Math.max(...mvals, 1);
  const totBooked = sum(db.bookings, b => b.freight);

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={[S.row, { marginBottom: 12, gap: 12 }]}>
        <Logo size={46} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.navy }}>Baroda Goods Transport Service</Text>
          <Text style={{ fontSize: 10.5, color: C.mut, letterSpacing: 0.4 }}>EST. 1950 · VADODARA · ROAD · RAIL · AIR</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Kpi label="LR Revenue MTD" value={inr(lrMTD)} sub={db.lrs.length + ' LRs total'} tone="green" />
        <Kpi label="Collected MTD" value={inr(collectedMTD)} sub="payments this month" tone="green" />
        <Kpi label="Outstanding" value={inr(outstanding)} sub="receivables" tone={outstanding > 0 ? 'amber' : 'green'} />
        <Kpi label="Hire Balance Due" value={inr(hireBal)} sub={hiredLRs.length + ' hired LRs'} tone={hireBal > 0 ? 'amber' : 'green'} />
        <Kpi label="Active Trips" value={String(active)} sub={'fleet in use ' + util + '%'} />
        <Kpi label="POD Pending" value={String(podPending)} sub="LRs without POD" tone={podPending > 0 ? 'amber' : 'green'} />
      </View>

      <Card>
        <View style={[S.row, { justifyContent: 'space-between' }]}>
          <Badge text={'⚑ ' + flags.length + ' RISK FLAGS'} tone={flags.length ? 'red' : 'green'} />
          {flags.length ? <Btn small tone="ghost" label={flagsOpen ? 'Hide' : 'Show all'} onPress={() => setFlagsOpen(!flagsOpen)} /> : null}
        </View>
        {flags.length && !flagsOpen ? (
          <Text style={{ fontSize: 11.5, color: C.mut, marginTop: 6 }} numberOfLines={1}>{flags[0].msg}{flags.length > 1 ? '  · +' + (flags.length - 1) + ' more' : ''}</Text>
        ) : null}
        {flagsOpen ? flags.map((f, i) => (
          <View key={i} style={{
            backgroundColor: f.sev === 'red' ? '#fbe9e9' : '#fdf1de',
            borderLeftWidth: 4, borderLeftColor: f.sev === 'red' ? C.red : C.amber,
            borderRadius: 6, padding: 10, marginTop: 8
          }}>
            <Text style={{ fontSize: 12, color: f.sev === 'red' ? '#7c2d2d' : '#7a5313' }}>{f.msg}</Text>
          </View>
        )) : null}
      </Card>

      <Card title="Company-wise — tap a company for its dashboard">
        {!db.clients.length ? <Empty text="No clients yet." /> :
          db.clients.map(c => {
            const bks = db.bookings.filter(b => b.clientId === c.id);
            const booked = sum(bks, b => b.freight);
            const invs = db.invoices.filter(i => i.clientId === c.id);
            const inv = sum(invs, i => i.total);
            const col = sum(invs, i => invPaid(db, i));
            const out = inv - col;
            let oldest = null;
            invs.forEach(i => { if (invOutstanding(db, i) > 0) { const a = daysSince(i.date); if (oldest == null || a > oldest) oldest = a; } });
            const share = totBooked > 0 ? Math.round(booked / totBooked * 100) : 0;
            return (
              <TouchableOpacity key={c.id} onPress={() => navigation.navigate('Company', { clientId: c.id })} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8 }}>
                <View style={[S.row, { justifyContent: 'space-between' }]}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.navy, flex: 1 }}>{c.name}</Text>
                  <Badge
                    text={oldest != null && oldest > 60 ? '60d+ OVERDUE' : share > 35 ? 'EXPOSURE ' + share + '%' : out > 0 ? 'DUES OPEN' : 'CLEAR'}
                    tone={oldest != null && oldest > 60 ? 'red' : share > 35 ? 'amber' : out > 0 ? 'amber' : 'green'} />
                </View>
                <Text style={{ fontSize: 11.5, color: C.txt, marginTop: 2 }}>
                  {bks.length} bookings · Booked {inr(booked)} ({share}%) · Collected {inr(col)} · <Text style={{ fontWeight: '800', color: out > 0 ? C.red : C.green }}>Out {inr(out)}</Text>
                </Text>
                <View style={{ backgroundColor: C.line, borderRadius: 4, height: 6, marginTop: 5, overflow: 'hidden' }}>
                  <View style={{ backgroundColor: share > 35 ? C.red : C.navy3, height: 6, width: Math.min(share, 100) + '%' }} />
                </View>
              </TouchableOpacity>
            );
          })}
      </Card>


      <Card title="🚚 Vehicle Planning">
        {owned.map(v => {
          const onTrip = db.bookings.some(b => b.vehicleId === v.id && (b.status === 'Vehicle Assigned' || b.status === 'In Transit'));
          const planned = db.inquiries.find(q => (q.status === 'OPEN' || q.status === 'CONFIRMED') && q.assignedVehicleId === v.id);
          return (
            <View key={v.id} style={[S.row, { justifyContent: 'space-between', marginBottom: 7 }]}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy, flex: 1 }}>{v.regNo}</Text>
              <Badge text={onTrip ? 'ON TRIP' : planned ? 'PLANNED · ' + planned.inqNo : 'AVAILABLE'} tone={onTrip ? 'teal' : planned ? 'amber' : 'green'} />
            </View>
          );
        })}
        {(() => {
          const need = db.inquiries.filter(q => (q.status === 'OPEN' || q.status === 'CONFIRMED') && !q.assignType);
          return need.length ? (
            <TouchableOpacity onPress={() => navigation.navigate('Inquiries')}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.red, marginTop: 4 }}>
                ⚑ {need.length} inquiry(ies) need a vehicle — tap to plan
              </Text>
            </TouchableOpacity>
          ) : <Text style={{ fontSize: 11, color: C.mut, marginTop: 4 }}>All active inquiries have vehicles planned.</Text>;
        })()}
      </Card>

      <Card title="Branch / Entity-wise">
        {(db.branches || []).map(br => {
          const lrs = db.lrs.filter(l => l.branchId === br.id);
          const invs = db.invoices.filter(i => i.branchId === br.id);
          const invTot = sum(invs, i => i.total);
          const colTot = sum(invs, i => invPaid(db, i));
          const out = invTot - colTot;
          const exp = sum(db.acctExp.filter(e => e.branchId === br.id), e => e.amount);
          return (
            <View key={br.id} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8 }}>
              <View style={[S.row, { justifyContent: 'space-between' }]}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.navy }}>{br.name}</Text>
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: C.navy }}>{inr(sum(lrs, l => l.gross))}</Text>
              </View>
              <Text style={{ fontSize: 11, color: C.mut }}>
                {(br.entityName || db.company.name)}{br.gstin ? ' · ' + br.gstin : ''}
              </Text>
              <Text style={{ fontSize: 11.5, color: C.txt, marginTop: 2 }}>
                {lrs.length} LRs · Invoiced {inr(invTot)} · Collected {inr(colTot)} · <Text style={{ fontWeight: '800', color: out > 0 ? C.red : C.green }}>Out {inr(out)}</Text> · Exp {inr(exp)}
              </Text>
            </View>
          );
        })}
        <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 6 }}>
          Add branches / sister entities under Masters → Branches. Each entity prints its own name & GSTIN on its LRs.
        </Text>
      </Card>

      <Card title="LR Revenue — Last 6 Months">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 8 }}>
          {months.map((m, i) => (
            <View key={m.key} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: C.navy }}>{mvals[i] ? inr(mvals[i]) : ''}</Text>
              <View style={{
                width: '80%', height: Math.max(Math.round(mvals[i] / mmax * 84), 2),
                backgroundColor: i === months.length - 1 ? C.amber : C.navy3, borderRadius: 4, marginTop: 3
              }} />
              <Text style={{ fontSize: 10, color: C.mut, marginTop: 3, fontWeight: '600' }}>{m.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card title="Modules">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {MODULES.map(m => (
            <TouchableOpacity key={m[1]} onPress={() => navigation.navigate(m[1])} style={{
              width: '48.5%', backgroundColor: C.navy, borderRadius: 10, padding: 14, marginBottom: 10
            }}>
              <Text style={{ fontSize: 18, color: C.amber }}>{m[2]}</Text>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, marginTop: 6 }}>{m[0]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card title="Upcoming Renewals">
        {!renewals.length ? <Empty text="Nothing tracked yet." /> :
          renewals.map((r, i) => (
            <View key={i} style={[S.row, { marginBottom: 8, justifyContent: 'space-between' }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.navy }}>{r.label}</Text>
                <Text style={{ fontSize: 11, color: C.mut }}>{r.detail} · {fmtDate(r.expiry)}</Text>
              </View>
              <Text style={{
                fontSize: 12, fontWeight: '800',
                color: r.days == null ? C.mut : r.days < 0 ? C.red : r.days <= 7 ? C.red : r.days <= 30 ? C.amberD : C.green
              }}>
                {r.days == null ? 'VERIFY' : r.days < 0 ? 'EXPIRED' : r.days + 'd'}
              </Text>
            </View>
          ))}
      </Card>
    </ScrollView>
  );
}
