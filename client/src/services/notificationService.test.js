const originalApiUrl = process.env.REACT_APP_API_URL;
const originalFetch = global.fetch;

const loadService = apiUrl => {
  if (apiUrl === undefined) delete process.env.REACT_APP_API_URL;
  else process.env.REACT_APP_API_URL = apiUrl;
  jest.resetModules();
  return require('./notificationService').default;
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    json: async () => ({ success: true, data: { tournaments: [] } })
  });
});

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.REACT_APP_API_URL;
  else process.env.REACT_APP_API_URL = originalApiUrl;
  global.fetch = originalFetch;
  jest.useRealTimers();
});

test.each(['https://api.preview.example', 'https://api.production.example'])(
  'notification polling targets configured backend %s instead of frontend origin',
  async apiUrl => {
    const service = loadService(apiUrl);
    await service.checkForNewTournaments();

    const requestUrl = global.fetch.mock.calls[0][0];
    expect(new URL(requestUrl).origin).toBe(apiUrl);
    expect(new URL(requestUrl).origin).not.toBe(window.location.origin);
    expect(requestUrl).toBe(`${apiUrl}/api/tournaments?limit=5&sort=createdAt`);
  }
);

test('both initial and scheduled notification checks use the configured backend', () => {
  jest.useFakeTimers();
  const apiUrl = 'https://api.preview.example';
  const service = loadService(apiUrl);
  service.init(jest.fn());
  jest.advanceTimersByTime(30000);
  service.stopTournamentMonitoring();

  expect(global.fetch).toHaveBeenCalledTimes(2);
  for (const [url] of global.fetch.mock.calls) {
    expect(url).toBe(`${apiUrl}/api/tournaments?limit=5&sort=createdAt`);
  }
});

test('preserves the existing same-origin fallback when no backend is configured', async () => {
  const service = loadService(undefined);
  await service.checkForNewTournaments();

  expect(global.fetch).toHaveBeenCalledWith('/api/tournaments?limit=5&sort=createdAt');
});

test('successful polling still notifies only for tournaments created since the previous check', async () => {
  const service = loadService('https://api.preview.example');
  service.lastTournamentCheck = new Date('2030-01-01T00:00:00Z');
  const recent = { _id: 'synthetic-new', createdAt: '2030-01-02T00:00:00Z' };
  global.fetch.mockResolvedValue({
    json: async () => ({ success: true, data: { tournaments: [
      { _id: 'synthetic-old', createdAt: '2029-12-31T00:00:00Z' }, recent
    ] } })
  });
  const notify = jest.spyOn(service, 'showTournamentNotification').mockImplementation(() => {});
  await service.checkForNewTournaments();

  expect(notify).toHaveBeenCalledTimes(1);
  expect(notify).toHaveBeenCalledWith(recent);
  notify.mockRestore();
});
