import React, { useState } from 'react';
import { NavigationContainer, DefaultTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text, Pressable, useWindowDimensions, ScrollView, ActivityIndicator } from 'react-native';
import { StoreProvider } from './src/store';
import { AuthProvider, useAuth } from './src/AuthProvider';
import LoginScreen from './src/screens/LoginScreen';
import { C, Logo, AlertHost } from './src/ui';

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
  LRImport: 'Import LRs (CSV / Excel)',
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
      borderRightWidth: 1,
      borderRightColor: C.navy2,
      flexShrink: 0,
      /* Sticky, not just tall: pins the logo/nav rail to the viewport so it no
         longer scrolls away with long page content (the dashboard's tall list
         of cards used to drag the whole sidebar — including the logo header —
         off-screen). position:'sticky' + top:0 + a viewport-height box is the
         standard fix and doesn't depend on getting nested flex/overflow
         containers exactly right the way an overflow:hidden approach does. */
      ...(Platform.OS === 'web' ? { position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' } : { minHeight: '100%' })
    }}>
      <View style={{
        paddingVertical: 14,
        paddingHorizontal: compact ? 8 : 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.12)',
        alignItems: 'flex-start'
      }}>
        {/* White card behind the logo — the logo's gray/charcoal wordmark has
            poor contrast directly on the dark navy sidebar, so it sits on its
            own white plate with breathing room instead. Compact rail (<860px)
            gets a smaller logo + tighter padding so it still fits the ~64px rail. */}
        <View style={{
          backgroundColor: '#fff',
          borderRadius: 10,
          paddingVertical: compact ? 6 : 10,
          paddingHorizontal: compact ? 8 : 16
        }}>
          <Logo size={compact ? 26 : 42} />
        </View>
        {!compact ? (
          <Text style={{ color: C.line2, fontSize: 10.5, fontWeight: '700', marginTop: 8, textAlign: 'left' }}>
            Baroda Goods Transport Service Pvt. Ltd.
          </Text>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
        {NAV_GROUPS.map(group => (
          <View key={group.title} style={{ marginBottom: 6 }}>
            {!compact ? (
              <Text style={{
                color: C.mut,
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
                    backgroundColor: active ? 'rgba(246,208,72,0.16)' : (hovered ? 'rgba(255,255,255,0.06)' : 'transparent'),
                    borderTopRightRadius: 8,
                    borderBottomRightRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: compact ? 'center' : 'flex-start',
                    gap: 10
                  })}
                >
                  <Text style={{ width: 18, textAlign: 'center', color: active ? C.amber : C.line2, fontSize: 16 }}>{icon}</Text>
                  {!compact ? (
                    <Text style={{ color: active ? C.amber : C.line2, fontSize: 13, fontWeight: active ? '700' : '500' }}>
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
          <Text style={{ color: C.mut, fontSize: 10 }}>v1.0 · Phase 1 Build</Text>
          <Text style={{ color: C.mut, fontSize: 10 }}>Confidential — Internal Use</Text>
        </View>
      ) : null}
    </View>
  );
}

function WebTopbar({ routeName }) {
  const title = TITLES[routeName] || routeName;
  const now = new Date();
  const date = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const { session, signOut } = useAuth();

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
      <Text style={{ fontSize: 12, color: C.mut, marginRight: 14 }}>{date}</Text>
      {session ? (
        <Pressable onPress={signOut} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 11.5, color: C.mut }}>{session.user?.email}</Text>
          <Text style={{ fontSize: 11.5, color: C.navy2, fontWeight: '700' }}>· Sign out</Text>
        </Pressable>
      ) : null}
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
          <Stack.Screen name="LRImport" component={LRImportScreen} options={{ title: 'Import LRs (CSV / Excel)' }} />
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
      <Stack.Screen name="LRImport" component={LRImportScreen} options={{ title: 'Import LRs (CSV / Excel)' }} />
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

/* Gates the whole app behind a Supabase session — this is the one approved UI
   addition needed for Row Level Security to mean anything (every table in
   supabase/migrations/0003_rls.sql requires an authenticated user). Nothing
   below this point (StoreProvider, navigation, all 22 screens) changes:
   AppContent renders exactly what App() used to render unconditionally. */
function AppContent() {
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
        {/* Mounted once at the app root: every alert()/confirmDo() call anywhere in the
            app renders through this single host. Required because RN Web's Alert.alert
            is a no-op — without this, error/success messages and Yes/Cancel confirms
            (delete, wipe data, restore backup, etc.) silently do nothing on web. */}
        <AlertHost />
      </NavigationContainer>
    </StoreProvider>
  );
}

function AuthGate() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.amber} />
      </View>
    );
  }
  return session ? <AppContent /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
