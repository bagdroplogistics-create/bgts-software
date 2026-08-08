import React, { useState } from 'react';
import { NavigationContainer, DefaultTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text, Pressable, useWindowDimensions, ScrollView } from 'react-native';
import { StoreProvider } from './src/store';
import { C, Logo } from './src/ui';

import DashboardScreen from './src/screens/DashboardScreen';
import BookingsScreen from './src/screens/BookingsScreen';
import LRScreen from './src/screens/LRScreen';
import LRFormScreen from './src/screens/LRFormScreen';
import LRImportScreen from './src/screens/LRImportScreen';
import InquiriesScreen from './src/screens/InquiriesScreen';
import BankingScreen from './src/screens/BankingScreen';
import InvoiceImportScreen from './src/screens/InvoiceImportScreen';
import AccDashScreen from './src/screens/AccDashScreen';
import PODScreen from './src/screens/PODScreen';
import BackupScreen from './src/screens/BackupScreen';
import CompanyScreen from './src/screens/CompanyScreen';
import LHCScreen from './src/screens/LHCScreen';
import AdvancesScreen from './src/screens/AdvancesScreen';
import FleetScreen from './src/screens/FleetScreen';
import HiredScreen from './src/screens/HiredScreen';
import RenewalsScreen from './src/screens/RenewalsScreen';
import ContractsScreen from './src/screens/ContractsScreen';
import AccountingScreen from './src/screens/AccountingScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import MastersScreen from './src/screens/MastersScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: C.bg, primary: C.amber }
};

/* Matches the HTML build's sidebar exactly: same groups, same order, same item text.
   LHC / Banking / Accounts Dashboard / Driver Khata / Backup screens still exist and are
   still reachable by navigation.navigate(...) from inside other screens (e.g. Dashboard's
   Quick Actions) — they're just not exposed as their own sidebar links, same as the HTML,
   which only surfaces them (if at all) as tabs inside Accounting rather than top-level nav. */
const NAV_GROUPS = [
  {
    title: 'OVERVIEW',
    items: [
      ['Dashboard', 'Dashboard', '⌂'],
    ]
  },
  {
    title: 'OPERATIONS',
    items: [
      ['Inquiries', 'Inquiries', '✆'],
      ['Bookings', 'Bookings', '▣'],
      ['LR / Consignment Notes', 'LR', '▤'],
      ['POD Update', 'POD', '✓'],
    ]
  },
  {
    title: 'FLEET',
    items: [
      ['Owned Fleet', 'Fleet', '▣'],
      ['Hired Vehicles', 'Hired', '▢'],
      ['Renewals & Compliance', 'Renewals', '⚑'],
    ]
  },
  {
    title: 'COMMERCIAL',
    items: [
      ['Contracts & Tenders', 'Contracts', '§'],
      ['Accounting', 'Accounting', '₹'],
    ]
  },
  {
    title: 'INTELLIGENCE',
    items: [
      ['Reports', 'Reports', '≡'],
    ]
  },
  {
    title: 'SYSTEM',
    items: [
      ['Masters', 'Masters', '⚙'],
      ['Settings & Backup', 'Settings', '✎'],
    ]
  }
];

const TITLES = {
  Dashboard: 'Dashboard',
  Bookings: 'Bookings',
  Inquiries: 'Inquiries',
  LR: 'LR / Consignment Notes',
  POD: 'POD Update',
  LHC: 'LHC / Truck Hire',
  Hired: 'Hired Vehicles',
  AccDash: 'Accounts Dashboard',
  Banking: 'Banking / Reconciliation',
  Accounting: 'Accounting',
  Advances: 'Driver Khata',
  Fleet: 'Owned Fleet',
  Renewals: 'Renewals & Compliance',
  Contracts: 'Contracts & Tenders',
  Reports: 'Reports',
  Masters: 'Masters',
  Settings: 'Settings & Backup',
  Backup: 'Invoice Backup / Register',
  Company: 'Company Dashboard',
  LRForm: 'Add / Edit LR',
  LRImport: 'Import LRs (CSV)',
  InvoiceImport: 'Import Invoices (CSV)'
};

