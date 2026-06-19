import { postResearch } from '../src/utils/agentsClient';

describe('postResearch', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts to the agents /research endpoint and returns the parsed body', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          request_id: 'req-1',
          answer: 'Final answer.',
          status: 'completed',
          source: 'research_orchestrator',
        }),
      } as unknown as Response;
    });

    const result = await postResearch('http://agents-api:8001', {
      request_id: 'req-1',
      task: 'Research the market.',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://agents-api:8001/research');
    expect(calls[0].init?.method).toBe('POST');
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body).toEqual({ request_id: 'req-1', task: 'Research the market.' });
    expect(result).toEqual({
      request_id: 'req-1',
      answer: 'Final answer.',
      status: 'completed',
      source: 'research_orchestrator',
    });
  });

  it('throws when the agents API responds with an error status', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 504,
      text: async () => 'Gateway Timeout',
    }) as unknown as Response);

    await expect(
      postResearch('http://agents-api:8001', { request_id: 'req-2', task: 'x' })
    ).rejects.toThrow(/agents API/i);
  });
});
