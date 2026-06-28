import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { MessageSchema } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'schema', 'protocol.schema.json');
const generated = `${JSON.stringify(z.toJSONSchema(MessageSchema), null, 2)}\n`;

// --check fails CI when the committed schema drifts from the Zod source, instead of writing.
if (process.argv.includes('--check')) {
  const committed = readFileSync(out, 'utf8');
  if (committed !== generated) {
    process.stderr.write(
      `${out} is stale; run \`pnpm -F @slate/protocol gen:schema\` and commit.\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`${out} is up to date\n`);
} else {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, generated);
  process.stdout.write(`wrote ${out}\n`);
}
