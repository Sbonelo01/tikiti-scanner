import { validateTicket } from '../src/services/api';

const mockGetSession = jest.fn();

jest.mock('../src/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

describe('validateTicket', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  function mockJsonResponse(body: unknown, ok = true, status = 200) {
    return {
      ok,
      status,
      headers: { get: (name: string) => (name === 'content-type' ? 'application/json' : null) },
      json: async () => body,
    } as unknown as Response;
  }

  it('returns not_found when API returns 404', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockJsonResponse({ status: 'not_found', success: false, error: 'Ticket not found' }, false, 404)
    );

    const result = await validateTicket('NON_EXISTENT_QR');

    expect(result.success).toBe(false);
    expect(result.status).toBe('not_found');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/validate-ticket'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    );
  });

  it('returns valid when API returns success', async () => {
    const ticket = {
      attendee_name: 'Alice',
      email: 'alice@example.com',
      event_id: '550e8400-e29b-41d4-a716-446655440000',
      created_at: new Date().toISOString(),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockJsonResponse({ success: true, status: 'valid', ticket })
    );

    const result = await validateTicket('VALID_QR');

    expect(result.success).toBe(true);
    expect(result.status).toBe('valid');
    expect(result.ticket).toMatchObject({ attendee_name: 'Alice' });
  });

  it('returns unauthorized when not signed in', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const result = await validateTicket('QR');

    expect(result.status).toBe('unauthorized');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
