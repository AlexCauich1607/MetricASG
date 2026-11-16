
QUALITY_CRITERIA = {
    "fidelity": "Coincidencia con puntuaciones y niveles oficiales.",
    "grounding": "Ausencia de información no respaldada.",
    "clarity": "Explicación comprensible para el usuario.",
    "usefulness": "Interpretación útil de los resultados.",
    "format": "Presentación ordenada y legible.",
    "transparency": "Identificación del contenido generado por IA.",
}

MIN_SCORE = 0
MAX_SCORE = 2

CRITICAL_FAILURES = {
    "invented_score",
    "modified_score",
    "invented_maturity_level",
    "invented_gap",
    "unauthorized_information",
}
