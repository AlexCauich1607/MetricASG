import pytest
from pydantic import ValidationError

from app.models.evaluation_evidence_request import (
    EvidenceCreateRequest,
    TextEvidenceType,
)


def test_create_valid_comment_request():
    request = EvidenceCreateRequest(
        indicator_id=1,
        type=TextEvidenceType.COMMENT,
        content="  Evidence comment  ",
    )

    assert request.content == "Evidence comment"


def test_create_valid_url_request():
    request = EvidenceCreateRequest(
        indicator_id=1,
        type=TextEvidenceType.URL,
        content="https://example.com/evidence",
    )

    assert request.content == "https://example.com/evidence"


@pytest.mark.parametrize(
    "content",
    ["", " ", "\n\t"],
)
def test_reject_empty_content(content):
    with pytest.raises(ValidationError):
        EvidenceCreateRequest(
            indicator_id=1,
            type=TextEvidenceType.COMMENT,
            content=content,
        )


def test_reject_comment_exceeding_limit():
    with pytest.raises(ValidationError):
        EvidenceCreateRequest(
            indicator_id=1,
            type=TextEvidenceType.COMMENT,
            content="A" * 2001,
        )


def test_allow_comment_at_limit():
    request = EvidenceCreateRequest(
        indicator_id=1,
        type=TextEvidenceType.COMMENT,
        content="A" * 2000,
    )

    assert len(request.content) == 2000


@pytest.mark.parametrize(
    "url",
    [
        "http://example.com",
        "ftp://example.com",
        "https://",
        "https://user:password@example.com",
        "https://example.com:invalid",
        "https://example.com/path with spaces",
    ],
)
def test_reject_invalid_url(url):
    with pytest.raises(ValidationError):
        EvidenceCreateRequest(
            indicator_id=1,
            type=TextEvidenceType.URL,
            content=url,
        )


def test_reject_url_exceeding_limit():
    with pytest.raises(ValidationError):
        EvidenceCreateRequest(
            indicator_id=1,
            type=TextEvidenceType.URL,
            content="https://example.com/" + "a" * 2048,
        )


def test_reject_file_type():
    with pytest.raises(ValidationError):
        EvidenceCreateRequest(
            indicator_id=1,
            type="FILE",
            content="document.pdf",
        )


def test_reject_extra_fields():
    with pytest.raises(ValidationError):
        EvidenceCreateRequest(
            indicator_id=1,
            type=TextEvidenceType.COMMENT,
            content="Evidence comment",
            user_id=100,
        )


def test_reject_invalid_indicator_id():
    with pytest.raises(ValidationError):
        EvidenceCreateRequest(
            indicator_id=0,
            type=TextEvidenceType.COMMENT,
            content="Evidence comment",
        )
