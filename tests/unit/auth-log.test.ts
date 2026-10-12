import { expect, it } from "vitest";
// @ts-expect-error El helper operativo se ejecuta como módulo JavaScript en Node.
import { redactAuthLog } from "../../scripts/redact-auth-log.mjs";
it("oculta enlaces de activación del emulador sin ocultar errores de suites", () => {
  expect(
    redactAuthLog(
      "Reset http://localhost:9099/emulator/action?mode=resetPassword&oobCode=secret end",
    ),
  ).toBe("Reset [enlace de activación omitido] end");
  expect(redactAuthLog("FAIL suite permissions 3 failed")).toBe(
    "FAIL suite permissions 3 failed",
  );
});
