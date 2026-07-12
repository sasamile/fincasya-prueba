import { createApi } from '@convex-dev/better-auth';
import { createAuthOptions, options } from './auth';
import schema from './schema';

// createApi llama a la función con contexto vacío para obtener el schema;
// usamos `options` (estático) cuando el contexto está vacío.
export const { create, findOne, findMany, updateOne, updateMany, deleteOne, deleteMany } =
  createApi(schema, (ctx) => {
    if (!ctx || typeof ctx !== 'object' || !('db' in ctx)) {
      return options;
    }
    return createAuthOptions(ctx);
  });
