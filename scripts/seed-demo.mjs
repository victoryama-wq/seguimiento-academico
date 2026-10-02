// Exclusivamente para revisión manual con emuladores desechables. Las pruebas
// automáticas invocan la misma fixture, sin depender de este comando.
if (process.argv[2] !== "--reset-synthetic")
  throw new Error(
    "Indica --reset-synthetic para sustituir los datos locales demo.",
  );
const { guard, seedBase, people } =
  await import("../tests/fixtures/synthetic/stage03.ts");
guard();
await seedBase();
console.log(
  "Fixture sintética preparada. Usuarios: " + Object.values(people).join(", "),
);
