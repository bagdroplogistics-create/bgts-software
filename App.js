import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider } from './src/store';
import { C } from './src/ui';

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

export default function App() {
  return (
    <StoreProvider>
      <NavigationContainer theme={theme}>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: C.navy },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '800' }
          }}
        >
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
      </NavigationContainer>
    </StoreProvider>
  );
}
