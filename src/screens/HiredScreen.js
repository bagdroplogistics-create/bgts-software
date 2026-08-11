import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, Table } from '../ui';
import { uid, inr, fmtDate, todayISO, byId, vendorName, sum, lrHireBalance } from '../logic';

export default function HiredScreen() {
  const { db, update } = useStore();
  const [form, setForm] = useState(null);
  const hired = db.bookings.filter(b => b.assignType === 'Hired').slice().reverse();
  const withVendor = db.bookings.filter(b => b.assignType === 'Hired' && b.hiredVendorId);
  const byV = {};
  withVendor.forEach(b => { byV[b.hiredVendorId] = (byV[b.hiredVendorId] || 0) + 1; });

  const addHirePay = (l) => {
    const bal = lrHireBalance(l);
    setForm({
      title: 'Hire Payment — ' + l.lrNo + ' (' + vendorName(db, (l.hire || {}).vendorId) + ', balance ' + inr(bal) + ')',
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
        { key: 'amount', label: 'Amount ₹', type: 'number', required: true, value: bal > 0 ? bal : '' },
        { key: 'mode', label: 'Mode', type: 'select', required: true, value: 'NEFT/RTGS', options: ['NEFT/RTGS', 'UPI', 'Cash', 'Cheque'].map(x => ({ v: x, l: x })) },
        { key: 'ref', label: 'UTR / Ref' }
      ],
      onSubmit: (v) => update(d => {
        const x = byId(d.lrs, l.id); if (!x) return;
        const p = { id: uid('hp'), date: v.date, amount: Number(v.amount) || 0, mode: v.mode, ref: v.ref };
        x.hire.payments = x.hire.payments || [];
        x.hire.payments.push(p);
        d.acctExp.push({ id: 'hpay_' + p.id, lrId: x.id, branchId: x.branchId, date: p.date, account: 'Hired Vehicle / Subcontractor', amount: p.amount, paidThrough: (v.mode === 'Cash' ? 'Petty Cash' : 'Bank — Current A/c'), vendor: vendorName(d, x.hire.vendorId), ref: 'LR ' + x.lrNo + ' — hire balance payment', notes: v.ref || '', src: 'hire' });
      })
    });
  };

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <Card title="Hired / Market Vehicle Trips">
        {!hired.length ? <Empty text='No hired-vehicle trips yet. Assign a booking as "Hired".' /> : (
          <Table
            cols={[
              { key: 'bkNo', label: 'Bk No', width: 90 },
              { key: 'date', label: 'Date', width: 80 },
              { key: 'vendor', label: 'Vendor', width: 130 },
              { key: 'vehicle', label: 'Vehicle', width: 100 },
              { key: 'route', label: 'Route', width: 150 },
              { key: 'freight', label: 'Freight (Billed)', width: 110 },
              { key: 'hireCost', label: 'Hire Cost', width: 90 },
              { key: 'margin', label: 'Margin', width: 90 },
              { key: 'marginPct', label: 'Margin %', width: 90 }
            ]}
            rows={hired.map(b => {
              const m = (Number(b.freight) || 0) - (Number(b.hireCost) || 0);
              const mp = b.freight > 0 ? Math.round(m / b.freight * 100) : 0;
              return {
                bkNo: <Text style={{ fontWeight: '700', color: C.navy }}>{b.bkNo}</Text>,
                date: fmtDate(b.date),
                vendor: vendorName(db, b.hiredVendorId),
                vehicle: b.hiredVehicleNo || '—',
                route: b.origin + ' → ' + b.destination,
                freight: inr(b.freight),
                hireCost: inr(b.hireCost),
                margin: <Text style={{ fontWeight: '800', color: m >= 0 ? C.green : C.red }}>{inr(m)}</Text>,
                marginPct: <Badge text={mp + '%'} tone={mp < 12 ? 'red' : 'green'} />
              };
            })}
          />
        )}
        <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 8 }}>Margin trigger: below 12% flags red (BGTS business rule).</Text>
      </Card>

      <Card title="Hired LR Ledger (advance + balance payments)">
        {!db.lrs.some(l => l.ownership === 'Hired') ? <Empty text="No hired-vehicle LRs yet. Set Vehicle Ownership = Hired on the LR form." /> : (
          <Table
            cols={[
              { key: 'lrNo', label: 'LR No', width: 100 },
              { key: 'date', label: 'Date', width: 80 },
              { key: 'vendor', label: 'Vendor', width: 130 },
              { key: 'truck', label: 'Truck', width: 90 },
              { key: 'billed', label: 'Billed (Gross)', width: 100 },
              { key: 'hire', label: 'Lorry Hire', width: 90 },
              { key: 'advance', label: 'Advance', width: 90 },
              { key: 'paid', label: 'Bal. Paid', width: 90 },
              { key: 'balance', label: 'Balance Due', width: 100 },
              { key: 'margin', label: 'Margin', width: 130 },
              { key: 'actions', label: '', width: 110 }
            ]}
            rows={db.lrs.filter(l => l.ownership === 'Hired').slice().reverse().map(l => {
              const hv = l.hire || {};
              const paid = sum(hv.payments || [], p => p.amount);
              const bal = lrHireBalance(l);
              const margin = (Number(l.gross) || 0) - (Number(hv.amount) || 0);
              const mp = l.gross > 0 ? Math.round(margin / l.gross * 100) : 0;
              return {
                lrNo: <Text style={{ fontWeight: '700', color: C.navy }}>{l.lrNo}</Text>,
                date: fmtDate(l.date),
                vendor: vendorName(db, hv.vendorId),
                truck: l.truckNo,
                billed: inr(l.gross),
                hire: inr(hv.amount),
                advance: inr(hv.advance),
                paid: inr(paid),
                balance: <Badge text={bal > 0 ? 'BAL ' + inr(bal) : 'SETTLED'} tone={bal > 0 ? 'red' : 'green'} />,
                margin: <Text style={{ fontWeight: '800', color: margin >= 0 ? C.green : C.red }}>{inr(margin)} ({mp}%{mp < 12 ? ' ⚑' : ''})</Text>,
                actions: bal > 0 ? <Btn small tone="green" label="+ Hire Pay" onPress={() => addHirePay(l)} /> : <Badge text="SETTLED" tone="green" />
              };
            })}
          />
        )}
      </Card>

      <Card title="Vendor Dependency">
        {!withVendor.length ? <Empty text="No vendor data yet." /> : (
          <Table
            cols={[
              { key: 'vendor', label: 'Vendor', width: 160 },
              { key: 'trips', label: 'Hired Trips', width: 100 },
              { key: 'share', label: 'Share', width: 80 },
              { key: 'status', label: 'Status', width: 130 }
            ]}
            rows={Object.keys(byV).map(vid => {
              const sh = Math.round(byV[vid] / withVendor.length * 100);
              return {
                vendor: vendorName(db, vid),
                trips: byV[vid],
                share: sh + '%',
                status: <Badge text={sh > 40 ? 'OVER 40%' : 'OK'} tone={sh > 40 ? 'red' : 'green'} />
              };
            })}
          />
        )}
      </Card>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </ScrollView>
  );
}
