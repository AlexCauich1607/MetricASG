
import httpx

from app.services.llm_provider import LLMProvider


class GeminiProvider(LLMProvider):
    """Adaptador HTTP para la API de Google Gemini."""

    BASE_URL = (
        "https://generativelanguage.googleapis.com/v1beta/models"
    )

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_seconds: int = 30,
    ):
        if not api_key.strip():
            raise ValueError("Gemini API key is required")

        if not model.strip():
            raise ValueError("Gemini model is required")

        if not 1 <= timeout_seconds <= 120:
            raise ValueError("Invalid Gemini timeout")

        self._api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds

    def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        url = (
            f"{self.BASE_URL}/{self.model}:generateContent"
        )

        payload = {
            "systemInstruction": {
                "parts": [
                    {"text": system_prompt},
                ],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": user_prompt},
                    ],
                }
            ],
        }

        try:
            with httpx.Client(
                timeout=self.timeout_seconds
            ) as client:
                response = client.post(
                    url,
                    headers={
                        "x-goog-api-key": self._api_key,
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )

                response.raise_for_status()
                data = response.json()

        except httpx.TimeoutException:
            raise RuntimeError(
                "Gemini request timed out"
            ) from None

        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"Gemini API returned HTTP {exc.response.status_code}"
            ) from None

        except httpx.RequestError:
            raise RuntimeError(
                "Unable to connect to Gemini API"
            ) from None

        except ValueError:
            raise RuntimeError(
                "Gemini API returned invalid JSON"
            ) from None

        try:
            candidates = data["candidates"]
            parts = candidates[0]["content"]["parts"]

            result = "\n".join(
                part["text"]
                for part in parts
                if isinstance(part.get("text"), str)
            ).strip()

        except (KeyError, IndexError, TypeError):
            raise RuntimeError(
                "Invalid Gemini response structure"
            ) from None

        if not result:
            raise RuntimeError(
                "Gemini returned an empty explanation"
            )

        return result
