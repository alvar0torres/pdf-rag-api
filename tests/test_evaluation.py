import json

import pytest
from pydantic import ValidationError

from evals.evaluate_retrieval import (
    EvaluationDataset,
    calculate_metrics,
    first_relevant_rank,
    load_dataset,
)


def test_first_relevant_rank_matches_source_file_and_page():
    results = [
        {
            "text": "Other source on the expected page.",
            "file_name": "other.pdf",
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
            relevant_pages={29},
        )
        == 2
    )


def test_first_relevant_rank_returns_none_when_evidence_is_not_retrieved():
    results = [
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
            relevant_pages={29},
        )
        is None
    )


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
            {"id": "same", "question": "First question?", "relevant_pages": [1]},
            {"id": "same", "question": "Second question?", "relevant_pages": [2]},
        ],
    }
    dataset_path = tmp_path / "dataset.json"
    dataset_path.write_text(json.dumps(data), encoding="utf-8")

    with pytest.raises(ValueError, match="Question IDs must be unique"):
        load_dataset(dataset_path)


def test_dataset_rejects_nonpositive_page_numbers():
    with pytest.raises(ValidationError, match="Relevant page numbers must be positive"):
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
                        "relevant_pages": [0],
                    }
                ],
            }
        )
