// Carga el .env de la raíz del monorepo ANTES de importar cualquier módulo.
// Debe ser el primer import de main.ts (los imports se evalúan en orden).
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '../../.env') });
config(); // también intenta un .env local, sin sobreescribir lo ya cargado
