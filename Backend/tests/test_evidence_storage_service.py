
from pathlib import Path
from uuid import UUID
import stat
import os
import pytest
from io import BytesIO
from PIL import Image
from pypdf import PdfReader, PdfWriter
from starlette.datastructures import Headers
from fastapi import UploadFile
from app.services.evidence_storage_service import EvidenceStorageService


def create_valid_pdf() -> bytes:
    buffer = BytesIO()

    writer = PdfWriter()
    writer.add_blank_page(width=595, height=842)
    writer.write(buffer)

    return buffer.getvalue()


def create_valid_image(
    image_format: str = "PNG",
) -> bytes:
    buffer = BytesIO()

    image = Image.new(
        "RGB",
        (10, 10),
        color="white",
    )

    image.save(buffer, format=image_format)
    image.close()

    return buffer.getvalue()

@pytest.fixture
def storage_service(tmp_path: Path) -> EvidenceStorageService:
    return EvidenceStorageService(storage_path=tmp_path)


@pytest.mark.parametrize(
    "extension",
    [".pdf", ".png", ".jpg", ".jpeg"],
)
def test_generate_storage_key_with_allowed_extensions(
    storage_service: EvidenceStorageService,
    extension: str,
):
    storage_key = storage_service.generate_storage_key(extension)

    uuid_part, generated_extension = storage_key.rsplit(".", 1)

    assert UUID(hex=uuid_part).hex == uuid_part
    assert f".{generated_extension}" == extension


def test_generate_storage_key_is_unique(
    storage_service: EvidenceStorageService,
):
    first_key = storage_service.generate_storage_key(".pdf")
    second_key = storage_service.generate_storage_key(".pdf")

    assert first_key != second_key


@pytest.mark.parametrize(
    "extension",
    [".exe", ".zip", ".txt", ""],
)
def test_generate_storage_key_rejects_unsupported_extensions(
    storage_service: EvidenceStorageService,
    extension: str,
):
    with pytest.raises(ValueError, match="Unsupported file extension"):
        storage_service.generate_storage_key(extension)


def test_generate_storage_key_normalizes_extension(
    storage_service: EvidenceStorageService,
):
    storage_key = storage_service.generate_storage_key(".PDF")

    assert storage_key.endswith(".pdf")


def test_get_file_path_returns_private_storage_path(
    storage_service: EvidenceStorageService,
):
    storage_key = storage_service.generate_storage_key(".pdf")

    file_path = storage_service.get_file_path(storage_key)

    assert file_path == storage_service.storage_path / storage_key
    assert file_path.parent == storage_service.storage_path


@pytest.mark.parametrize(
    "storage_key",
    [
        "",
        "../secret.txt",
        "../../config.py",
        "/etc/passwd",
        "folder/file.pdf",
        r"folder\file.pdf",
    ],
)
def test_get_file_path_rejects_invalid_keys(
    storage_service: EvidenceStorageService,
    storage_key: str,
):
    with pytest.raises(ValueError, match="Invalid storage key"):
        storage_service.get_file_path(storage_key)


@pytest.mark.parametrize(
    "storage_key",
    [
        "documento.pdf",
        "12345.pdf",
        "a" * 32 + ".exe",
        "a" * 32 + ".PDF",
        "a" * 32 + ".pdf.bak",
        "a" * 33 + ".pdf",
    ],
)
def test_get_file_path_rejects_invalid_key_formats(
    storage_service: EvidenceStorageService,
    storage_key: str,
):
    with pytest.raises(ValueError, match="Invalid storage key"):
        storage_service.get_file_path(storage_key)


def test_get_file_path_rejects_symlinks_outside_storage(
    storage_service: EvidenceStorageService,
    tmp_path: Path,
):
    outside_directory = tmp_path.parent / "outside_storage_test"
    outside_directory.mkdir(exist_ok=True)

    outside_file = outside_directory / "secret.txt"
    outside_file.write_text("private information")

    storage_key = "a" * 32 + ".pdf"
    symlink_path = storage_service.storage_path / storage_key

    try:
        symlink_path.symlink_to(outside_file)

        with pytest.raises(ValueError, match="Symbolic links are not allowed"):
            storage_service.get_file_path(storage_key)
    finally:
        symlink_path.unlink(missing_ok=True)
        outside_file.unlink(missing_ok=True)
        outside_directory.rmdir()


