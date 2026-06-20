import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import TicketScanner from './src/components/TicketScanner';
import Login from './src/components/Login';
import { supabase } from './src/services/supabase';

type AppRoute = 'scanner' | null;

function isStaffRole(role: unknown): boolean {
  return role === 'admin' || role === 'staff';
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [intendedRoute, setIntendedRoute] = useState<AppRoute>('scanner');
  const [authError, setAuthError] = useState<string | null>(null);
  const intendedRouteRef = useRef<AppRoute>('scanner');

  useEffect(() => {
    intendedRouteRef.current = intendedRoute;
  }, [intendedRoute]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setLoading(false);
      if (!isStaffRole(currentSession?.user?.user_metadata?.role)) {
        setAuthError(
          currentSession
            ? 'Your account is not authorized to scan tickets.'
            : null
        );
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setAuthError(null);
        setIntendedRoute(intendedRouteRef.current || 'scanner');
      } else if (!isStaffRole(nextSession.user?.user_metadata?.role)) {
        setAuthError('Your account is not authorized to scan tickets.');
      } else {
        setAuthError(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLoginSuccess = (newSession: Session) => {
    if (!isStaffRole(newSession.user?.user_metadata?.role)) {
      setAuthError('Your account is not authorized to scan tickets.');
      setSession(newSession);
      return;
    }
    setAuthError(null);
    setSession(newSession);
  };

  const handleLogout = async () => {
    if (supabase) {
      setIntendedRoute('scanner');
      await supabase.auth.signOut();
      setSession(null);
      setAuthError(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const canScan =
    session && isStaffRole(session.user?.user_metadata?.role) && !authError;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {canScan ? (
        <TicketScanner onLogout={handleLogout} />
      ) : !session ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <View style={styles.unauthorizedContainer}>
          <Text style={styles.unauthorizedTitle}>Access denied</Text>
          <Text style={styles.unauthorizedText}>
            {authError || 'Only staff and admin accounts can use the scanner.'}
          </Text>
          <Text style={styles.logoutLink} onPress={handleLogout}>
            Sign out
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 12,
    fontSize: 16,
  },
  unauthorizedContainer: {
    padding: 24,
    alignItems: 'center',
  },
  unauthorizedTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  unauthorizedText: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  logoutLink: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
  },
});
