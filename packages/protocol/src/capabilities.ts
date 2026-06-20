import { z } from 'zod';

export const CapabilitiesSchema = z.object({
  launchApps: z.boolean(),
  runShortcuts: z.boolean(),
  runShell: z.boolean(),
  keystrokes: z.boolean(),
  appList: z.boolean(),
  appIcons: z.boolean(),
  liveState: z.boolean(),
});

export type Capabilities = z.infer<typeof CapabilitiesSchema>;
