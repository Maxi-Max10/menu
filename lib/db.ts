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
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(20261014)");
        await client.query(`
        CREATE TABLE IF NOT EXISTS restaurants (
          id uuid PRIMARY KEY,
          name text NOT NULL,
          slug text NOT NULL UNIQUE,
          type text NOT NULL DEFAULT 'Restaurante',
          plan text NOT NULL DEFAULT 'basic',
          palette text NOT NULL DEFAULT 'oliva',
          custom_primary text,
          custom_accent text,
          logo_data text,
          description text NOT NULL DEFAULT '',
          address text NOT NULL DEFAULT '',
          instagram text NOT NULL DEFAULT '',
          whatsapp text NOT NULL DEFAULT '',
          orders_enabled boolean NOT NULL DEFAULT false,
          is_enabled boolean NOT NULL DEFAULT true,
          signup_status text NOT NULL DEFAULT 'active',
          paid_until timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS users (
          id uuid PRIMARY KEY,
          restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
          email text NOT NULL UNIQUE,
          phone text,
          password_hash text NOT NULL,
          email_verified_at timestamptz,
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
          featured boolean NOT NULL DEFAULT false,
          promo_price integer CHECK (promo_price >= 0),
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
        CREATE TABLE IF NOT EXISTS menu_events (
          id bigserial PRIMARY KEY,
          restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
          product_id uuid REFERENCES products(id) ON DELETE CASCADE,
          kind text NOT NULL CHECK (kind IN ('visit', 'product_view', 'order_click')),
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS auth_rate_limits (
          bucket_key text PRIMARY KEY,
          attempts integer NOT NULL,
          window_started_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS email_verifications (
          user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          token_hash text NOT NULL UNIQUE,
          expires_at timestamptz NOT NULL
        );
        CREATE TABLE IF NOT EXISTS orders (
          id uuid PRIMARY KEY,
          restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
          customer_name text NOT NULL,
          customer_phone text NOT NULL,
          notes text NOT NULL DEFAULT '',
          total bigint NOT NULL CHECK (total >= 0),
          status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'preparing', 'ready', 'completed', 'canceled')),
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS order_items (
          id bigserial PRIMARY KEY,
          order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          product_id uuid REFERENCES products(id) ON DELETE SET NULL,
          product_name text NOT NULL,
          unit_price integer NOT NULL CHECK (unit_price >= 0),
          quantity integer NOT NULL CHECK (quantity > 0),
          line_total bigint NOT NULL CHECK (line_total >= 0)
        );
        ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS orders_enabled boolean NOT NULL DEFAULT false;
        ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS signup_status text NOT NULL DEFAULT 'active';
        ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS custom_primary text;
        ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS custom_accent text;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_price integer;
        CREATE INDEX IF NOT EXISTS products_restaurant_idx ON products(restaurant_id);
        CREATE INDEX IF NOT EXISTS payments_restaurant_idx ON payments(restaurant_id);
        CREATE INDEX IF NOT EXISTS menu_events_restaurant_date_idx ON menu_events(restaurant_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS auth_rate_limits_started_idx ON auth_rate_limits(window_started_at);
        CREATE INDEX IF NOT EXISTS orders_restaurant_date_idx ON orders(restaurant_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);
        `);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
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
