// Host entry: all reads and actions use DSH's existing authenticated controllers.
// Loading this plugin never starts a model, reads a credential, or writes a lesson.
export const name = 'stg-learning';
export function apply() {}
