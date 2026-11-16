
import argparse
import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.models.ai_explanation_request import AIExplanationRequest
from app.services.ai_explanation_service import AIExplanationService
from app.services.llm_provider_factory import create_llm_provider
from tests.fixtures.ai_explanation_quality_cases import (
    BASE_EVALUATION,
    QUALITY_CASES,
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        default="/tmp/ai_explanation_quality_review.json",
    )
    args = parser.parse_args()

    service = AIExplanationService(
        create_llm_provider(settings)
    )

    results = []

    for case in QUALITY_CASES:
        payload = deepcopy(BASE_EVALUATION)
        payload.update(deepcopy(case["overrides"]))

        request = AIExplanationRequest.model_validate(payload)

        record = {
            "case_id": case["id"],
            "description": case["description"],
            "input": request.model_dump(mode="json"),
            "explanation": None,
            "error": None,
        }

        try:
            record["explanation"] = (
                service.generate_explanation(request)
            )
        except RuntimeError as exc:
            record["error"] = str(exc)

        results.append(record)

        print(
            f"{case['id']}: "
            f"{'OK' if record['error'] is None else 'ERROR'}"
        )

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "provider": settings.ai_provider,
        "model": settings.ai_model,
        "results": results,
    }

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Report saved: {output}")


if __name__ == "__main__":
    main()
