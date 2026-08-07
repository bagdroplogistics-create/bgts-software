import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Kpi, Empty } from '../ui';
import { inr, sum, todayISO, invOutstanding, riskFlags, allRenewalItems, fmtDate } from '../logic';

const MODULES = [
  ['Bookings', 'Bookings', '⬒'], ['LR / CN', 'LR', '▤'],
  ['LHC / Truck Hire', 'LHC', '⇄'], ['Driver Khata', 'Advances', '₸'],
  ['Owned Fleet', 'Fleet', '▣'], ['Hired Vehicles', 'Hired', '▢'],
  ['Renewals', 'Renewals', '⚑'], ['Contracts', 'Contracts', '§'],
  ['Accounting', 'Accounting', '₹'], ['Reports', 'Reports', '≡'],
  ['Masters', 'Masters', '⚙'], ['Settings', 'Settings', '✎']
];

export default function DashboardScreen({ navigation }) {
  const { db } = useStore();
  const active = db.bookings.filter(b => b.status !== 'Delivered' && b.status !== 'Paid').length;
  const mtdStart = todayISO().slice(0, 8) + '01';
  const revMTD = sum(db.bookings.filter(b => b.date >= mtdStart), b => b.freight);
  const outstanding = sum(db.invoices, i => invOutstanding(db, i));
  const due30 = allRenewalItems(db).filter(r => r.days != null && r.days <= 30).length;
  const owned = db.vehicles.filter(v => v.owned);
  const busy = owned.filter(v => db.bookings.some(b => b.vehicleId === v.id && (b.status === 'Vehicle Assigned' || b.status === 'In Transit'))).length;
  const util = owned.length ? Math.round(busy / owned.length * 100) : 0;
  const flags = riskFlags(db);
  const renewals = allRenewalItems(db).slice(0, 5);

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Kpi label="Active Trips" value={String(active)} sub="not yet delivered" />
        <Kpi label="Revenue (MTD)" value={inr(revMTD)} sub="booked freight this month" tone="green" />
        <Kpi label="Outstanding" value={inr(outstanding)} sub={db.invoices.length + ' invoices'} tone={outstanding > 0 ? 'amber' : 'green'} />
        <Kpi label="Fleet In Use" value={util + '%'} sub={busy + ' of ' + owned.length + ' owned on trip'} tone={util < 50 ? 'red' : 'green'} />
      </View>

      <Card title={'⚑ Risk Flags (' + flags.length + ')'}>
        {!flags.length ? <Empty text="No active risk triggers. All BGTS thresholds clear." /> :
          flags.slice(0, 8).map((f, i) => (
            <View key={i} style={{
              backgroundColor: f.sev === 'red' ? '#fbe9e9' : '#fdf1de',
              borderLeftWidth: 4, borderLeftColor: f.sev === 'red' ? C.red : C.amber,
              borderRadius: 6, padding: 10, marginBottom: 8
            }}>
              <Text style={{ fontSize: 12, color: f.sev === 'red' ? '#7c2d2d' : '#7a5313' }}>{f.msg}</Text>
            </View>
          ))}
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

      <Card title={'Renewals due ≤30 days: ' + due30}>
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
                {r.days == null ? '—' : r.days < 0 ? 'EXPIRED' : r.days + 'd'}
              </Text>
            </View>
          ))}
      </Card>
    </ScrollView>
  );
}
