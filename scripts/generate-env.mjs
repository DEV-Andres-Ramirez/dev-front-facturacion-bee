// ─────────────────────────────────────────────────────────────────────────────
//  generate-env.mjs
//  Lee el archivo `.env` de la raíz y genera `src/environments/environment.generated.ts`,
//  un módulo TypeScript tipado que la aplicación consume en tiempo de ejecución.
//
//  Se ejecuta automáticamente antes de `pnpm start` y `pnpm build` (ver package.json),
//  de modo que los tokens de acceso y los parámetros de negocio nunca se escriben
//  en el código fuente versionado.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = resolve(ROOT, '.env');
const OUT_FILE = resolve(ROOT, 'src/environments/environment.generated.ts');

/** Parser .env minimalista: KEY=VALUE, comillas opcionales, comentarios con #. */
function parseEnv(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const env = existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, 'utf8')) : {};

if (!existsSync(ENV_FILE)) {
  console.warn('[generate-env] .env no encontrado; se generan valores por defecto.');
}

const entries = Object.entries(env)
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join('\n');

const banner = `// ⚠️  ARCHIVO GENERADO AUTOMÁTICAMENTE — NO EDITAR A MANO.
// Fuente: .env · Generado por scripts/generate-env.mjs
// Editar las variables en .env y reconstruir (pnpm start / pnpm build).`;

const file = `${banner}

/** Variables de entorno crudas leídas desde .env en tiempo de compilación. */
export const RAW_ENV: Readonly<Record<string, string>> = {
${entries}
};
`;

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, file, 'utf8');
console.log(`[generate-env] ${Object.keys(env).length} variables → src/environments/environment.generated.ts`);