@pytest.mark.parametrize(
    "filename,mime_type,content,expected_extension",
    [
        (
            "documento.pdf",
            "application/pdf",
            b"%PDF-1.7\ncontenido",
            ".pdf",
        ),
        (
            "imagen.png",
            "image/png",
            b"\x89PNG\r\n\x1a\ncontenido",
            ".png",
        ),
        (
            "foto.jpg",
            "image/jpeg",
            b"\xff\xd8\xffcontenido",
            ".jpg",
        ),
        (
            "foto.jpeg",
            "image/jpeg",
            b"\xff\xd8\xffcontenido",
            ".jpeg",
        ),
    ],
)
def test_validate_file_accepts_allowed_formats(
    storage_service: EvidenceStorageService,
    filename: str,
    mime_type: str,
    content: bytes,
    expected_extension: str,
):
    result = storage_service.validate_file(
        filename,
        content,
        mime_type,
    )

    assert result == expected_extension


@pytest.mark.parametrize(
    "filename,mime_type,content,error",
    [
        (
            "script.exe",
            "application/octet-stream",
            b"contenido",
            "Unsupported file extension",
        ),
        (
            "documento.pdf",
            "application/pdf",
            b"",
            "File cannot be empty",
        ),
        (
            "documento.pdf",
            "image/png",
            b"%PDF-1.7\ncontenido",
            "Invalid MIME type",
        ),
        (
            "documento.pdf",
            "application/pdf",
            b"contenido sin firma",
            "Invalid file signature",
        ),
    ],
)
def test_validate_file_rejects_invalid_files(
    storage_service: EvidenceStorageService,
    filename: str,
    mime_type: str,
    content: bytes,
    error: str,
):
    with pytest.raises(ValueError, match=error):
        storage_service.validate_file(
            filename,
            content,
            mime_type,
        )


def test_validate_file_rejects_oversized_files(
    storage_service: EvidenceStorageService,
):
    oversized_content = (
        b"%PDF-" +
        b"a" * storage_service.MAX_FILE_SIZE
    )

    with pytest.raises(
        ValueError,
        match="File exceeds maximum size",
    ):
        storage_service.validate_file(
            "documento.pdf",
            oversized_content,
            "application/pdf",
        )


def test_save_file_stores_valid_content(
    storage_service: EvidenceStorageService,
):
    content = create_valid_pdf()

    storage_key = storage_service.save_file(
        "reporte.pdf",
        content,
        "application/pdf",
    )

    file_path = storage_service.get_file_path(storage_key)

    assert file_path.exists()
    assert file_path.read_bytes() == content
    assert file_path.parent == storage_service.storage_path


def test_save_file_creates_storage_directory(
    tmp_path: Path,
):
    storage_path = tmp_path / "evidences"

    service = EvidenceStorageService(
        storage_path=storage_path
    )

    content = create_valid_image("PNG")

    storage_key = service.save_file(
        "imagen.png",
        content,
        "image/png",
    )

    assert storage_path.is_dir()
    assert service.get_file_path(storage_key).is_file()


def test_save_file_rejects_invalid_content_without_writing(
    storage_service: EvidenceStorageService,
):
    with pytest.raises(
        ValueError,
        match="Invalid file signature",
    ):
        storage_service.save_file(
            "reporte.pdf",
            b"contenido invalido",
            "application/pdf",
        )

    assert list(storage_service.storage_path.iterdir()) == []


def test_save_file_preserves_existing_file_on_collision(
    storage_service: EvidenceStorageService,
    monkeypatch: pytest.MonkeyPatch,
):
    existing_key = "a" * 32 + ".pdf"
    new_key = "b" * 32 + ".pdf"

    existing_path = storage_service.storage_path / existing_key
    existing_path.write_bytes(b"archivo original")

    generated_keys = iter([existing_key, new_key])

    monkeypatch.setattr(
        storage_service,
        "generate_storage_key",
        lambda extension: next(generated_keys),
    )
    content = create_valid_pdf()
    result = storage_service.save_file(
        "documento.pdf",
        content,
        "application/pdf",
    )

    assert result == new_key
    assert existing_path.read_bytes() == b"archivo original"
    assert storage_service.get_file_path(new_key).is_file()


def test_save_file_rejects_repeated_collisions(
    storage_service: EvidenceStorageService,
    monkeypatch: pytest.MonkeyPatch,
):
    existing_key = "a" * 32 + ".pdf"
    existing_path = storage_service.storage_path / existing_key
    existing_path.write_bytes(b"archivo original")

    monkeypatch.setattr(
        storage_service,
        "generate_storage_key",
        lambda extension: existing_key,
    )

    with pytest.raises(
        RuntimeError,
        match="Could not generate a unique storage key",
    ):
        content = create_valid_pdf()
        storage_service.save_file(
            "documento.pdf",
            content,
            "application/pdf",
        )

    assert existing_path.read_bytes() == b"archivo original"


