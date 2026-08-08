import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, Table, alert } from '../ui';
import { downloadFile } from '../fileIO';
import {
  inr, sum, csvString, clientName, vehicleReg, vendorName, allRenewalItems,
  invPaid, invOutstanding, daysSince
} from '../logic';

/* Same "kpi" card look as the HTML's Report Library — white card, navy top border,
   uppercase label, sub description, action button. Kept local since it's only used here. */
function ReportCard({ label, sub, onPress, width, marginRight }) {
  return (
    <View style={{
      width, marginRight, marginBottom: 10, backgroundColor: '#fff', borderRadius: 10,
      borderWidth: 1, borderColor: C.line, borderTopWidth: 3, borderTopColor: C.navy3, padding: 14
    }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: C.mut, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</Text>
      <Text style={{ fontSize: 11, color: C.mut, marginTop: 6, marginBottom: 10 }}>{sub}</Text>
      <Btn small label="Download CSV" onPress={onPress} />
    </View>
  );
}
function ReportGrid({ items }) {
  const [w, setW] = useState(0);
  const cols = w ? Math.max(2, Math.min(4, Math.floor(w / 190))) : 2;
  const gap = 10;
  const tileW = w ? (w - gap * (cols - 1)) / cols : undefined;
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {items.map((it, i) => (
        <ReportCard key={i} {...it} width={tileW} marginRight={(i % cols === cols - 1) ? 0 : gap} />
      ))}
    </View>
  );
}

export default function ReportsScreen() {
  const { db } = useStore();

  const shareCSV = async (name, rows) => {
    try {
      await downloadFile(name, csvString(rows), 'text/csv');
    } catch (e) { alert('Export error', String(e.message || e)); }
  };

  const reports = [
    ['Trip Register', 'All bookings with status, vehicle, freight', () => shareCSV('BGTS_Trip_Register.csv',
      [['Bk No', 'Date', 'Client', 'Mode', 'Origin', 'Destination', 'Vehicle Type', 'Assign', 'Vehicle', 'Weight MT', 'Freight', 'Hire Cost', 'Status', 'LR No', 'POD']]
        .concat(db.bookings.map(b => [b.bkNo, b.date, clientName(db, b.clientId), b.mode, b.origin, b.destination, b.vehicleType, b.assignType, (b.assignType === 'Owned' ? vehicleReg(db, b.vehicleId) : b.hiredVehicleNo), b.weightMT, b.freight, b.hireCost, b.status, b.lrNo, b.podReceived ? 'Yes' : 'No'])))],
    ['LR Register', 'All consignment notes with POD status', () => shareCSV('BGTS_LR_Register.csv',
      [['LR No', 'Type', 'Date', 'Truck', 'From', 'To', 'Booking Branch', 'Consignor', 'Consignee', 'Billing Party', 'Pay Terms', 'E-Way Bill', 'A Weight', 'C Weight', 'Sub Total', 'IGST', 'CGST', 'SGST', 'Gross', 'POD']]
        .concat(db.lrs.map(l => [l.lrNo, l.lrType, l.date, l.truckNo, l.fromPlace, l.toPlace, l.bookingBranch, (l.consignor || {}).name, (l.consignee || {}).name, l.billingParty, l.payTerms, l.ewayBillNo, l.aWeight, l.cWeight, l.subTotal, l.igstAmt, l.cgstAmt, l.sgstAmt, l.gross, l.pod ? 'Yes' : 'No'])))],
    ['Receivables Ageing', 'Invoice-wise outstanding with buckets', () => shareCSV('BGTS_Receivables.csv',
      [['Invoice', 'Date', 'Client', 'Taxable', 'GST %', 'Total', 'Paid', 'Outstanding', 'Due Date', 'Age Days']]
        .concat(db.invoices.map(i => [i.invNo, i.date, clientName(db, i.clientId), i.amount, i.gstPct, i.total, invPaid(db, i), invOutstanding(db, i), i.dueDate, daysSince(i.date)])))],
    ['Fleet Expense Summary', 'Vehicle-wise expense log', () => shareCSV('BGTS_Fleet_Expenses.csv',
      [['Date', 'Vehicle', 'Category', 'Amount', 'Litres', 'Notes']]
        .concat(db.expenses.map(e => [e.date, vehicleReg(db, e.vehicleId), e.category, e.amount, e.litres, e.notes])))],
    ['Hired Vehicle Margin', 'Vendor trips: billed vs hire margin', () => shareCSV('BGTS_Hired_Margin.csv',
      [['Bk No', 'Date', 'Vendor', 'Vehicle', 'Origin', 'Destination', 'Freight', 'Hire Cost', 'Margin']]
        .concat(db.bookings.filter(b => b.assignType === 'Hired').map(b => [b.bkNo, b.date, vendorName(db, b.hiredVendorId), b.hiredVehicleNo, b.origin, b.destination, b.freight, b.hireCost, (Number(b.freight) || 0) - (Number(b.hireCost) || 0)])))],
    ['Renewals Calendar', 'All tracked expiries with days left', () => shareCSV('BGTS_Renewals.csv',
      [['Item', 'For', 'Expiry', 'Days Left']].concat(allRenewalItems(db).map(r => [r.label, r.detail, r.expiry, r.days])))]
  ];

  const byC = {};
  db.bookings.forEach(b => { byC[b.clientId] = (byC[b.clientId] || 0) + Number(b.freight || 0); });
  const tot = sum(db.bookings, b => b.freight);

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <Card title="Report Library">
        <ReportGrid items={reports.map(r => ({ label: r[0], sub: r[1], onPress: r[2] }))} />
        <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 4 }}>
          CSV files open directly in Excel. These replace the manually-compiled Monday / Friday MIS registers.
        </Text>
      </Card>

      <Card title="Client Revenue Mix">
        {!tot ? <Empty text="No bookings yet." /> : (
          <Table
            cols={[
              { key: 'client', label: 'Client', width: 170 },
              { key: 'booked', label: 'Booked Revenue', width: 120 },
              { key: 'share', label: 'Share', width: 70 },
              { key: 'exposure', label: 'Exposure', width: 160 }
            ]}
            rows={Object.keys(byC).sort((a, b) => byC[b] - byC[a]).map(cid => {
              const sh = Math.round(byC[cid] / tot * 100);
              return {
                client: clientName(db, cid),
                booked: inr(byC[cid]),
                share: sh + '%',
                exposure: sh > 35 ? <Badge text="OVER 35% TRIGGER" tone="red" /> : <Badge text="OK" tone="green" />
              };
            })}
          />
        )}
      </Card>
    </ScrollView>
  );
}
