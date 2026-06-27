import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MessageSchema } from './index';

type NamedFrame = { name: string; frame: unknown };
type Fixtures = {
  inbound: NamedFrame[];
  outbound: NamedFrame[];
  notYetDecoded: NamedFrame[];
  rejected: NamedFrame[];
  unknownType: NamedFrame[];
  tsOnlyRejected: NamedFrame[];
};

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  readFileSync(join(here, '..', 'fixtures', 'messages.json'), 'utf8'),
) as Fixtures;

// Zod is the closed-union source of truth: every accepted frame parses, every rejected frame does not.
const accepted = [...fixtures.inbound, ...fixtures.outbound, ...fixtures.notYetDecoded];
const refused = [...fixtures.rejected, ...fixtures.unknownType, ...fixtures.tsOnlyRejected];

for (const { name, frame } of accepted) {
  test(`accepts ${name}`, () => {
    assert.equal(MessageSchema.safeParse(frame).success, true);
  });
}

for (const { name, frame } of refused) {
  test(`rejects ${name}`, () => {
    assert.equal(MessageSchema.safeParse(frame).success, false);
  });
}
