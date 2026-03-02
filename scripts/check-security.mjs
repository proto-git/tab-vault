#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const checks = [
  {
    file: 'database/schema.sql',
    mustContain: [
      'CREATE POLICY captures_select_own',
      'CREATE POLICY captures_insert_own',
      'CREATE POLICY captures_update_own',
      'CREATE POLICY captures_delete_own',
      'REVOKE ALL ON captures FROM anon',
      'AND c.user_id = auth.uid()',
    ],
    mustNotContain: [
      'CREATE POLICY "Allow all operations"',
      'USING (true)',
      'WITH CHECK (true)',
      'GRANT ALL ON captures TO anon',
    ],
  },
  {
    file: 'database/migrations/012_phase1_rls_hardening.sql',
    mustContain: [
      'CREATE POLICY captures_select_own',
      'CREATE POLICY usage_select_own',
      'CREATE POLICY settings_select_own',
      'CREATE POLICY categories_select_own',
      'REVOKE ALL ON TABLE public.captures FROM anon',
      'REVOKE ALL ON FUNCTION public.search_captures',
      'GRANT EXECUTE ON FUNCTION public.search_captures',
    ],
    mustNotContain: [
      'USING (true)',
      'WITH CHECK (true)',
      'GRANT ALL ON TABLE public.captures TO anon',
    ],
  },
];

const failures = [];

for (const check of checks) {
  const absolutePath = path.join(repoRoot, check.file);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing required file: ${check.file}`);
    continue;
  }

  const contents = fs.readFileSync(absolutePath, 'utf8');

  for (const requiredSnippet of check.mustContain) {
    if (!contents.includes(requiredSnippet)) {
      failures.push(`[${check.file}] Missing required snippet: ${requiredSnippet}`);
    }
  }

  for (const forbiddenSnippet of check.mustNotContain) {
    if (contents.includes(forbiddenSnippet)) {
      failures.push(`[${check.file}] Found forbidden snippet: ${forbiddenSnippet}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Security regression checks failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Security regression checks passed.');
