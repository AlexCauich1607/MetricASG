
from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """Contrato común para proveedores de modelos de lenguaje."""

    @abstractmethod
    def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        """Genera una respuesta textual a partir de los mensajes."""
        raise NotImplementedError
