import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { MessageSchema } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'schema', 'protocol.schema.json');

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(z.toJSONSchema(MessageSchema), null, 2)}\n`);
process.stdout.write(`wrote ${out}\n`);
