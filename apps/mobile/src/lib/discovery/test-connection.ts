export type TestResult = { ok: boolean; reason: 'ok' | 'timeout' | 'refused' };

// Always-available diagnostic: open a throwaway socket, race a timeout, report precisely. Independent
// of mDNS so it works even when discovery is unavailable. Tears the socket down on every path.
export function testConnection(host: string, port: number, timeoutMs = 3000): Promise<TestResult> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://${host}:${port}`);
    let settled = false;
    const finish = (result: TestResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.close();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeoutMs);
    ws.onopen = () => finish({ ok: true, reason: 'ok' });
    ws.onerror = () => finish({ ok: false, reason: 'refused' });
  });
}
