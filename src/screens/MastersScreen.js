import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useStore } from '../store';
import { C, S, Card, Badge, Btn, Empty, ModalForm, confirmDo, Table, alert } from '../ui';
import {
  uid, fmtDate, daysTo, driverName, byId, removeById, importLegacyTrucks, importLegacyVendors, LEGACY_VENDORS,
  importLegacyTaxMaster, LEGACY_TAX_MASTER, TAX_MODULES
} from '../logic';

const TABS = [['clients', 'Clients'], ['vehicles', 'Vehicles'], ['trucks', 'Trucks'], ['drivers', 'Drivers'], ['vendors', 'Vendors'], ['vendorDirectory', 'Vendor Directory'], ['taxMaster', 'Tax Master'], ['routes', 'Routes'], ['branches', 'Branches']];
const ADD_LABEL = { clients: '+ Add Client', vehicles: '+ Add Vehicle', trucks: '+ Add Truck', drivers: '+ Add Driver', vendors: '+ Add Vendor', vendorDirectory: '+ Add Vendor (Directory)', taxMaster: '+ Add Tax', routes: '+ Add Route', branches: '+ Add Branch / Entity' };

export default function MastersScreen({ navigation, route }) {
  const { db, update } = useStore();
  const params = (route && route.params) || {};
  const [tab, setTab] = useState(params.tab || 'clients');
  const [form, setForm] = useState(null);

  /* ----- field configs ----- */
  const clientFields = (c) => [
    { key: 'name', label: 'Client Name', required: true, value: c && c.name },
    { key: 'gstin', label: 'GSTIN', value: c && c.gstin },
    { key: 'phone', label: 'WhatsApp Phone (with 91)', value: c && c.phone, hint: 'e.g. 919825012345' },
    { key: 'email', label: 'Email', value: c && c.email },
    { key: 'creditDays', label: 'Credit Period (days)', type: 'number', value: c ? c.creditDays : 30 },
    { key: 'creditLimit', label: 'Credit Limit (₹)', type: 'number', value: c ? c.creditLimit : 0, hint: '0 = no limit' },
    { key: 'addr', label: 'Address / City', value: c && c.addr }
  ];
  const vehicleFields = (v) => [
    { key: 'regNo', label: 'Registration No.', required: true, value: v && v.regNo },
    { key: 'make', label: 'Make / Model', value: v && v.make },
    { key: 'model', label: 'Model / Variant', value: v && v.model },
    { key: 'type', label: 'Body / Type', value: v && v.type, hint: 'e.g. Open Body 18ft — must match contract rate lines' },
    { key: 'owned', label: 'Ownership', type: 'select', required: true, value: v ? (v.owned ? 'yes' : 'no') : 'yes', options: [{ v: 'yes', l: 'Owned by BGTS' }, { v: 'no', l: 'Empanelled / Market' }] },
    { key: 'status', label: 'Status', type: 'select', value: (v && v.status) || 'Active', options: ['Active', 'In Workshop', 'Idle', 'Sold', 'Scrapped'].map(x => ({ v: x, l: x })) },
    { key: 'gvw', label: 'GVW (kg)', value: v && v.gvw },
    { key: 'capacityTons', label: 'Load Capacity (Tons)', type: 'number', value: v && v.capacityTons },
    { key: 'fuelType', label: 'Fuel Type', type: 'select', value: v && v.fuelType, options: ['Diesel', 'CNG', 'Electric', 'Petrol'].map(x => ({ v: x, l: x })) },
    { key: 'yearOfMfg', label: 'Year of Manufacture', type: 'number', value: v && v.yearOfMfg },
    { key: 'chassisNo', label: 'Chassis No.', value: v && v.chassisNo },
    { key: 'engineNo', label: 'Engine No.', value: v && v.engineNo },
    { key: 'rcNo', label: 'RC No.', value: v && v.rcNo },
    { key: 'odometerKm', label: 'Odometer Reading (km)', type: 'number', value: v && v.odometerKm },
    { key: 'driverId', label: 'Default Driver', type: 'select', value: v && v.driverId, options: db.drivers.map(d => ({ v: d.id, l: d.name })) },
    { key: 'purchaseDate', label: 'Purchase Date', type: 'date', value: v && v.purchaseDate },
    { key: 'purchasePrice', label: 'Purchase Price (₹)', type: 'number', value: v && v.purchasePrice },
    { key: 'financier', label: 'Financier', value: v && v.financier },
    { key: 'loanAmount', label: 'Loan Amount (₹)', type: 'number', value: v && v.loanAmount },
    { key: 'emiAmount', label: 'EMI Amount (₹)', type: 'number', value: v && v.emiAmount },
    { key: 'emiStartDate', label: 'EMI Start Date', type: 'date', value: v && v.emiStartDate },
    { key: 'emiTenureMonths', label: 'EMI Tenure (months)', type: 'number', value: v && v.emiTenureMonths }
  ];
  const driverFields = (d) => [
    { key: 'name', label: 'Driver Name', required: true, value: d && d.name },
    { key: 'phone', label: 'Phone (with 91)', value: d && d.phone },
    { key: 'licNo', label: 'Licence No.', value: d && d.licNo },
    { key: 'licExpiry', label: 'Licence Expiry', type: 'date', value: d && d.licExpiry }
  ];
  const vendorFields = (v) => [
    { key: 'name', label: 'Vendor Name', required: true, value: v && v.name },
    { key: 'phone', label: 'Phone', value: v && v.phone },
    { key: 'city', label: 'City', value: v && v.city },
    { key: 'rating', label: 'Rating', type: 'select', value: (v && v.rating) || 'B', options: ['A', 'B', 'C'].map(x => ({ v: x, l: x })) }
  ];
  const truckFields = (t) => [
    { key: 'code', label: 'Code', value: t && t.code, hint: 'e.g. TRUCK-0123' },
    { key: 'truckNo', label: 'Truck No.', required: true, value: t && t.truckNo },
    { key: 'ownerName', label: 'Owner Name', value: t && t.ownerName },
    { key: 'contactNo', label: 'Contact No.', value: t && t.contactNo },
    { key: 'panCard', label: 'PAN Card on File', type: 'select', value: t ? (t.panCard ? 'yes' : 'no') : 'no', options: [{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }] },
    { key: 'rcNo', label: 'RC No. on File', type: 'select', value: t ? (t.rcNo ? 'yes' : 'no') : 'no', options: [{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }] },
    { key: 'createdBy', label: 'Created By', value: t && t.createdBy }
  ];
  const vendorDirFields = (v) => [
    { key: 'vendorCode', label: 'Vendor Code', value: v && v.vendorCode, hint: 'e.g. V-0072' },
    { key: 'name', label: 'Name', required: true, value: v && v.name },
    { key: 'contactNo', label: 'Contact No.', value: v && v.contactNo },
    { key: 'panCard', label: 'PAN Card', value: v && v.panCard },
    { key: 'gst', label: 'GST', value: v && v.gst },
    { key: 'type', label: 'Type', type: 'select', value: (v && v.type) || 'VENDOR', options: ['VENDOR', 'AGENT'].map(x => ({ v: x, l: x })) },
    { key: 'createdBy', label: 'Created By', value: v && v.createdBy }
  ];
  const taxFields = (t) => [
    { key: 'sign', label: 'Sign', type: 'select', required: true, value: (t && t.sign) || '+', options: [{ v: '+', l: '+ (Add)' }, { v: '-', l: '− (Less)' }] },
    { key: 'description', label: 'Description', required: true, value: t && t.description },
    { key: 'accountGroup', label: 'Account', required: true, value: t && t.accountGroup, hint: 'Ledger account this charge posts to' },
    { key: 'modules', label: 'Module', type: 'checkboxes', full: true, value: t && t.modules, options: TAX_MODULES.map(m => ({ v: m, l: m })) },
    { key: 'createdBy', label: 'Created By', value: t && t.createdBy }
  ];
  const routeFields = () => [
    { key: 'origin', label: 'Origin', required: true },
    { key: 'destination', label: 'Destination', required: true },
    { key: 'km', label: 'Distance (km)', type: 'number' }
  ];
  const branchFields = (b) => [
    { key: 'name', label: 'Branch Name', required: true, value: b && b.name, hint: 'e.g. VADODARA, SURAT, BDTS-VADODARA' },
    { key: 'entityName', label: 'Entity / Legal Name (optional)', value: b && b.entityName, hint: 'Prints on this branch’s LRs; blank = main company' },
    { key: 'gstin', label: 'GSTIN (optional)', value: b && b.gstin },
    { key: 'addr', label: 'Address', value: b && b.addr },
    { key: 'lrPrefix', label: 'LR Prefix (optional)', value: b && b.lrPrefix },
    { key: 'phone', label: 'Phone', value: b && b.phone }
  ];

  /* ----- add/edit dispatch ----- */
  const add = () => {
    if (tab === 'clients') setForm({ title: 'Add Client', fields: clientFields(null), onSubmit: v => update(d => d.clients.push({ ...v, id: uid('c') })) });
    else if (tab === 'vehicles') setForm({
      title: 'Add Vehicle', fields: vehicleFields(null),
      onSubmit: v => update(d => d.vehicles.push({
        id: uid('v'), regNo: v.regNo, make: v.make, model: v.model, type: v.type, owned: v.owned === 'yes', status: v.status || 'Active',
        gvw: v.gvw, capacityTons: v.capacityTons, fuelType: v.fuelType, yearOfMfg: v.yearOfMfg, chassisNo: v.chassisNo, engineNo: v.engineNo,
        rcNo: v.rcNo, odometerKm: v.odometerKm, driverId: v.driverId, purchaseDate: v.purchaseDate, purchasePrice: v.purchasePrice,
        financier: v.financier, loanAmount: v.loanAmount, emiAmount: v.emiAmount, emiStartDate: v.emiStartDate, emiTenureMonths: v.emiTenureMonths
      }))
    });
    else if (tab === 'trucks') setForm({
      title: 'Add Truck', fields: truckFields(null),
      onSubmit: v => update(d => {
        d.truckMaster = d.truckMaster || [];
        d.truckMaster.push({ id: uid('tm'), code: v.code, truckNo: v.truckNo, ownerName: v.ownerName, contactNo: v.contactNo, panCard: v.panCard === 'yes', rcNo: v.rcNo === 'yes', createdBy: v.createdBy });
      })
    });
    else if (tab === 'drivers') setForm({ title: 'Add Driver', fields: driverFields(null), onSubmit: v => update(d => d.drivers.push({ ...v, id: uid('d') })) });
    else if (tab === 'vendors') setForm({ title: 'Add Vendor', fields: vendorFields(null), onSubmit: v => update(d => d.vendors.push({ ...v, id: uid('ve') })) });
    else if (tab === 'vendorDirectory') setForm({
      title: 'Add Vendor (Directory)', fields: vendorDirFields(null),
      onSubmit: v => update(d => {
        d.vendorDirectory = d.vendorDirectory || [];
        const maxSr = d.vendorDirectory.reduce((m, x) => Math.max(m, x.srNo || 0), 0);
        d.vendorDirectory.push({ id: uid('vd'), srNo: maxSr + 1, vendorCode: v.vendorCode, name: v.name, contactNo: v.contactNo, panCard: v.panCard, gst: v.gst, type: v.type || 'VENDOR', createdBy: v.createdBy });
      })
    });
    else if (tab === 'taxMaster') setForm({
      title: 'Add Tax', fields: taxFields(null),
      onSubmit: v => update(d => {
        d.taxMaster = d.taxMaster || [];
        const maxSr = d.taxMaster.reduce((m, x) => Math.max(m, x.srNo || 0), 0);
        d.taxMaster.push({ id: uid('tx'), srNo: maxSr + 1, sign: v.sign || '+', description: v.description, accountGroup: v.accountGroup, modules: v.modules || '', createdBy: v.createdBy });
      })
    });
    else if (tab === 'branches') setForm({ title: 'Add Branch / Entity', fields: branchFields(null), onSubmit: v => update(d => d.branches.push({ ...v, id: uid('br'), name: String(v.name).toUpperCase() })) });
    else setForm({ title: 'Add Route', fields: routeFields(), onSubmit: v => update(d => d.routes.push({ ...v, id: uid('r') })) });
  };
  const editBranch = (bb) => setForm({ title: 'Edit ' + bb.name, fields: branchFields(bb), onSubmit: v => update(d => { const x = byId(d.branches, bb.id); if (x) { Object.keys(v).forEach(k => { x[k] = v[k]; }); x.name = String(x.name).toUpperCase(); } }) });
  const editClient = (c) => setForm({ title: 'Edit Client', fields: clientFields(c), onSubmit: v => update(d => { const x = byId(d.clients, c.id); if (x) Object.keys(v).forEach(k => { x[k] = v[k]; }); }) });
  const editVehicle = (vv) => setForm({
    title: 'Edit Vehicle', fields: vehicleFields(vv),
    onSubmit: v => update(d => {
      const x = byId(d.vehicles, vv.id);
      if (x) {
        x.regNo = v.regNo; x.make = v.make; x.model = v.model; x.type = v.type; x.owned = v.owned === 'yes'; x.status = v.status || 'Active';
        x.gvw = v.gvw; x.capacityTons = v.capacityTons; x.fuelType = v.fuelType; x.yearOfMfg = v.yearOfMfg; x.chassisNo = v.chassisNo; x.engineNo = v.engineNo;
        x.rcNo = v.rcNo; x.odometerKm = v.odometerKm; x.driverId = v.driverId; x.purchaseDate = v.purchaseDate; x.purchasePrice = v.purchasePrice;
        x.financier = v.financier; x.loanAmount = v.loanAmount; x.emiAmount = v.emiAmount; x.emiStartDate = v.emiStartDate; x.emiTenureMonths = v.emiTenureMonths;
      }
    })
  });
  const editTruck = (t) => setForm({
    title: 'Edit ' + (t.code || t.truckNo), fields: truckFields(t),
    onSubmit: v => update(d => {
      const x = byId(d.truckMaster, t.id);
      if (x) { x.code = v.code; x.truckNo = v.truckNo; x.ownerName = v.ownerName; x.contactNo = v.contactNo; x.panCard = v.panCard === 'yes'; x.rcNo = v.rcNo === 'yes'; x.createdBy = v.createdBy; }
    })
  });
  const doImportLegacyTrucks = () => update(d => {
    const added = importLegacyTrucks(d);
    setTimeout(() => alert('Truck list imported', added + ' truck(s) added' + (added < 121 ? ', ' + (121 - added) + ' already on file (skipped).' : '.')), 100);
  });
  const doImportLegacyVendors = () => update(d => {
    const added = importLegacyVendors(d);
    setTimeout(() => alert('Vendor Directory imported', added + ' vendor(s) added' + (added < LEGACY_VENDORS.length ? ', ' + (LEGACY_VENDORS.length - added) + ' already on file (skipped).' : '.')), 100);
  });
  const doImportLegacyTaxMaster = () => update(d => {
    const added = importLegacyTaxMaster(d);
    setTimeout(() => alert('Tax Master imported', added + ' entr' + (added === 1 ? 'y' : 'ies') + ' added' + (added < LEGACY_TAX_MASTER.length ? ', ' + (LEGACY_TAX_MASTER.length - added) + ' already on file (skipped).' : '.')), 100);
  });
  const editDriver = (dd) => setForm({ title: 'Edit Driver', fields: driverFields(dd), onSubmit: v => update(d => { const x = byId(d.drivers, dd.id); if (x) Object.keys(v).forEach(k => { x[k] = v[k]; }); }) });
  const editVendor = (vv) => setForm({ title: 'Edit Vendor', fields: vendorFields(vv), onSubmit: v => update(d => { const x = byId(d.vendors, vv.id); if (x) Object.keys(v).forEach(k => { x[k] = v[k]; }); }) });
  const editVendorDir = (vv) => setForm({
    title: 'Edit ' + (vv.name || vv.vendorCode || 'Vendor'), fields: vendorDirFields(vv),
    onSubmit: v => update(d => {
      const x = byId(d.vendorDirectory, vv.id);
      if (x) { x.vendorCode = v.vendorCode; x.name = v.name; x.contactNo = v.contactNo; x.panCard = v.panCard; x.gst = v.gst; x.type = v.type || 'VENDOR'; x.createdBy = v.createdBy; }
    })
  });
  const editTax = (t) => setForm({
    title: 'Edit ' + t.description, fields: taxFields(t),
    onSubmit: v => update(d => {
      const x = byId(d.taxMaster, t.id);
      if (x) { x.sign = v.sign || '+'; x.description = v.description; x.accountGroup = v.accountGroup; x.modules = v.modules || ''; x.createdBy = v.createdBy; }
    })
  });

  /* Arriving from VehicleDetailScreen's "Edit Vehicle" button — jump straight
     into the edit form for that vehicle, then clear the param so navigating
     back here later doesn't reopen it. */
  useEffect(() => {
    if (params.tab) setTab(params.tab);
    if (params.editVehicleId) {
      const veh = byId(db.vehicles, params.editVehicleId);
      if (veh) editVehicle(veh);
      if (navigation && navigation.setParams) navigation.setParams({ editVehicleId: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.editVehicleId]);

  const rowActions = (onEdit, onDel) => (
    <View style={S.wrapRow}>
      {onEdit ? <Btn small tone="ghost" label="Edit" onPress={onEdit} /> : null}
      <Btn small tone="red" label="✕" onPress={onDel} />
    </View>
  );

  return (
    <View style={S.screen}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 14, paddingBottom: 6 }}>
        {TABS.map(t => (
          <TouchableOpacity key={t[0]} onPress={() => setTab(t[0])} style={{
            backgroundColor: tab === t[0] ? C.navy : '#fff', borderWidth: 1,
            borderColor: tab === t[0] ? C.navy : C.line2, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 6
          }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tab === t[0] ? '#fff' : C.txt }}>{t[1]}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        {tab === 'trucks' ? <Btn small tone="ghost" label="Import Legacy Truck List" onPress={doImportLegacyTrucks} /> : null}
        {tab === 'vendorDirectory' ? <Btn small tone="ghost" label="Import ATTrans Vendor List" onPress={doImportLegacyVendors} /> : null}
        {tab === 'taxMaster' ? <Btn small tone="ghost" label="Import ATTrans Tax Master" onPress={doImportLegacyTaxMaster} /> : null}
        <Btn small label={ADD_LABEL[tab] || '+ Add'} tone="amber" onPress={add} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: 60 }}>
        <Card>
          {tab === 'clients' && (!db.clients.length ? <Empty text="No clients." /> : (
            <Table
              cols={[
                { key: 'name', label: 'Name', width: 150 },
                { key: 'gstin', label: 'GSTIN', width: 130 },
                { key: 'phone', label: 'Phone (WA)', width: 120 },
                { key: 'email', label: 'Email', width: 150 },
                { key: 'credit', label: 'Credit Days', width: 90 },
                { key: 'actions', label: '', width: 150 }
              ]}
              rows={db.clients.map(c => ({
                name: <Text style={{ fontWeight: '700', color: C.navy }}>{c.name}</Text>,
                gstin: c.gstin || 'no GSTIN',
                phone: c.phone || 'no phone',
                email: c.email || '—',
                credit: (c.creditDays || '—') + 'd',
                actions: rowActions(() => editClient(c), () => confirmDo('Delete client?', () => update(d => removeById(d.clients, c.id))))
              }))}
            />
          ))}
          {tab === 'vehicles' && (!db.vehicles.length ? <Empty text="No vehicles." /> : (
            <Table
              cols={[
                { key: 'regNo', label: 'Reg No', width: 110 },
                { key: 'make', label: 'Make / Model', width: 150 },
                { key: 'type', label: 'Type', width: 120 },
                { key: 'owned', label: 'Ownership', width: 110 },
                { key: 'gvw', label: 'GVW (kg)', width: 90 },
                { key: 'driver', label: 'Default Driver', width: 130 },
                { key: 'actions', label: '', width: 150 }
              ]}
              rows={db.vehicles.map(v => ({
                regNo: <Text style={{ fontWeight: '700', color: C.navy }}>{v.regNo}</Text>,
                make: v.make || '—',
                type: v.type || '—',
                owned: <Badge text={v.owned ? 'OWNED' : 'EMPANELLED'} tone={v.owned ? 'navy' : 'purple'} />,
                gvw: v.gvw || '—',
                driver: driverName(db, v.driverId),
                actions: (
                  <View style={S.wrapRow}>
                    <Btn small tone="ghost" label="View" onPress={() => navigation.navigate('VehicleDetail', { vehicleId: v.id })} />
                    <Btn small tone="ghost" label="Edit" onPress={() => editVehicle(v)} />
                    <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete vehicle?', () => update(d => removeById(d.vehicles, v.id)))} />
                  </View>
                )
              }))}
            />
          ))}
          {tab === 'trucks' && (!(db.truckMaster || []).length ? <Empty text="No trucks yet. Add one, or use “Import Legacy Truck List” above." /> : (
            <Table
              cols={[
                { key: 'code', label: 'Code', width: 100 },
                { key: 'truckNo', label: 'Truck No', width: 130 },
                { key: 'ownerName', label: 'Owner Name', width: 150 },
                { key: 'contactNo', label: 'Contact No', width: 120 },
                { key: 'panCard', label: 'PAN Card', width: 90 },
                { key: 'rcNo', label: 'RC No', width: 90 },
                { key: 'createdBy', label: 'Created By', width: 120 },
                { key: 'actions', label: '', width: 150 }
              ]}
              rows={db.truckMaster.map(t => ({
                code: t.code || '—',
                truckNo: <Text style={{ fontWeight: '700', color: C.navy }}>{t.truckNo}</Text>,
                ownerName: t.ownerName || '—',
                contactNo: t.contactNo || '—',
                panCard: <Badge text={t.panCard ? 'YES' : 'NO'} tone={t.panCard ? 'green' : 'red'} />,
                rcNo: <Badge text={t.rcNo ? 'YES' : 'NO'} tone={t.rcNo ? 'green' : 'red'} />,
                createdBy: t.createdBy || '—',
                actions: rowActions(() => editTruck(t), () => confirmDo('Delete truck ' + (t.truckNo || t.code) + '?', () => update(d => removeById(d.truckMaster, t.id))))
              }))}
            />
          ))}
          {tab === 'drivers' && (!db.drivers.length ? <Empty text="No drivers." /> : (
            <Table
              cols={[
                { key: 'name', label: 'Name', width: 140 },
                { key: 'phone', label: 'Phone', width: 120 },
                { key: 'licNo', label: 'Licence No.', width: 120 },
                { key: 'licExpiry', label: 'Licence Expiry', width: 130 },
                { key: 'actions', label: '', width: 150 }
              ]}
              rows={db.drivers.map(dd => {
                const dl = daysTo(dd.licExpiry);
                return {
                  name: <Text style={{ fontWeight: '700', color: C.navy }}>{dd.name}</Text>,
                  phone: dd.phone || 'no phone',
                  licNo: dd.licNo || '—',
                  licExpiry: dl != null && dl <= 30
                    ? <Text>{fmtDate(dd.licExpiry)} <Badge text={dl < 0 ? 'EXPIRED' : dl + 'd'} tone="red" /></Text>
                    : fmtDate(dd.licExpiry),
                  actions: rowActions(() => editDriver(dd), () => confirmDo('Delete driver?', () => update(d => removeById(d.drivers, dd.id))))
                };
              })}
            />
          ))}
          {tab === 'vendors' && (!db.vendors.length ? <Empty text="No vendors." /> : (
            <Table
              cols={[
                { key: 'name', label: 'Name', width: 150 },
                { key: 'phone', label: 'Phone', width: 120 },
                { key: 'city', label: 'City', width: 120 },
                { key: 'rating', label: 'Rating', width: 80 },
                { key: 'actions', label: '', width: 150 }
              ]}
              rows={db.vendors.map(v => ({
                name: <Text style={{ fontWeight: '700', color: C.navy }}>{v.name}</Text>,
                phone: v.phone || 'no phone',
                city: v.city || '—',
                rating: v.rating || '—',
                actions: rowActions(() => editVendor(v), () => confirmDo('Delete vendor?', () => update(d => removeById(d.vendors, v.id))))
              }))}
            />
          ))}
          {tab === 'vendorDirectory' && (!(db.vendorDirectory || []).length ? <Empty text="No vendor directory entries yet. Add one, or use “Import ATTrans Vendor List” above." /> : (
            <Table
              cols={[
                { key: 'srNo', label: 'Sr No', width: 60 },
                { key: 'vendorCode', label: 'Vendor Code', width: 100 },
                { key: 'name', label: 'Name', width: 170 },
                { key: 'contactNo', label: 'Contact No', width: 110 },
                { key: 'panCard', label: 'PAN Card', width: 110 },
                { key: 'gst', label: 'GST', width: 150 },
                { key: 'type', label: 'Type', width: 80 },
                { key: 'createdBy', label: 'Created By', width: 110 },
                { key: 'actions', label: '', width: 150 }
              ]}
              rows={[...db.vendorDirectory].sort((a, b) => (a.srNo || 0) - (b.srNo || 0)).map(v => ({
                srNo: v.srNo != null ? v.srNo : '—',
                vendorCode: v.vendorCode || '—',
                name: <Text style={{ fontWeight: '700', color: C.navy }}>{v.name || '(blank in source)'}</Text>,
                contactNo: v.contactNo || '—',
                panCard: v.panCard || '—',
                gst: v.gst || '—',
                type: <Badge text={v.type || 'VENDOR'} tone={v.type === 'AGENT' ? 'purple' : 'navy'} />,
                createdBy: v.createdBy || '—',
                actions: rowActions(() => editVendorDir(v), () => confirmDo('Delete ' + (v.name || v.vendorCode || 'this entry') + '?', () => update(d => removeById(d.vendorDirectory, v.id))))
              }))}
            />
          ))}
          {tab === 'taxMaster' && (!(db.taxMaster || []).length ? <Empty text="No tax master entries yet. Add one, or use “Import ATTrans Tax Master” above." /> : (
            <Table
              cols={[
                { key: 'srNo', label: 'Sr No', width: 60 },
                { key: 'sign', label: 'Sign', width: 60 },
                { key: 'description', label: 'Description', width: 150 },
                { key: 'accountGroup', label: 'Account', width: 160 },
                { key: 'modules', label: 'Module', width: 260 },
                { key: 'createdBy', label: 'Created By', width: 110 },
                { key: 'actions', label: '', width: 150 }
              ]}
              rows={[...db.taxMaster].sort((a, b) => (a.srNo || 0) - (b.srNo || 0)).map(t => ({
                srNo: t.srNo != null ? t.srNo : '—',
                sign: <Badge text={t.sign === '-' ? '−' : '+'} tone={t.sign === '-' ? 'red' : 'green'} />,
                description: <Text style={{ fontWeight: '700', color: C.navy }}>{t.description}</Text>,
                accountGroup: t.accountGroup || '—',
                modules: t.modules || '—',
                createdBy: t.createdBy || '—',
                actions: rowActions(() => editTax(t), () => confirmDo('Delete ' + (t.description || 'this entry') + '?', () => update(d => removeById(d.taxMaster, t.id))))
              }))}
            />
          ))}
          {tab === 'routes' && (!db.routes.length ? <Empty text="No routes." /> : (
            <Table
              cols={[
                { key: 'origin', label: 'Origin', width: 150 },
                { key: 'destination', label: 'Destination', width: 150 },
                { key: 'km', label: 'Distance (km)', width: 110 },
                { key: 'actions', label: '', width: 80 }
              ]}
              rows={db.routes.map(r => ({
                origin: <Text style={{ fontWeight: '700', color: C.navy }}>{r.origin}</Text>,
                destination: r.destination,
                km: r.km || '—',
                actions: <Btn small tone="red" label="✕" onPress={() => confirmDo('Delete route?', () => update(d => removeById(d.routes, r.id)))} />
              }))}
            />
          ))}
          {tab === 'branches' && (
            <Table
              cols={[
                { key: 'branch', label: 'Branch', width: 130 },
                { key: 'entity', label: 'Entity (prints on LR)', width: 170 },
                { key: 'gstin', label: 'GSTIN', width: 130 },
                { key: 'lrPrefix', label: 'LR Prefix', width: 110 },
                { key: 'actions', label: '', width: 150 }
              ]}
              rows={(db.branches || []).map((bb, i) => ({
                branch: (
                  <View>
                    <Text style={{ fontWeight: '700', color: C.navy }}>{bb.name}</Text>
                    {i === 0 ? <Badge text="MAIN" tone="navy" /> : null}
                  </View>
                ),
                entity: bb.entityName || 'company default',
                gstin: bb.gstin || '—',
                lrPrefix: bb.lrPrefix || '—',
                actions: rowActions(() => editBranch(bb), i === 0 ? () => alert('Protected', 'The main branch cannot be deleted.') : () => {
                  const used = db.lrs.some(l => l.branchId === bb.id) || db.bookings.some(b => b.branchId === bb.id);
                  if (used) { alert('In use', 'This branch has bookings/LRs tagged to it — reassign them first.'); return; }
                  confirmDo('Delete branch ' + bb.name + '?', () => update(d => removeById(d.branches, bb.id)));
                })
              }))}
            />
          )}
        </Card>
      </ScrollView>
      <ModalForm form={form} onClose={() => setForm(null)} />
    </View>
  );
}
