import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import type { StressScenario } from './types.js';

export async function loadStressScenario(path: string): Promise<StressScenario> {
  const raw = await readFile(path, 'utf8');
  const data = parse(raw) as StressScenario;
  if (!data?.users?.length) {
    throw new Error(`Invalid scenario file: ${path}`);
  }
  return data;
}

export function buildCrossUserBlocklist(
  users: StressScenario['users'],
  currentUserId: string
): string[] {
  const blocked = new Set<string>();
  for (const user of users) {
    if (user.id === currentUserId) continue;
    blocked.add(user.profile.name);
    blocked.add(user.profile.fingerprint);
    blocked.add(user.profile.company);
    for (const term of user.assert.must_not_contain) {
      blocked.add(term);
    }
  }
  return Array.from(blocked);
}