def test_get_file_returns_existing_file(
    storage_service: EvidenceStorageService,
):
    content = create_valid_pdf()

    storage_key = storage_service.save_file(
        "documento.pdf",
        content,
        "application/pdf",
    )

    file_path = storage_service.get_file(storage_key)

    assert file_path.is_file()
    assert file_path.read_bytes() == content


def test_get_file_raises_error_for_missing_file(
    storage_service: EvidenceStorageService,
):
    storage_key = "a" * 32 + ".pdf"

    with pytest.raises(
        FileNotFoundError,
        match="Evidence file not found",
    ):
        storage_service.get_file(storage_key)


def test_delete_file_removes_existing_file(
    storage_service: EvidenceStorageService,
):
    content = create_valid_pdf()
    storage_key = storage_service.save_file(
        "documento.pdf",
        content,
        "application/pdf",
    )

    file_path = storage_service.get_file_path(storage_key)

    storage_service.delete_file(storage_key)

    assert not file_path.exists()


def test_delete_file_raises_error_for_missing_file(
    storage_service: EvidenceStorageService,
):
    storage_key = "a" * 32 + ".pdf"

    with pytest.raises(
        FileNotFoundError,
        match="Evidence file not found",
    ):
        storage_service.delete_file(storage_key)


def test_delete_file_rejects_invalid_storage_key(
    storage_service: EvidenceStorageService,
):
    with pytest.raises(
        ValueError,
        match="Invalid storage key",
    ):
        storage_service.delete_file("../documento.pdf")


def test_save_file_sets_private_permissions(
    storage_service: EvidenceStorageService,
):
    content = create_valid_pdf()
    storage_key = storage_service.save_file(
        "documento.pdf",
        content,
        "application/pdf",
    )

    file_path = storage_service.get_file(storage_key)

    permissions = stat.S_IMODE(file_path.stat().st_mode)

    assert permissions == 0o600


def test_save_file_preserves_target_of_existing_symlink(
    storage_service: EvidenceStorageService,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
):
    storage_key = "a" * 32 + ".pdf"

    target_file = tmp_path.parent / (
        f"{tmp_path.name}_protected.txt"
    )
    target_file.write_bytes(b"contenido protegido")

    symlink_path = storage_service.storage_path / storage_key
    symlink_path.symlink_to(target_file)

    monkeypatch.setattr(
        storage_service,
        "generate_storage_key",
        lambda extension: storage_key,
    )

    try:
        with pytest.raises(
            (ValueError, RuntimeError),
        ):
            content = create_valid_pdf()
            storage_service.save_file(
                "documento.pdf",
                content,
                "application/pdf",
            )

        assert target_file.read_bytes() == b"contenido protegido"
        assert symlink_path.is_symlink()

    finally:
        symlink_path.unlink(missing_ok=True)
        target_file.unlink(missing_ok=True)


def test_get_file_rejects_symlink(
    storage_service: EvidenceStorageService,
    tmp_path: Path,
):
    storage_key = "a" * 32 + ".pdf"

    target_file = tmp_path / "target.pdf"
    target_file.write_bytes(b"%PDF-1.7\ncontenido")

    symlink_path = storage_service.storage_path / storage_key
    symlink_path.symlink_to(target_file)

    with pytest.raises(
        ValueError,
        match="Symbolic links are not allowed",
    ):
        storage_service.get_file(storage_key)


def test_open_file_reads_existing_file(
    storage_service: EvidenceStorageService,
):
    content = create_valid_pdf()

    storage_key = storage_service.save_file(
        "documento.pdf",
        content,
        "application/pdf",
    )

    with storage_service.open_file(storage_key) as file:
        assert file.read() == content


def test_open_file_rejects_missing_file(
    storage_service: EvidenceStorageService,
):
    storage_key = "a" * 32 + ".pdf"

    with pytest.raises(
        FileNotFoundError,
        match="Evidence file not found",
    ):
        storage_service.open_file(storage_key)


def test_open_file_rejects_directory(
    storage_service: EvidenceStorageService,
):
    storage_key = "a" * 32 + ".pdf"
    directory_path = storage_service.storage_path / storage_key
    directory_path.mkdir()

    with pytest.raises(
        ValueError,
        match="Evidence must be a regular file",
    ):
        storage_service.open_file(storage_key)


