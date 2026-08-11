import React, { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '../AuthProvider';
import { C, Logo, Btn } from '../ui';

/* Single login screen gating the whole app — see AuthProvider.js for why
   there's no sign-up option here. Styled to match the rest of BGTS-OS
   (same navy/amber branding as the sidebar and the boot loading screen in
   store.js) rather than looking like a bolted-on generic auth form. */
export default function LoginScreen() {
  const { signIn, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    await signIn(email, password);
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <View style={{ width: '100%', maxWidth: 440 }}>
        <View
          style={{
            backgroundColor: '#fff', borderRadius: 18, padding: 36,
            shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 28, elevation: 8
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 26 }}>
            <Logo size={92} />
            <Text style={{ color: C.mut, fontSize: 11, marginTop: 12, textAlign: 'center', letterSpacing: 0.3 }}>
              BARODA GOODS TRANSPORT SERVICE PVT. LTD. · EST. 1950
            </Text>
          </View>

          <View style={{ height: 1, backgroundColor: C.line, marginBottom: 22 }} />

          <Text style={{ fontSize: 16, fontWeight: '800', color: C.navy, marginBottom: 18 }}>Sign in</Text>

          <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.mut, marginBottom: 5 }}>Email</Text>
          <TextInput
            value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
            placeholder="you@bgts.in" placeholderTextColor={C.line2}
            style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, marginBottom: 16, backgroundColor: '#fff' }}
          />

          <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.mut, marginBottom: 5 }}>Password</Text>
          <TextInput
            value={password} onChangeText={setPassword} secureTextEntry
            placeholder="••••••••" placeholderTextColor={C.line2}
            onSubmitEditing={submit}
            style={{ borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, marginBottom: 18, backgroundColor: '#fff' }}
          />

          {authError ? <Text style={{ color: C.red, fontSize: 12, marginBottom: 14 }}>{authError}</Text> : null}

          {busy ? (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}><ActivityIndicator color={C.navy} /></View>
          ) : (
            <Btn label="Sign In" tone="amber" onPress={submit} style={{ alignSelf: 'stretch', alignItems: 'center', paddingVertical: 12 }} />
          )}

          <Text style={{ fontSize: 10.5, color: C.mut, marginTop: 18, textAlign: 'center' }}>
            Accounts are created by your administrator in the Supabase dashboard — there is no self sign-up.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