function WebSidebar({ navigationRef, routeName }) {
  const { width } = useWindowDimensions();
  const compact = width < 860;
  const sidebarWidth = compact ? 64 : 230;

  return (
    <View style={{
      width: sidebarWidth,
      backgroundColor: C.navy,
      minHeight: '100%',
      borderRightWidth: 1,
      borderRightColor: '#102c4d',
      flexShrink: 0
    }}>
      <View style={{
        paddingVertical: 16,
        paddingHorizontal: compact ? 10 : 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.12)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
      }}>
        <Logo size={40} />
        {!compact ? (
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>BGTS-OS</Text>
            <Text style={{ color: '#c7d0dc', fontSize: 9, lineHeight: 12 }}>BARODA GOODS TRANSPORT</Text>
            <Text style={{ color: '#c7d0dc', fontSize: 9, lineHeight: 12 }}>SERVICE PVT. LTD. · EST. 1950</Text>
          </View>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
        {NAV_GROUPS.map(group => (
          <View key={group.title} style={{ marginBottom: 6 }}>
            {!compact ? (
              <Text style={{
                color: '#6b7a8f',
                fontSize: 9.5,
                fontWeight: '800',
                letterSpacing: 1.1,
                paddingHorizontal: 15,
                paddingTop: 10,
                paddingBottom: 4
              }}>{group.title}</Text>
            ) : null}

            {group.items.map(([label, route, icon]) => {
              const active = routeName === route;
              return (
                <Pressable
                  key={route}
                  onPress={() => navigationRef.current?.navigate(route)}
                  style={({ hovered }) => ({
                    minHeight: 38,
                    paddingHorizontal: compact ? 0 : 15,
                    marginRight: compact ? 0 : 8,
                    borderLeftWidth: 3,
                    borderLeftColor: active ? C.amber : 'transparent',
                    backgroundColor: active ? 'rgba(232,163,61,0.12)' : (hovered ? 'rgba(255,255,255,0.06)' : 'transparent'),
                    borderTopRightRadius: 8,
                    borderBottomRightRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: compact ? 'center' : 'flex-start',
                    gap: 10
                  })}
                >
                  <Text style={{ width: 18, textAlign: 'center', color: active ? C.amber : '#c7d0dc', fontSize: 16 }}>{icon}</Text>
                  {!compact ? (
                    <Text style={{ color: active ? C.amber : '#c7d0dc', fontSize: 13, fontWeight: active ? '700' : '500' }}>
                      {label}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {!compact ? (
        <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
          <Text style={{ color: '#6b7a8f', fontSize: 10 }}>v1.0 · Phase 1 Build</Text>
          <Text style={{ color: '#6b7a8f', fontSize: 10 }}>Confidential — Internal Use</Text>
        </View>
      ) : null}
    </View>
  );
}

function WebTopbar({ routeName }) {
  const title = TITLES[routeName] || routeName;
  const now = new Date();
  const date = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <View style={{
      height: 62,
      backgroundColor: '#fff',
      borderBottomWidth: 1,
      borderBottomColor: C.line,
      paddingHorizontal: 24,
      flexDirection: 'row',
      alignItems: 'center',
      position: 'relative'
    }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, backgroundColor: C.amber }} />
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.navy }}>{title}</Text>
      <View style={{ flex: 1 }} />
      <Text style={{ fontSize: 12, color: C.mut }}>{date}</Text>
    </View>
  );
}

function WebShell({ navigationRef, routeName }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg, ...(Platform.OS === 'web' ? { minHeight: '100vh' } : {}) }}>
      <WebSidebar navigationRef={navigationRef} routeName={routeName} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <WebTopbar routeName={routeName} />
        <Stack.Navigator screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.bg }
        }}>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Bookings" component={BookingsScreen} />
          <Stack.Screen name="LR" component={LRScreen} options={{ title: 'LR / Consignment Notes' }} />
          <Stack.Screen name="LRForm" component={LRFormScreen} options={{ title: 'Add / Edit LR' }} />
          <Stack.Screen name="LRImport" component={LRImportScreen} options={{ title: 'Import LRs (CSV)' }} />
          <Stack.Screen name="Inquiries" component={InquiriesScreen} />
          <Stack.Screen name="Banking" component={BankingScreen} options={{ title: 'Banking / Reconciliation' }} />
          <Stack.Screen name="InvoiceImport" component={InvoiceImportScreen} options={{ title: 'Import Invoices (CSV)' }} />
          <Stack.Screen name="AccDash" component={AccDashScreen} options={{ title: 'Accounts Dashboard' }} />
          <Stack.Screen name="POD" component={PODScreen} options={{ title: 'POD Update' }} />
          <Stack.Screen name="Backup" component={BackupScreen} options={{ title: 'Invoice Backup (Register)' }} />
          <Stack.Screen name="Company" component={CompanyScreen} options={{ title: 'Company Dashboard' }} />
          <Stack.Screen name="LHC" component={LHCScreen} options={{ title: 'LHC / Truck Hire' }} />
          <Stack.Screen name="Advances" component={AdvancesScreen} options={{ title: 'Driver Khata (Advances)' }} />
          <Stack.Screen name="Fleet" component={FleetScreen} options={{ title: 'Owned Fleet' }} />
          <Stack.Screen name="Hired" component={HiredScreen} options={{ title: 'Hired Vehicles' }} />
          <Stack.Screen name="Renewals" component={RenewalsScreen} options={{ title: 'Renewals & Compliance' }} />
          <Stack.Screen name="Contracts" component={ContractsScreen} options={{ title: 'Contracts & Tenders' }} />
          <Stack.Screen name="Accounting" component={AccountingScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />
          <Stack.Screen name="Masters" component={MastersScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings & Backup' }} />
        </Stack.Navigator>
      </View>
    </View>
  );
}

function MobileShell() {
  return (
    <Stack.Navigator screenOptions={{
      headerStyle: { backgroundColor: C.navy },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: '800' }
    }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'BGTS-OS' }} />
      <Stack.Screen name="Bookings" component={BookingsScreen} />
      <Stack.Screen name="LR" component={LRScreen} options={{ title: 'LR / Consignment Notes' }} />
      <Stack.Screen name="LRForm" component={LRFormScreen} options={{ title: 'Add / Edit LR' }} />
      <Stack.Screen name="LRImport" component={LRImportScreen} options={{ title: 'Import LRs (CSV)' }} />
      <Stack.Screen name="Inquiries" component={InquiriesScreen} />
      <Stack.Screen name="Banking" component={BankingScreen} options={{ title: 'Banking / Reconciliation' }} />
      <Stack.Screen name="InvoiceImport" component={InvoiceImportScreen} options={{ title: 'Import Invoices (CSV)' }} />
      <Stack.Screen name="AccDash" component={AccDashScreen} options={{ title: 'Accounts Dashboard' }} />
      <Stack.Screen name="POD" component={PODScreen} options={{ title: 'POD Update' }} />
      <Stack.Screen name="Backup" component={BackupScreen} options={{ title: 'Invoice Backup (Register)' }} />
      <Stack.Screen name="Company" component={CompanyScreen} options={{ title: 'Company Dashboard' }} />
      <Stack.Screen name="LHC" component={LHCScreen} options={{ title: 'LHC / Truck Hire' }} />
      <Stack.Screen name="Advances" component={AdvancesScreen} options={{ title: 'Driver Khata (Advances)' }} />
      <Stack.Screen name="Fleet" component={FleetScreen} options={{ title: 'Owned Fleet' }} />
      <Stack.Screen name="Hired" component={HiredScreen} options={{ title: 'Hired Vehicles' }} />
      <Stack.Screen name="Renewals" component={RenewalsScreen} options={{ title: 'Renewals & Compliance' }} />
      <Stack.Screen name="Contracts" component={ContractsScreen} options={{ title: 'Contracts & Tenders' }} />
      <Stack.Screen name="Accounting" component={AccountingScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Masters" component={MastersScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings & Backup' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const [routeName, setRouteName] = useState('Dashboard');
  const syncRoute = () => setRouteName(navigationRef.current?.getCurrentRoute()?.name || 'Dashboard');

  return (
    <StoreProvider>
      <NavigationContainer ref={navigationRef} theme={theme} onReady={syncRoute} onStateChange={syncRoute}>
        <StatusBar style="light" />
        {/* Same sidebar navigation + layout as the BGTS-OS design on every platform.
            WebSidebar already collapses to a 64px icon rail below 860px width,
            so it reads the same on a phone as the desktop version does.
            Sidebar/topbar read the active route from this top-level state instead of
            useNavigation()/useNavigationState(), since they render outside the
            Stack.Navigator subtree and those hooks require being inside a Navigator. */}
        <WebShell navigationRef={navigationRef} routeName={routeName} />
      </NavigationContainer>
    </StoreProvider>
  );
}
