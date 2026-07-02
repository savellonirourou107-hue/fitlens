export const DB_NAME = 'fitlens-web-storage';

export async function initDb(): Promise<void> {
  return undefined;
}

export async function getDb(): Promise<never> {
  throw new Error('SQLite is not available in the web preview.');
}

export async function runMigrations(): Promise<void> {
  return undefined;
}
