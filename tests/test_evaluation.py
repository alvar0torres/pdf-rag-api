import json
from contextlib import closing

import pytest
from pypdf import PdfReader
from pydantic import ValidationError
from qdrant_client import QdrantClient, models

from app.chunking import text_splitter
from app.schemas import SourceChunk
from evals.evaluate_retrieval import (
    DEFAULT_DATASET,
    EvaluationDataset,
    EvidencePassage,
    calculate_metrics,
    first_relevant_rank,
    load_dataset,
    validate_indexed_evidence,
)


def test_first_relevant_rank_requires_matching_file_page_and_evidence():
    results: list[SourceChunk] = [
        {
            "text": "Relevant evidence.",
            "file_name": "other.pdf",
            "page_number": 29,
            "chunk_index": 1,
        },
        {
            "text": "Relevant evidence.",
            "file_name": "intro_botany.pdf",
            "page_number": 30,
            "chunk_index": 1,
        },
        {
            "text": "An unrelated chunk on the expected page.",
            "file_name": "intro_botany.pdf",
            "page_number": 29,
            "chunk_index": 1,
        },
        {
            "text": "Relevant evidence.",
            "file_name": "intro_botany.pdf",
            "page_number": 29,
            "chunk_index": 2,
        },
    ]

    assert (
        first_relevant_rank(
            results,
            source_file="intro_botany.pdf",
            evidence=[EvidencePassage(page_number=29, text="Relevant evidence.")],
        )
        == 4
    )


def test_first_relevant_rank_returns_none_when_evidence_is_not_retrieved():
    results: list[SourceChunk] = [
        {
            "text": "Unrelated evidence.",
            "file_name": "intro_botany.pdf",
            "page_number": 30,
            "chunk_index": 1,
        }
    ]

    assert (
        first_relevant_rank(
            results,
            source_file="intro_botany.pdf",
            evidence=[EvidencePassage(page_number=29, text="Relevant evidence.")],
        )
        is None
    )


def test_first_relevant_rank_accepts_alternative_evidence_and_normalizes_text():
    results: list[SourceChunk] = [
        {
            "text": "The FLOWER\n has ﬂowers.",
            "file_name": "intro_botany.pdf",
            "page_number": 30,
            "chunk_index": 1,
        }
    ]

    assert first_relevant_rank(
        results,
        source_file="intro_botany.pdf",
        evidence=[
            EvidencePassage(page_number=29, text="Other evidence."),
            EvidencePassage(page_number=30, text="flower has flowers"),
        ],
    ) == 1


def test_calculate_metrics_uses_first_relevant_rank():
    metrics = calculate_metrics([1, 3, None])

    assert metrics == {
        "hit@1": pytest.approx(1 / 3),
        "hit@3": pytest.approx(2 / 3),
        "hit@5": pytest.approx(2 / 3),
        "mrr@5": pytest.approx(4 / 9),
    }


def test_calculate_metrics_rejects_empty_results():
    with pytest.raises(ValueError, match="At least one rank"):
        calculate_metrics([])


def test_load_dataset_rejects_duplicate_question_ids(tmp_path):
    data = {
        "title": "Botany benchmark",
        "source_file": "intro_botany.pdf",
        "source_url": "https://example.test/intro_botany.pdf",
        "license": "CC0",
        "questions": [
            {
                "id": "same",
                "question": "First question?",
                "evidence": [{"page_number": 1, "text": "First evidence."}],
            },
            {
                "id": "same",
                "question": "Second question?",
                "evidence": [{"page_number": 2, "text": "Second evidence."}],
            },
        ],
    }
    dataset_path = tmp_path / "dataset.json"
    dataset_path.write_text(json.dumps(data), encoding="utf-8")

    with pytest.raises(ValueError, match="Question IDs must be unique"):
        load_dataset(dataset_path)


def test_dataset_rejects_nonpositive_page_numbers():
    with pytest.raises(ValidationError):
        EvaluationDataset.model_validate(
            {
                "title": "Botany benchmark",
                "source_file": "intro_botany.pdf",
                "source_url": "https://example.test/intro_botany.pdf",
                "license": "CC0",
                "questions": [
                    {
                        "id": "bad-page",
                        "question": "Question?",
                        "evidence": [{"page_number": 0, "text": "Evidence."}],
                    }
                ],
            }
        )


@pytest.mark.parametrize("text", ["", " \n "])
def test_dataset_rejects_blank_evidence(text):
    with pytest.raises(ValidationError):
        EvidencePassage(page_number=1, text=text)


def test_indexed_evidence_validation_rejects_missing_passage():
    dataset = EvaluationDataset.model_validate(
        {
            "title": "Benchmark",
            "source_file": "intro_botany.pdf",
            "source_url": "https://example.test/intro_botany.pdf",
            "license": "CC0",
            "questions": [
                {
                    "id": "example",
                    "question": "Question?",
                    "evidence": [{"page_number": 29, "text": "Relevant evidence."}],
                }
            ],
        }
    )
    with closing(QdrantClient(":memory:")) as client:
        client.create_collection(
            collection_name="test",
            vectors_config=models.VectorParams(size=2, distance=models.Distance.COSINE),
        )
        client.upsert(
            collection_name="test",
            points=[
                models.PointStruct(
                    id=1,
                    vector=[1.0, 0.0],
                    payload={
                        "file_name": "intro_botany.pdf",
                        "page_number": 29,
                        "chunk_index": 1,
                        "text": "A different passage.",
                    },
                )
            ],
        )

        with pytest.raises(ValueError, match="example.*page 29"):
            validate_indexed_evidence(client, "test", dataset)

        client.set_payload(
            collection_name="test",
            payload={"text": "Relevant evidence."},
            points=[1],
        )
        validate_indexed_evidence(client, "test", dataset)


def test_botany_evidence_matches_extracted_chunks():
    dataset = load_dataset(DEFAULT_DATASET)
    pdf_path = DEFAULT_DATASET.parent.parent / "data/sample_documents/intro_botany.pdf"
    reader = PdfReader(pdf_path)

    for question in dataset.questions:
        for passage in question.evidence:
            page = reader.pages[passage.page_number - 1]
            chunks = text_splitter.split_text(page.extract_text() or "")
            sources: list[SourceChunk] = [
                {
                    "file_name": dataset.source_file,
                    "page_number": passage.page_number,
                    "chunk_index": index,
                    "text": chunk,
                }
                for index, chunk in enumerate(chunks, start=1)
            ]
            assert first_relevant_rank(
                sources, source_file=dataset.source_file, evidence=[passage]
            ) is not None, f"{question.id}: passage not found on PDF page {passage.page_number}"
