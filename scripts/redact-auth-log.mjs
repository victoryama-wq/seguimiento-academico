// El emulador Auth imprime enlaces OOB. No llevarlos a stdout/CI público.
export function redactAuthLog(line) {
  return line.replace(
    /https?:\/\/\S*(?:oobCode|mode=resetPassword|mode=verifyEmail)\S*/gi,
    "[enlace de activación omitido]",
  );
}
