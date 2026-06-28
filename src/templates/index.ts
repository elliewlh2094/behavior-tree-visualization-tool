import { chaseTemplateJson } from './chase';

/** A bundled starter tree the user can open from the landing page. */
export interface BTTemplate {
  /** Stable key for React lists / selection. */
  id: string;
  /** Display name; also drives the loaded document's file name (`${name}.json`). */
  name: string;
  /** One-line blurb for the template card. */
  description: string;
  /** Serialized v2 BTDocument, loaded through the standard deserialize path. */
  json: string;
}

// Only Chase ships as a template: it already bundles the Patrol tree as a
// SubTree, so a separate Patrol card would be redundant.
export const TEMPLATES: readonly BTTemplate[] = [
  {
    id: 'chase',
    name: 'Chase',
    description:
      'Pursue a visible target, otherwise fall back to a Patrol subtree — a Fallback priority tree with a SubTree reference.',
    json: chaseTemplateJson,
  },
];
