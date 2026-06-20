import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeCommand } from './commands';

test('launch_app runs `open -a` and reports ok', async () => {
  const calls: Array<[string, string[]]> = [];
  const res = await executeCommand({ kind: 'launch_app', app: 'Safari' }, async (file, args) => {
    calls.push([file, args]);
  });
  assert.deepEqual(res, { ok: true });
  assert.deepEqual(calls, [['open', ['-a', 'Safari']]]);
});

test('launch_app surfaces a run failure', async () => {
  const res = await executeCommand({ kind: 'launch_app', app: 'Nope' }, async () => {
    throw new Error('Unable to find application named Nope');
  });
  assert.equal(res.ok, false);
  assert.match(res.error ?? '', /Unable to find application/);
});

test('unsupported kind returns a not-implemented error without running anything', async () => {
  const res = await executeCommand({ kind: 'run_shell', script: 'echo hi' }, async () => {
    throw new Error('should not be called');
  });
  assert.equal(res.ok, false);
  assert.match(res.error ?? '', /not implemented/);
});
