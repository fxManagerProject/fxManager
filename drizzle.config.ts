// drizzle.config.ts is only used for `bun db:studio` (visual DB browser).
// Migrations are handled in-code via packages/database/src/migrations/index.ts
// and do NOT require drizzle-kit to run.

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/database/src/schema.ts',
  out: './packages/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/panel.db',
  },
});
