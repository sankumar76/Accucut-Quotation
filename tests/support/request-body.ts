import { uploadForm } from './pictures';
import type { UploadRecipe } from './route-calls';

/**
 * The headers and body of a call made from a recipe of `route-calls.ts` (STORY-05.07): a JSON body, or one file as a multipart form, or none (a GET or HEAD never carries one). The
 * role matrix, the strict-schema walk and the CR-33 loops build their requests through this, so a route that takes an upload is called as a browser calls it by all of them.
 * `content-type` is left out of a multipart request: the platform adds it with the boundary.
 */
export interface RecipeBody {
  readonly body?: unknown;
  readonly upload?: UploadRecipe;
}

export function bodyOfRecipe(method: string, recipe: RecipeBody): { readonly headers: Record<string, string>; readonly body?: BodyInit } {
  if (method === 'GET' || method === 'HEAD') return { headers: {} };
  if (recipe.upload !== undefined) return { headers: {}, body: uploadForm(recipe.upload.bytes, recipe.upload.fileName, recipe.upload.type) };
  if (recipe.body === undefined) return { headers: {} };
  return { headers: { 'content-type': 'application/json' }, body: JSON.stringify(recipe.body) };
}
