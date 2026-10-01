import { z } from "zod";

const id = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_-]+$/);
const sourceText = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, "Texto vacío");
export const civilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    );
  }, "Fecha civil inválida");

export const personSchema = z.strictObject({
  id,
  matriculaOriginal: sourceText,
  // Etapa 02 definirá el parser/normalizador; no coaccionar números a texto.
  matriculaNormalizada: sourceText,
});

export const enrollmentSchema = z.strictObject({
  id,
  personId: id,
  cycleId: id,
  rosterVersionId: id,
  sourceRow: z.int().positive(),
  groupOriginal: sourceText,
  groupDateOriginal: z.string(),
  groupDate: civilDateSchema.nullable(),
  classification: z.enum([
    "por_resolver",
    "base",
    "especial",
    "excluida",
    "practica",
  ]),
  baseEnrollmentId: id.nullable(),
  coordinationId: id.nullable(),
});

export const gradeValueSchema = z.discriminatedUnion("state", [
  z
    .strictObject({
      state: z.literal("numerica"),
      raw: z.union([z.string(), z.number()]),
      value: z.number().finite(),
    })
    .refine(
      ({ raw, value }) =>
        typeof raw === "number"
          ? raw === value
          : /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw.trim()) &&
            Number(raw) === value,
      "El original numérico debe coincidir con su valor; no convertir guiones o vacíos",
    ),
  z.strictObject({ state: z.literal("guion"), raw: z.literal("-") }),
  z.strictObject({ state: z.literal("vacia"), raw: z.literal("") }),
  z.strictObject({
    state: z.literal("invalida"),
    raw: sourceText,
    issueId: id,
  }),
]);

export const courseVersionSchema = z.strictObject({
  cycleId: id,
  cutId: id,
  courseInstanceId: id,
  revision: z.int().positive(),
  sourceImportId: id,
  selectedActivityIds: z
    .array(id)
    .refine(
      (values) => new Set(values).size === values.length,
      "Actividades duplicadas",
    ),
});

export const sourceVersionSchema = z.strictObject({
  id,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  originalName: sourceText,
  bytes: z.int().nonnegative(),
  storagePath: z.string().startsWith("originals/"),
  actorUid: id,
  createdAt: z.iso.datetime(),
  parserVersion: sourceText,
});

const cutShape = {
  id,
  cycleId: id,
  date: civilDateSchema,
  rosterVersionId: id,
  catalogVersionId: id,
  exceptionVersionId: id.nullable(),
};
export const cutSchema = z.discriminatedUnion("status", [
  z.strictObject({ ...cutShape, status: z.literal("abierto") }),
  z.strictObject({
    ...cutShape,
    status: z.literal("cerrado"),
    publicationId: id,
    closedAt: z.iso.datetime(),
  }),
]);

export type Person = z.infer<typeof personSchema>;
export type Enrollment = z.infer<typeof enrollmentSchema>;