def test_open_file_rejects_fifo(
    storage_service: EvidenceStorageService,
):
    storage_key = "a" * 32 + ".pdf"
    fifo_path = storage_service.storage_path / storage_key

    os.mkfifo(fifo_path)

    with pytest.raises(
        ValueError,
        match="Evidence must be a regular file",
    ):
        storage_service.open_file(storage_key)


def test_delete_file_rejects_directory(
    storage_service: EvidenceStorageService,
):
    storage_key = "a" * 32 + ".pdf"
    directory_path = storage_service.storage_path / storage_key
    directory_path.mkdir()

    with pytest.raises(
        ValueError,
        match="Evidence must be a regular file",
    ):
        storage_service.delete_file(storage_key)

    assert directory_path.is_dir()


def test_delete_file_rejects_fifo(
    storage_service: EvidenceStorageService,
):
    storage_key = "a" * 32 + ".pdf"
    fifo_path = storage_service.storage_path / storage_key

    os.mkfifo(fifo_path)

    with pytest.raises(
        ValueError,
        match="Evidence must be a regular file",
    ):
        storage_service.delete_file(storage_key)

    assert fifo_path.exists()


def test_save_file_removes_partial_file_on_write_error(
    storage_service: EvidenceStorageService,
    monkeypatch: pytest.MonkeyPatch,
):
    storage_key = "a" * 32 + ".pdf"
    file_path = storage_service.storage_path / storage_key

    monkeypatch.setattr(
        storage_service,
        "generate_storage_key",
        lambda extension: storage_key,
    )

    original_fdopen = os.fdopen

    class FailingFile:
        def __init__(self, file):
            self.file = file

        def __enter__(self):
            self.file.__enter__()
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return self.file.__exit__(
                exc_type,
                exc_value,
                traceback,
            )

        def write(self, content):
            self.file.write(content[:5])
            raise OSError("Simulated write failure")

    def failing_fdopen(fd, mode):
        return FailingFile(original_fdopen(fd, mode))

    monkeypatch.setattr(
        os,
        "fdopen",
        failing_fdopen,
    )

    with pytest.raises(
        OSError,
        match="Simulated write failure",
    ):
        content = create_valid_pdf()
        storage_service.save_file(
            "documento.pdf",
            content,
            "application/pdf",
        )

    assert not file_path.exists()

@pytest.mark.anyio
async def test_save_upload_file_stores_content(
    storage_service: EvidenceStorageService,
):
    content = create_valid_pdf() + b"\n" + b" " * 150000

    upload = UploadFile(
        file=BytesIO(content),
        filename="documento.pdf",
        headers={
            "content-type": "application/pdf",
        },
    )

    storage_key, file_size = await storage_service.save_upload_file(
        upload
    )

    file_path = storage_service.get_file(storage_key)

    assert file_path.read_bytes() == content
    assert file_size == len(content)

    await upload.close()


@pytest.mark.anyio
async def test_save_upload_file_rejects_oversized_file(
    storage_service: EvidenceStorageService,
):
    content = (
        b"%PDF-1.7\n"
        + b"a" * storage_service.MAX_FILE_SIZE
    )

    upload = UploadFile(
        file=BytesIO(content),
        filename="documento.pdf",
        headers=Headers({
            "content-type": "application/pdf",
        }),
    )

    try:
        with pytest.raises(
            ValueError,
            match="File exceeds maximum size",
        ):
            await storage_service.save_upload_file(upload)

        assert list(storage_service.storage_path.iterdir()) == []
    finally:
        await upload.close()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "filename,mime_type,content,error",
    [
        (
            "documento.pdf",
            "application/pdf",
            b"",
            "File cannot be empty",
        ),
        (
            "documento.pdf",
            "application/pdf",
            b"contenido sin firma PDF",
            "Invalid file signature",
        ),
        (
            "imagen.png",
            "image/png",
            b"%PDF-1.7\ncontenido",
            "Invalid file signature",
        ),
        (
            "foto.jpg",
            "image/jpeg",
            b"contenido sin firma JPEG",
            "Invalid file signature",
        ),
    ],
)
async def test_save_upload_file_rejects_invalid_content(
    storage_service: EvidenceStorageService,
    filename: str,
    mime_type: str,
    content: bytes,
    error: str,
):
    upload = UploadFile(
        file=BytesIO(content),
        filename=filename,
        headers=Headers({
            "content-type": mime_type,
        }),
    )

    try:
        with pytest.raises(ValueError, match=error):
            await storage_service.save_upload_file(upload)

        assert list(storage_service.storage_path.iterdir()) == []
    finally:
        await upload.close()


