export interface ProAccessState {
  betaAllPro: boolean;
  hasProAccess: boolean;
}

export function resolveProAccess(existingProCheck: boolean): ProAccessState {
  const betaAllPro = process.env.NEXT_PUBLIC_BETA_ALL_PRO === "true";
  const hasProAccess = betaAllPro || existingProCheck;

  return {
    betaAllPro,
    hasProAccess
  };
}
