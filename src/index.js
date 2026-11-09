import { installWorkbenchBridge } from './bridge.js';
import { mentorPresetDefinition } from './native-protocol.js';
import { fileURLToPath } from 'node:url';

export const name = 'stg-learning';
// `directoryPickerController` is intentionally absent: only the create/import
// flows need a native folder picker, while reading, editing, saving and the
// mentor session must keep working on hosts that expose no picker (for
// example a remote Web profile). The bridge resolves it lazily and reports a
// clear PICKER_UNAVAILABLE error instead of the whole plugin being skipped.
export const inject = ['connection', 'workspaceRegistry', 'agentPresets'];

export function apply(ctx) {
  installWorkbenchBridge(ctx);
  // Registration is scoped and removed on unload. It never selects the preset
  // globally, starts a Session, or writes profile/model/credential settings.
  const bundledSkillDir = fileURLToPath(new URL('../skills/', import.meta.url));
  ctx.effect(() => ctx.agentPresets.register(mentorPresetDefinition({ bundledSkillDir })), 'stg-learning: mentor preset');
}
