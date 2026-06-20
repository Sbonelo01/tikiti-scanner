import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import NetInfo from '@react-native-community/netinfo';
import { validateTicket } from '../services/api';

const { width } = Dimensions.get('window');

type ValidationStatus =
  | 'idle'
  | 'valid'
  | 'already_used'
  | 'not_found'
  | 'error'
  | 'unauthorized'
  | 'scanning';

interface TicketData {
  attendee_name: string;
  email: string;
  event_id: string;
  created_at: string;
}

interface TicketScannerProps {
  onLogout?: () => void;
}

export default function TicketScanner({ onLogout }: TicketScannerProps): React.ReactElement {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const lastScannedAt = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;

    const now = Date.now();
    const lastAt = lastScannedAt.current[data] ?? 0;
    if (now - lastAt < 2500) return;
    lastScannedAt.current[data] = now;

    if (isOffline) {
      setScanned(true);
      setValidationStatus('error');
      setErrorMessage('No internet connection. Connect and try again.');
      return;
    }

    setScanned(true);
    setLoading(true);
    setValidationStatus('scanning');
    setErrorMessage(null);

    try {
      const result = await validateTicket(data);

      if (result.status === 'valid') {
        setValidationStatus('valid');
        setTicketData(result.ticket ?? null);
      } else if (result.status === 'already_used') {
        setValidationStatus('already_used');
        setTicketData(result.ticket ?? null);
      } else if (result.status === 'not_found') {
        setValidationStatus('not_found');
        setTicketData(null);
        setErrorMessage(result.error || 'Ticket not found');
      } else if (result.status === 'unauthorized') {
        setValidationStatus('unauthorized');
        setTicketData(null);
        setErrorMessage(result.error || 'Not authorized to scan tickets');
      } else {
        setValidationStatus('error');
        setTicketData(null);
        setErrorMessage(result.error || 'Validation failed');
      }
    } catch {
      setValidationStatus('error');
      setTicketData(null);
      setErrorMessage('Unexpected validation error');
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setValidationStatus('idle');
    setTicketData(null);
    setErrorMessage(null);
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!permission.granted) {
    const canAskAgain = permission.canAskAgain !== false;
    return (
      <View style={styles.container}>
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>Camera permission is required to scan tickets</Text>
          {canAskAgain ? (
            <TouchableOpacity style={styles.button} onPress={requestPermission}>
              <Text style={styles.buttonText}>Grant Permission</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.button} onPress={() => Linking.openSettings()}>
              <Text style={styles.buttonText}>Open Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        {onLogout && (
          <View style={styles.logoutContainer} pointerEvents="box-none">
            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
        {isOffline && (
          <View style={styles.offlineBanner} pointerEvents="none">
            <Text style={styles.offlineText}>Offline — scans paused</Text>
          </View>
        )}
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.scannerFrame} pointerEvents="none">
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          {validationStatus !== 'idle' && (
            <View style={styles.statusOverlay} pointerEvents="auto">
              {loading ? (
                <View style={styles.statusCard}>
                  <ActivityIndicator size="large" color="#10b981" />
                  <Text style={styles.statusText}>Validating ticket...</Text>
                </View>
              ) : validationStatus === 'valid' ? (
                <View style={[styles.statusCard, styles.successCard]}>
                  <Text style={styles.statusIcon}>✓</Text>
                  <Text style={[styles.statusText, styles.successText]}>Ticket Valid!</Text>
                  {ticketData && (
                    <View style={styles.ticketInfo}>
                      <Text style={styles.ticketInfoText}>Attendee: {ticketData.attendee_name}</Text>
                      <Text style={styles.ticketInfoText}>Email: {ticketData.email}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.button} onPress={resetScanner}>
                    <Text style={styles.buttonText}>Scan Another</Text>
                  </TouchableOpacity>
                </View>
              ) : validationStatus === 'already_used' ? (
                <View style={[styles.statusCard, styles.warningCard]}>
                  <Text style={styles.statusIcon}>⚠</Text>
                  <Text style={[styles.statusText, styles.warningText]}>Ticket Already Used</Text>
                  {ticketData && (
                    <View style={styles.ticketInfo}>
                      <Text style={styles.ticketInfoText}>Attendee: {ticketData.attendee_name}</Text>
                      <Text style={styles.ticketInfoText}>Email: {ticketData.email}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.button} onPress={resetScanner}>
                    <Text style={styles.buttonText}>Scan Another</Text>
                  </TouchableOpacity>
                </View>
              ) : validationStatus === 'unauthorized' ? (
                <View style={[styles.statusCard, styles.errorCard]}>
                  <Text style={styles.statusIcon}>✗</Text>
                  <Text style={[styles.statusText, styles.errorText]}>Not Authorized</Text>
                  {errorMessage && <Text style={styles.detailText}>{errorMessage}</Text>}
                  {onLogout && (
                    <TouchableOpacity style={styles.button} onPress={onLogout}>
                      <Text style={styles.buttonText}>Sign Out</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : validationStatus === 'not_found' ? (
                <View style={[styles.statusCard, styles.errorCard]}>
                  <Text style={styles.statusIcon}>✗</Text>
                  <Text style={[styles.statusText, styles.errorText]}>Ticket Not Found</Text>
                  {errorMessage && <Text style={styles.detailText}>{errorMessage}</Text>}
                  <TouchableOpacity style={styles.button} onPress={resetScanner}>
                    <Text style={styles.buttonText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.statusCard, styles.errorCard]}>
                  <Text style={styles.statusIcon}>✗</Text>
                  <Text style={[styles.statusText, styles.errorText]}>Validation Error</Text>
                  {errorMessage && <Text style={styles.detailText}>{errorMessage}</Text>}
                  <TouchableOpacity style={styles.button} onPress={resetScanner}>
                    <Text style={styles.buttonText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {validationStatus === 'idle' && (
            <View style={styles.instructions} pointerEvents="none">
              <Text style={styles.instructionText}>Position the QR code within the frame</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: width * 0.8,
    height: width * 0.8,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#10b981',
    borderWidth: 4,
  },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  statusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    minWidth: width * 0.8,
  },
  successCard: { borderLeftWidth: 5, borderLeftColor: '#10b981' },
  warningCard: { borderLeftWidth: 5, borderLeftColor: '#f59e0b' },
  errorCard: { borderLeftWidth: 5, borderLeftColor: '#ef4444' },
  statusIcon: { fontSize: 64, marginBottom: 16 },
  statusText: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  successText: { color: '#10b981' },
  warningText: { color: '#f59e0b' },
  errorText: { color: '#ef4444' },
  detailText: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 16 },
  ticketInfo: {
    width: '100%',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  ticketInfoText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  instructions: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  messageText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  logoutContainer: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  logoutButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoutButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  offlineBanner: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    padding: 10,
    borderRadius: 8,
  },
  offlineText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});