@pytest.mark.anyio
async def test_save_upload_file_removes_partial_file_on_read_error(
    storage_service: EvidenceStorageService,
    monkeypatch: pytest.MonkeyPatch,
):
    content = b"%PDF-1.7\n" + b"a" * 150000

    upload = UploadFile(
        file=BytesIO(content),
        filename="documento.pdf",
        headers=Headers({
            "content-type": "application/pdf",
        }),
    )

    original_read = upload.read
    read_count = 0

    async def failing_read(size: int = -1) -> bytes:
        nonlocal read_count
        read_count += 1

        if read_count == 2:
            raise OSError("Simulated read failure")

        return await original_read(size)

    monkeypatch.setattr(upload, "read", failing_read)

    try:
        with pytest.raises(
            OSError,
            match="Simulated read failure",
        ):
            await storage_service.save_upload_file(upload)

        assert list(storage_service.storage_path.iterdir()) == []
        assert read_count == 2
    finally:
        await upload.close()


@pytest.mark.anyio
async def test_save_upload_file_preserves_existing_file_on_collision(
    storage_service: EvidenceStorageService,
    monkeypatch: pytest.MonkeyPatch,
):
    existing_key = "a" * 32 + ".pdf"
    new_key = "b" * 32 + ".pdf"

    existing_path = storage_service.storage_path / existing_key
    existing_path.write_bytes(b"archivo original")

    generated_keys = iter([existing_key, new_key])

    monkeypatch.setattr(
        storage_service,
        "generate_storage_key",
        lambda extension: next(generated_keys),
    )

    content = create_valid_pdf()

    upload = UploadFile(
        file=BytesIO(content),
        filename="documento.pdf",
        headers=Headers({
            "content-type": "application/pdf",
        }),
    )

    try:
        storage_key, file_size = (
            await storage_service.save_upload_file(upload)
        )

        assert storage_key == new_key
        assert file_size == len(content)
        assert existing_path.read_bytes() == b"archivo original"
        assert storage_service.get_file(new_key).read_bytes() == content
    finally:
        await upload.close()


@pytest.mark.anyio
async def test_save_upload_file_rejects_repeated_collisions(
    storage_service: EvidenceStorageService,
    monkeypatch: pytest.MonkeyPatch,
):
    existing_key = "a" * 32 + ".pdf"
    existing_path = storage_service.storage_path / existing_key
    existing_path.write_bytes(b"archivo original")

    monkeypatch.setattr(
        storage_service,
        "generate_storage_key",
        lambda extension: existing_key,
    )

    upload = UploadFile(
        file=BytesIO(b"%PDF-1.7\ncontenido nuevo"),
        filename="documento.pdf",
        headers=Headers({
            "content-type": "application/pdf",
        }),
    )

    try:
        with pytest.raises(
            RuntimeError,
            match="Could not generate a unique storage key",
        ):
            await storage_service.save_upload_file(upload)

        assert existing_path.read_bytes() == b"archivo original"
        assert list(storage_service.storage_path.iterdir()) == [
            existing_path
        ]
    finally:
        await upload.close()


def test_generated_test_files_are_valid():
    pdf_content = create_valid_pdf()
    png_content = create_valid_image("PNG")
    jpeg_content = create_valid_image("JPEG")

    pdf_reader = PdfReader(BytesIO(pdf_content))

    assert len(pdf_reader.pages) == 1

    with Image.open(BytesIO(png_content)) as image:
        image.verify()

    with Image.open(BytesIO(jpeg_content)) as image:
        image.verify()


@pytest.mark.parametrize(
    "extension,content_factory",
    [
        (".pdf", create_valid_pdf),
        (".png", lambda: create_valid_image("PNG")),
        (".jpg", lambda: create_valid_image("JPEG")),
        (".jpeg", lambda: create_valid_image("JPEG")),
    ],
)
def test_validate_file_structure_accepts_valid_files(
    storage_service: EvidenceStorageService,
    extension: str,
    content_factory,
):
    content = content_factory()

    storage_service.validate_file_structure(
        content,
        extension,
    )


