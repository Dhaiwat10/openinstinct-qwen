# Database

Drizzle schema, migrations and query services for the app and Better Auth.

- `schema/` is the source of truth.
- `index.ts` is the Drizzle client. It uses the pooled `DATABASE_URL`.
- `services/` holds the query functions, grouped by domain.
- `migrations/` is generated history. After a schema change, run
  `pnpm db:generate` and commit the SQL, snapshot and journal together.

Migrations use the direct `DATABASE_URL_UNPOOLED` connection and load `.env*`
the same way Next.js does. Run `pnpm db:migrate` yourself for local or
self-managed databases. On Vercel, Turbo runs it before every build. Keep each
migration compatible with the previous deployment, which keeps serving traffic
during a rollout.

## Upgrading an upstream install

Migrations `0000` and `0001` adopt tables created by older upstream versions,
which created them at request time. New constraints on existing tables are
added as `NOT VALID` so old orphaned rows can't fail a deploy. To find them:

```sql
SELECT conrelid::regclass AS table_name, conname
FROM pg_constraint
WHERE NOT convalidated AND connamespace = 'public'::regnamespace;
```

Back up the database and fix any violating rows. Then run
`ALTER TABLE <table> VALIDATE CONSTRAINT <name>;` for each constraint.
