
from pathlib import Path
from uuid import uuid4
import re
import os
import stat
from app.core.config import settings
from io import BytesIO

from PIL import Image, UnidentifiedImageError
from pypdf import PdfReader
from pypdf.errors import PdfReadError
from fastapi import UploadFile

class EvidenceStorageService:
    ALLOWED_EXTENSIONS = {
        ".pdf",
        ".png",
        ".jpg",
        ".jpeg",
    }

    MAX_FILE_SIZE = 10 * 1024 * 1024
    MAX_IMAGE_PIXELS = 25_000_000
    MAX_PDF_PAGES = 100
    CHUNK_SIZE = 64 * 1024
    STORAGE_KEY_PATTERN = re.compile(
        r"^[0-9a-f]{32}\.(?:pdf|png|jpg|jpeg)$"
    )

    FILE_SIGNATURES = {
        ".pdf": (b"%PDF-",),
        ".png": (b"\x89PNG\r\n\x1a\n",),
        ".jpg": (b"\xff\xd8\xff",),
        ".jpeg": (b"\xff\xd8\xff",),
    }

    MIME_TYPES = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }

    def __init__(self, storage_path: str | Path | None = None):
        self.storage_path = Path(
            storage_path
            if storage_path is not None
            else settings.evidence_storage_path
        ).resolve()

    def generate_storage_key(self, extension: str) -> str:
        extension = extension.lower()

        if extension not in self.ALLOWED_EXTENSIONS:
            raise ValueError("Unsupported file extension")

        return f"{uuid4().hex}{extension}"

    def get_file_path(self, storage_key: str) -> Path:
        if not self.STORAGE_KEY_PATTERN.fullmatch(storage_key):
            raise ValueError("Invalid storage key")

        file_path = self.storage_path / storage_key

        if file_path.is_symlink():
            raise ValueError("Symbolic links are not allowed")

        resolved_path = file_path.resolve()

        if not resolved_path.is_relative_to(self.storage_path):
            raise ValueError("Invalid storage path")

        return file_path


    def validate_file(
        self,
        filename: str,
        content: bytes,
        mime_type: str | None,
    ) -> str:
        extension = Path(filename).suffix.lower()

        if extension not in self.ALLOWED_EXTENSIONS:
            raise ValueError("Unsupported file extension")

        if not content:
            raise ValueError("File cannot be empty")

        if len(content) > self.MAX_FILE_SIZE:
            raise ValueError("File exceeds maximum size")

        expected_mime = self.MIME_TYPES[extension]

        if mime_type != expected_mime:
            raise ValueError("Invalid MIME type")

        signatures = self.FILE_SIGNATURES[extension]

        if not any(
            content.startswith(signature)
            for signature in signatures
        ):
            raise ValueError("Invalid file signature")

        return extension

    def validate_file_structure(
        self,
        content: bytes,
        extension: str,
    ) -> None:
        if extension not in self.ALLOWED_EXTENSIONS:
            raise ValueError("Unsupported file extension")

        try:
            if extension == ".pdf":
                reader = PdfReader(
                    BytesIO(content),
                    strict=True,
                )

                page_count = len(reader.pages)

                if page_count == 0:
                    raise ValueError("Invalid file structure")

                if page_count > self.MAX_PDF_PAGES:
                    raise ValueError("PDF exceeds maximum pages")

                for page in reader.pages:
                    _ = page.mediabox

            else:
                expected_format = (
                    "PNG" if extension == ".png" else "JPEG"
                )

                with Image.open(BytesIO(content)) as image:
                    if image.format != expected_format:
                        raise ValueError("Invalid file structure")
                    if image.width * image.height > self.MAX_IMAGE_PIXELS:
                        raise ValueError("Image exceeds maximum dimensions")
                    image.verify()

        except ValueError as exc:
            if str(exc) in (
                "Image exceeds maximum dimensions",
                "PDF exceeds maximum pages",
            ):
                raise

            raise ValueError(
                "Invalid file structure"
            ) from exc

        except (
            PdfReadError,
            UnidentifiedImageError,
            OSError,
            SyntaxError,
        ) as exc:
            raise ValueError(
                "Invalid file structure"
            ) from exc



    def validate_stored_file_structure(
        self,
        storage_key: str,
    ) -> None:
        extension = Path(storage_key).suffix.lower()

        if extension not in self.ALLOWED_EXTENSIONS:
            raise ValueError("Unsupported file extension")

        try:
            with self.open_file(storage_key) as file:
                if extension == ".pdf":
                    reader = PdfReader(file, strict=True)

                    page_count = len(reader.pages)

                    if page_count == 0:
                        raise ValueError("Invalid file structure")

                    if page_count > self.MAX_PDF_PAGES:
                        raise ValueError("PDF exceeds maximum pages")

                    for page in reader.pages:
                        _ = page.mediabox

                else:
                    expected_format = (
                        "PNG" if extension == ".png" else "JPEG"
                    )

                    with Image.open(file) as image:
                        if image.format != expected_format:
                            raise ValueError("Invalid file structure")

                        if image.width * image.height > self.MAX_IMAGE_PIXELS:
                            raise ValueError("Image exceeds maximum dimensions")

                        image.verify()

        except (
            PdfReadError,
            UnidentifiedImageError,
            OSError,
            SyntaxError,
        ) as exc:
            raise ValueError("Invalid file structure") from exc


    def save_file(
        self,
        filename: str,
        content: bytes,
        mime_type: str | None,
    ) -> str:
        extension = self.validate_file(
            filename,
            content,
            mime_type,
        )
        self.validate_file_structure(content, extension)

        self.storage_path.mkdir(
            parents=True,
            exist_ok=True,
        )

        for _ in range(3):
            storage_key = self.generate_storage_key(extension)
            file_path = self.get_file_path(storage_key)

            try:
                fd = os.open(
                    file_path,
                    os.O_WRONLY
                    | os.O_CREAT
                    | os.O_EXCL
                    | os.O_NOFOLLOW,
                    0o600,
                )
            except FileExistsError:
                continue

            try:
                with os.fdopen(fd, "wb") as file:
                    file.write(content)
            except Exception:
                file_path.unlink(missing_ok=True)
                raise

            return storage_key

        raise RuntimeError(
            "Could not generate a unique storage key"
        )

    async def save_upload_file(self, upload: UploadFile) -> tuple[str, int]:
        filename = upload.filename or ""
        extension = Path(filename).suffix.lower()

        if extension not in self.ALLOWED_EXTENSIONS:
            raise ValueError("Unsupported file extension")

        expected_mime = self.MIME_TYPES[extension]

        if upload.content_type != expected_mime:
            raise ValueError("Invalid MIME type")

        self.storage_path.mkdir(
            parents=True,
            exist_ok=True,
        )

        for _ in range(3):
            storage_key = self.generate_storage_key(extension)
            file_path = self.get_file_path(storage_key)

            try:
                fd = os.open(
                    file_path,
                    os.O_WRONLY
                    | os.O_CREAT
                    | os.O_EXCL
                    | os.O_NOFOLLOW,
                    0o600,
                )
            except FileExistsError:
                continue

            file_size = 0
            signature = bytearray()

            try:
                with os.fdopen(fd, "wb") as file:
                    while True:
                        chunk = await upload.read(self.CHUNK_SIZE)

                        if not chunk:
                            break

                        file_size += len(chunk)

                        if file_size > self.MAX_FILE_SIZE:
                            raise ValueError("File exceeds maximum size")

                        if len(signature) < 8:
                            signature.extend(
                                chunk[:8 - len(signature)]
                            )

                        file.write(chunk)

                if file_size == 0:
                    raise ValueError("File cannot be empty")

                if not any(
                    signature.startswith(prefix)
                    for prefix in self.FILE_SIGNATURES[extension]
                ):
                    raise ValueError("Invalid file signature")

                self.validate_stored_file_structure(storage_key)

                return storage_key, file_size

            except BaseException:
                file_path.unlink(missing_ok=True)
                raise

        raise RuntimeError(
            "Could not generate a unique storage key"
        )



    def get_file(self, storage_key: str) -> Path:
        file_path = self.get_file_path(storage_key)

        if file_path.is_symlink():
            raise ValueError("Symbolic links are not allowed")

        if not file_path.is_file():
            raise FileNotFoundError("Evidence file not found")

        return file_path

    def open_file(self, storage_key: str):
        file_path = self.get_file_path(storage_key)

        try:
            fd = os.open(
                file_path,
                os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
            )
        except FileNotFoundError as exc:
            raise FileNotFoundError(
                "Evidence file not found"
            ) from exc
        except OSError as exc:
            raise ValueError(
                "Could not safely open evidence file"
            ) from exc

        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode):
                raise ValueError(
                    "Evidence must be a regular file"
                )

            return os.fdopen(fd, "rb")
        except Exception:
            os.close(fd)
            raise

    def delete_file(self, storage_key: str) -> None:
        file_path = self.get_file_path(storage_key)

        try:
            file_info = file_path.lstat()
        except FileNotFoundError as exc:
            raise FileNotFoundError(
                "Evidence file not found"
            ) from exc

        if not stat.S_ISREG(file_info.st_mode):
            raise ValueError(
                "Evidence must be a regular file"
            )

        file_path.unlink()