import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  getProjectDefaultAccount,
} = require("../node_modules/firebase-tools/lib/auth.js");
const {
  requireAuth,
} = require("../node_modules/firebase-tools/lib/requireAuth.js");
const { Client } = require("../node_modules/firebase-tools/lib/apiv2.js");
export const project = "indicadores-academia";
if (process.env.CONFIRM_STAGING_PROJECT !== project || process.env.CI)
  throw new Error(
    "Operación privada de pruebas: confirmar proyecto fuera de CI",
  );
const account = getProjectDefaultAccount(process.cwd());
if (!account) throw new Error("Sesión Firebase no disponible");
export const actor = account.user.email;
await requireAuth({ project, ...account, nonInteractive: true });
export const client = (origin) => new Client({ urlPrefix: origin });
export const billing = await client("https://cloudbilling.googleapis.com").get(
  `/v1/projects/${project}/billingInfo`,
);
if (billing.body.billingEnabled !== true)
  throw new Error("Blaze no confirmado");
