import { supabase } from './supabase';
import { EXPO_PUBLIC_API_BASE_URL } from '@env';

const API_BASE_URL = (EXPO_PUBLIC_API_BASE_URL || 'https://tikiti.fun/api').replace(/\/$/, '');

export interface ValidationResponse {
  success: boolean;
  status: 'valid' | 'already_used' | 'not_found' | 'error' | 'unauthorized';
  error?: string;
  ticket?: {
    attendee_name: string;
    email: string;
    event_id: string;
    created_at: string;
  };
}

const getAuthToken = async (): Promise<string | null> => {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};

export const validateTicket = async (qrCodeData: string): Promise<ValidationResponse> => {
  const controller = new AbortController();
  const timeoutMs = 15000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${API_BASE_URL}/validate-ticket`;

  try {
    const authToken = await getAuthToken();
    if (!authToken) {
      return {
        success: false,
        status: 'unauthorized',
        error: 'Not signed in. Please log in again.',
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ qr_code_data: qrCodeData }),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type');
    let data: ValidationResponse & { ticket?: ValidationResponse['ticket'] };

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      return {
        success: false,
        status: 'error',
        error: 'Invalid response from server',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        status: data.status || 'error',
        error: data.error || `Validation failed (HTTP ${response.status})`,
        ticket: data.ticket,
      };
    }

    return {
      success: data.success || false,
      status: data.status || 'error',
      ticket: data.ticket,
      error: data.error,
    };
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };

    if (err?.name === 'AbortError') {
      return {
        success: false,
        status: 'error',
        error: 'Request timed out. Check your connection and try again.',
      };
    }

    return {
      success: false,
      status: 'error',
      error: err?.message || 'Network error. Check your connection.',
    };
  } finally {
    clearTimeout(timeout);
  }
};

export { API_BASE_URL };