@pytest.mark.parametrize(
    "extension,content",
    [
        (".pdf", b"%PDF-1.7\ncontenido invalido"),
        (
            ".png",
            b"\x89PNG\r\n\x1a\ncontenido invalido",
        ),
        (
            ".jpg",
            b"\xff\xd8\xffcontenido invalido",
        ),
    ],
)

def test_validate_file_structure_rejects_invalid_files(
    storage_service: EvidenceStorageService,
    extension: str,
    content: bytes,
):
    with pytest.raises(
        ValueError,
        match="Invalid file structure",
    ):
        storage_service.validate_file_structure(
            content,
            extension,
        )


def test_save_file_rejects_invalid_structure(
    storage_service: EvidenceStorageService,
):
    content = b"%PDF-1.7\ncontenido invalido"

    with pytest.raises(
        ValueError,
        match="Invalid file structure",
    ):
        storage_service.save_file(
            "documento.pdf",
            content,
            "application/pdf",
        )

    assert list(storage_service.storage_path.iterdir()) == []


@pytest.mark.parametrize(
    "filename,mime_type,content_factory",
    [
        ("documento.pdf", "application/pdf", create_valid_pdf),
        ("imagen.png", "image/png", lambda: create_valid_image("PNG")),
        ("foto.jpg", "image/jpeg", lambda: create_valid_image("JPEG")),
    ],
)
def test_validate_stored_file_structure_accepts_valid_files(
    storage_service: EvidenceStorageService,
    filename: str,
    mime_type: str,
    content_factory,
):
    storage_key = storage_service.save_file(
        filename,
        content_factory(),
        mime_type,
    )

    storage_service.validate_stored_file_structure(storage_key)


def test_validate_stored_file_structure_rejects_invalid_pdf(
    storage_service: EvidenceStorageService,
):
    storage_key = "a" * 32 + ".pdf"
    file_path = storage_service.storage_path / storage_key

    file_path.write_bytes(b"%PDF-1.7\ncontenido invalido")

    with pytest.raises(
        ValueError,
        match="Invalid file structure",
    ):
        storage_service.validate_stored_file_structure(
            storage_key
        )


@pytest.mark.anyio
async def test_save_upload_file_rejects_invalid_structure(
    storage_service: EvidenceStorageService,
):
    content = b"%PDF-1.7\ncontenido invalido"

    upload = UploadFile(
        file=BytesIO(content),
        filename="documento.pdf",
        headers=Headers({
            "content-type": "application/pdf",
        }),
    )

    try:
        with pytest.raises(
            ValueError,
            match="Invalid file structure",
        ):
            await storage_service.save_upload_file(upload)

        assert list(storage_service.storage_path.iterdir()) == []
    finally:
        await upload.close()


def test_validate_file_structure_rejects_large_image(
    storage_service: EvidenceStorageService,
):
    original_limit = storage_service.MAX_IMAGE_PIXELS

    storage_service.MAX_IMAGE_PIXELS = 50

    try:
        content = create_valid_image("PNG")

        with pytest.raises(
            ValueError,
            match="Image exceeds maximum dimensions",
        ):
            storage_service.validate_file_structure(
                content,
                ".png",
            )
    finally:
        storage_service.MAX_IMAGE_PIXELS = original_limit


def test_validate_stored_file_structure_rejects_large_image(
    storage_service: EvidenceStorageService,
):
    content = create_valid_image("PNG")

    storage_key = storage_service.save_file(
        "imagen.png",
        content,
        "image/png",
    )

    storage_service.MAX_IMAGE_PIXELS = 50

    with pytest.raises(
        ValueError,
        match="Image exceeds maximum dimensions",
    ):
        storage_service.validate_stored_file_structure(
            storage_key
        )


def test_validate_file_structure_rejects_excessive_pdf_pages(
    storage_service: EvidenceStorageService,
):
    content = create_valid_pdf()

    storage_service.MAX_PDF_PAGES = 0

    with pytest.raises(
        ValueError,
        match="PDF exceeds maximum pages",
    ):
        storage_service.validate_file_structure(
            content,
            ".pdf",
        )


def test_validate_stored_file_structure_rejects_excessive_pdf_pages(
    storage_service: EvidenceStorageService,
):
    content = create_valid_pdf()

    storage_key = storage_service.save_file(
        "documento.pdf",
        content,
        "application/pdf",
    )

    storage_service.MAX_PDF_PAGES = 0

    with pytest.raises(
        ValueError,
        match="PDF exceeds maximum pages",
    ):
        storage_service.validate_stored_file_structure(
            storage_key
        )
