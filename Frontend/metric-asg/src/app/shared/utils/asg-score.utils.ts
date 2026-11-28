
/**
 * Determina si una puntuación ASG pertenece
 * a la escala oficial de 0 a 10.
 */
export function isValidAsgScore(
  score: unknown
): score is number {

  return typeof score === 'number' &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 10;

}
