import React from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty } from '../ui';
import {
  inr, sum, csvString, clientName, vehicleReg, vendorName, allRenewalItems,
  invPaid, invOutstanding, daysSince, lhcPaid, lhcBalance
} from '../logic';

export default function ReportsScreen() {
  const { db } = useStore();

  const shareCSV = async (name, rows) => {
    try {
      const uri = FileSystem.cacheDirectory + name;
      await FileSystem.writeAsStringAsync(uri, csvString(rows));
      const ok = await Sharing.isAvailableAsync();
      if (ok) await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: name });
      else Alert.alert('Saved', 'CSV written to:\n' + uri);
    } catch (e) { Alert.alert('Export error', String(e.message || e)); }
  };

  const reports = [
    ['Trip Register', 'All bookings with status, vehicle, freight', () => shareCSV('BGTS_Trip_Register.csv',
      [['Bk No', 'Date', 'Client', 'Mode', 'Origin', 'Destination', 'Vehicle Type', 'Assign', 'Vehicle', 'Weight MT', 'Freight', 'Hire Cost', 'Status', 'LR No', 'POD']]
        .concat(db.bookings.map(b => [b.bkNo, b.date, clientName(db, b.clientId), b.mode, b.origin, b.destination, b.vehicleType, b.assignType, (b.assignType === 'Owned' ? vehicleReg(db, b.vehicleId) : b.hiredVehicleNo), b.weightMT, b.freight, b.hireCost, b.status, b.lrNo, b.podReceived ? 'Yes' : 'No'])))],
    ['LR Register', 'All consignment notes (incl. standalone LRs)', () => shareCSV('BGTS_LR_Register.csv',
      [['LR No', 'Type', 'Date', 'Truck', 'From', 'To', 'Consignor', 'Consignee', 'Pay Terms', 'E-Way Bill', 'A Wt', 'C Wt', 'Sub Total', 'IGST', 'CGST', 'SGST', 'Gross', 'POD']]
        .concat(db.lrs.map(l => [l.lrNo, l.lrType, l.date, l.truckNo, l.fromPlace, l.toPlace, (l.consignor || {}).name, (l.consignee || {}).name, l.payTerms, l.ewayBillNo, l.aWeight, l.cWeight, l.subTotal, l.igstAmt, l.cgstAmt, l.sgstAmt, l.gross, l.pod ? 'Yes' : 'No'])))],
    ['LHC Register', 'Truck hire contracts with TDS and balances', () => shareCSV('BGTS_LHC_Register.csv',
      [['LHC No', 'Date', 'Vendor', 'Truck', 'From', 'To', 'LRs', 'Lorry Hire', 'Advance', 'Deductions', 'TDS %', 'TDS Amt', 'Paid', 'Balance']]
        .concat(db.lhcs.map(l => [l.lhcNo, l.date, vendorName(db, l.vendorId), l.truckNo, l.fromPlace, l.toPlace, l.lrNos, l.lorryHire, l.advance, l.deductions, l.tdsPct, l.tdsAmt, lhcPaid(l), lhcBalance(l)])))],
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
      <Card title="Report Library — share as CSV (opens in Excel)">
        {reports.map((r, i) => (
          <View key={i} style={[S.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.navy }}>{r[0]}</Text>
              <Text style={{ fontSize: 11, color: C.mut }}>{r[1]}</Text>
            </View>
            <Btn small label="Share CSV" onPress={r[2]} />
          </View>
        ))}
      </Card>

      <Card title="Client Revenue Mix">
        {!tot ? <Empty text="No bookings yet." /> :
          Object.keys(byC).sort((a, b) => byC[b] - byC[a]).map(cid => {
            const sh = Math.round(byC[cid] / tot * 100);
            return (
              <View key={cid} style={[S.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
                <Text style={{ fontSize: 12.5, color: C.txt, fontWeight: '600', flex: 1 }}>{clientName(db, cid)} · {inr(byC[cid])}</Text>
                <Badge text={sh + '%' + (sh > 35 ? ' OVER 35%' : '')} tone={sh > 35 ? 'red' : 'green'} />
              </View>
            );
          })}
      </Card>
    </ScrollView>
  );
}
