import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Empty } from '../ui';
import { inr, fmtDate, vendorName, sum, lrHireBalance } from '../logic';

export default function HiredScreen() {
  const { db } = useStore();
  const hired = db.bookings.filter(b => b.assignType === 'Hired').slice().reverse();
  const withVendor = db.bookings.filter(b => b.assignType === 'Hired' && b.hiredVendorId);
  const byV = {};
  withVendor.forEach(b => { byV[b.hiredVendorId] = (byV[b.hiredVendorId] || 0) + 1; });

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <Card title="Hired / Market Vehicle Trips">
        {!hired.length ? <Empty text='No hired-vehicle trips yet. Assign a booking as "Hired".' /> :
          hired.map(b => {
            const m = (Number(b.freight) || 0) - (Number(b.hireCost) || 0);
            const mp = b.freight > 0 ? Math.round(m / b.freight * 100) : 0;
            return (
              <View key={b.id} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8 }}>
                <View style={[S.row, { justifyContent: 'space-between' }]}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.navy }}>{b.bkNo} · {vendorName(db, b.hiredVendorId)}</Text>
                  <Badge text={mp + '%'} tone={mp < 12 ? 'red' : 'green'} />
                </View>
                <Text style={{ fontSize: 11.5, color: C.mut, marginTop: 2 }}>
                  {b.origin} → {b.destination} · {fmtDate(b.date)} · {b.hiredVehicleNo || '—'}
                </Text>
                <Text style={{ fontSize: 12, color: C.txt, marginTop: 2 }}>
                  Billed {inr(b.freight)} − Hire {inr(b.hireCost)} = <Text style={{ fontWeight: '800', color: m >= 0 ? C.green : C.red }}>{inr(m)}</Text>
                </Text>
              </View>
            );
          })}
        <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 8 }}>Margin trigger: below 12% flags red (BGTS business rule).</Text>
      </Card>

      <Card title="Hired LR Ledger (advance + balance payments)">
        {!db.lrs.some(l => l.ownership === 'Hired') ? <Empty text="No hired-vehicle LRs yet. Set Vehicle Ownership = Hired on the LR form." /> :
          db.lrs.filter(l => l.ownership === 'Hired').slice().reverse().map(l => {
            const hv = l.hire || {};
            const paid = sum(hv.payments || [], p => p.amount);
            const bal = lrHireBalance(l);
            const margin = (Number(l.gross) || 0) - (Number(hv.amount) || 0);
            const mp = l.gross > 0 ? Math.round(margin / l.gross * 100) : 0;
            return (
              <View key={l.id} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8 }}>
                <View style={[S.row, { justifyContent: 'space-between' }]}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.navy }}>{l.lrNo} · {vendorName(db, hv.vendorId)}</Text>
                  <Badge text={bal > 0 ? 'BAL ' + inr(bal) : 'SETTLED'} tone={bal > 0 ? 'red' : 'green'} />
                </View>
                <Text style={{ fontSize: 11.5, color: C.mut, marginTop: 2 }}>
                  {fmtDate(l.date)} · {l.truckNo} · Billed {inr(l.gross)} · Hire {inr(hv.amount)} · Adv {inr(hv.advance)} · Paid {inr(paid)}
                </Text>
                <Text style={{ fontSize: 12, color: C.txt, marginTop: 2 }}>
                  Margin <Text style={{ fontWeight: '800', color: margin >= 0 ? C.green : C.red }}>{inr(margin)}</Text> ({mp}%{mp < 12 ? ' ⚑ below 12%' : ''}) — record payments from the LR register
                </Text>
              </View>
            );
          })}
      </Card>

      <Card title="Vendor Dependency">
        {!withVendor.length ? <Empty text="No vendor data yet." /> :
          Object.keys(byV).map(vid => {
            const sh = Math.round(byV[vid] / withVendor.length * 100);
            return (
              <View key={vid} style={[S.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
                <Text style={{ fontSize: 12.5, color: C.txt, fontWeight: '600', flex: 1 }}>{vendorName(db, vid)} · {byV[vid]} trips</Text>
                <Badge text={sh + '%' + (sh > 40 ? ' OVER 40%' : '')} tone={sh > 40 ? 'red' : 'green'} />
              </View>
            );
          })}
      </Card>
    </ScrollView>
  );
}
