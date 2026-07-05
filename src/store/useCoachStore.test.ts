import { beforeEach, describe, expect, it, vi } from 'vitest';

const coachApiMocks = vi.hoisted(() => ({
  getHistory: vi.fn(),
  getUsage: vi.fn(),
  sendChat: vi.fn(),
  clearHistory: vi.fn(),
}));

const clientMocks = vi.hoisted(() => {
  class ApiError extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code = 'UNKNOWN') {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  class NetworkError extends ApiError {
    constructor(message: string) {
      super(message, 0, 'NETWORK');
    }
  }
  return { ApiError, NetworkError };
});

vi.mock('../api/coach', () => coachApiMocks);
vi.mock('../api/client', () => clientMocks);

const { useCoachStore } = await import('./useCoachStore');

describe('useCoachStore unlimited coach mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    coachApiMocks.getHistory.mockResolvedValue([]);
    coachApiMocks.getUsage.mockResolvedValue({
      used: null,
      limit: null,
      remaining: null,
      unlimited: true,
    });
    coachApiMocks.sendChat.mockResolvedValue({
      reply: 'ok',
      used: null,
      limit: null,
      remaining: null,
      unlimited: true,
    });
    coachApiMocks.clearHistory.mockResolvedValue({ deleted: true });
    useCoachStore.setState({
      messages: [],
      remaining: 0,
      limit: 0,
      unlimited: true,
      loading: 'idle',
      error: null,
    } as any);
  });

  it('still sends when a previous daily remaining count is zero', async () => {
    const reply = await useCoachStore.getState().sendMessage('继续聊');

    expect(coachApiMocks.sendChat).toHaveBeenCalledWith('继续聊');
    expect(reply).toBe('ok');
    expect(useCoachStore.getState().error).toBeNull();
  });

  it('loads history even if the legacy usage endpoint is unavailable', async () => {
    coachApiMocks.getHistory.mockResolvedValue([
      { id: 'm1', role: 'assistant', content: 'hello', createdAt: '2026-07-05T00:00:00.000Z' },
    ]);
    coachApiMocks.getUsage.mockRejectedValue(new clientMocks.ApiError('not found', 404, 'NOT_FOUND'));

    await useCoachStore.getState().loadHistory();

    expect(useCoachStore.getState().messages).toHaveLength(1);
    expect(useCoachStore.getState().loading).toBe('idle');
    expect(useCoachStore.getState().error).toBeNull();
  });
});
