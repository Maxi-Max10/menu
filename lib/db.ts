import { Pool, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { menuPool?: Pool; menuSchemaReady?: Promise<void> };

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está configurada");
  if (!globalForDb.menuPool) {
    globalForDb.menuPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return globalForDb.menuPool;
}

export async function ensureSchema() {
  if (!globalForDb.menuSchemaReady) {
    globalForDb.menuSchemaReady = (async () => {
      const db = getPool();
      await db.query(`
        CREATE TABLE IF NOT EXISTS restaurants (
          id uuid PRIMARY KEY,
          name text NOT NULL,
          slug text NOT NULL UNIQUE,
          type text NOT NULL DEFAULT 'Restaurante',
          plan text NOT NULL DEFAULT 'basic',
          palette text NOT NULL DEFAULT 'oliva',
          logo_data text,
          description text NOT NULL DEFAULT '',
          address text NOT NULL DEFAULT '',
          instagram text NOT NULL DEFAULT '',
          whatsapp text NOT NULL DEFAULT '',
          is_enabled boolean NOT NULL DEFAULT true,
          paid_until timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS users (
          id uuid PRIMARY KEY,
          restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
          email text NOT NULL UNIQUE,
          password_hash text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS products (
          id uuid PRIMARY KEY,
          restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
          name text NOT NULL,
          description text NOT NULL DEFAULT '',
          price integer NOT NULL CHECK (price >= 0),
          category text NOT NULL DEFAULT 'General',
          image_data text,
          model_url text,
          available boolean NOT NULL DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS payments (
          id uuid PRIMARY KEY,
          restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
          amount integer NOT NULL,
          paid_at timestamptz NOT NULL DEFAULT now(),
          period_end timestamptz NOT NULL,
          note text NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS products_restaurant_idx ON products(restaurant_id);
        CREATE INDEX IF NOT EXISTS payments_restaurant_idx ON payments(restaurant_id);
      `);
    })().catch((error) => { globalForDb.menuSchemaReady = undefined; throw error; });
  }
  await globalForDb.menuSchemaReady;
}

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  await ensureSchema();
  return getPool().query<T>(sql, params);
}

export async function transaction<T>(fn: (client: import("pg").PoolClient) => Promise<T>) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
