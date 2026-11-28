from __future__ import annotations

import argparse
import asyncio
import json
import os
import unicodedata
from pathlib import Path
from typing import Sequence

from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator
from qdrant_client import QdrantClient, models

from app.schemas import SourceChunk

TOP_K = 5
CANDIDATE_LIMIT = 20
HIT_CUTOFFS = (1, 3, 5)
MODES = ("dense", "hybrid", "hybrid + Cohere")
DEFAULT_DATASET = Path(__file__).with_name("botany_questions.json")


class EvaluationPreconditionError(ValueError):
    """The indexed benchmark data is missing or incompatible."""


class EvidencePassage(BaseModel):
    page_number: int = Field(ge=1)
    text: str = Field(min_length=1)

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, text: str) -> str:
        if not text.strip():
            raise ValueError("Evidence text must not be blank.")
        return text


class EvaluationQuestion(BaseModel):
    id: str = Field(min_length=1)
    question: str = Field(min_length=1)
    evidence: list[EvidencePassage] = Field(min_length=1)


class EvaluationDataset(BaseModel):
    title: str = Field(min_length=1)
    source_file: str = Field(min_length=1)
    source_url: str = Field(min_length=1)
    license: str = Field(min_length=1)
    questions: list[EvaluationQuestion] = Field(min_length=1)

    @model_validator(mode="after")
    def question_ids_must_be_unique(self) -> EvaluationDataset:
        question_ids = [question.id for question in self.questions]
        if len(set(question_ids)) != len(question_ids):
            raise ValueError("Question IDs must be unique.")
        return self


def load_dataset(path: Path) -> EvaluationDataset:
    try:
        raw_data = json.loads(path.read_text(encoding="utf-8"))
        return EvaluationDataset.model_validate(raw_data)
    except (OSError, json.JSONDecodeError, ValidationError) as error:
        raise ValueError(
            f"Unable to load evaluation dataset {path}: {error}"
        ) from error


def normalize_text(text: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", text).casefold().split())


def first_relevant_rank(
    results: Sequence[SourceChunk],
    *,
    source_file: str,
    evidence: Sequence[EvidencePassage],
) -> int | None:
    for rank, result in enumerate(results, start=1):
        if result["file_name"] != source_file:
            continue
        text = normalize_text(result["text"])
        if any(
            result["page_number"] == passage.page_number
            and normalize_text(passage.text) in text
            for passage in evidence
        ):
            return rank
    return None


def calculate_metrics(ranks: Sequence[int | None]) -> dict[str, float]:
    if not ranks:
        raise ValueError("At least one rank is required to calculate metrics.")

    metrics = {
        f"hit@{cutoff}": sum(rank is not None and rank <= cutoff for rank in ranks)
        / len(ranks)
        for cutoff in HIT_CUTOFFS
    }
    metrics["mrr@5"] = sum(1 / rank if rank is not None else 0 for rank in ranks) / len(
        ranks
    )
    return metrics


def _sources_from_points(points: Sequence[object], mode: str) -> list[SourceChunk]:
    sources: list[SourceChunk] = []
    for rank, point in enumerate(points, start=1):
        payload = getattr(point, "payload", None)
        if not isinstance(payload, dict):
            raise ValueError(f"{mode} result {rank} is missing its payload.")

        text = payload.get("text")
        file_name = payload.get("file_name")
        page_number = payload.get("page_number")
        chunk_index = payload.get("chunk_index")
        if (
            not isinstance(text, str)
            or not isinstance(file_name, str)
            or not isinstance(page_number, int)
            or not isinstance(chunk_index, int)
        ):
            raise ValueError(f"{mode} result {rank} has incomplete chunk metadata.")

        sources.append(
            {
                "text": text,
                "file_name": file_name,
                "page_number": page_number,
                "chunk_index": chunk_index,
            }
        )
    return sources


def validate_indexed_evidence(
    qdrant_client: QdrantClient,
    collection_name: str,
    dataset: EvaluationDataset,
) -> None:
    pages = sorted(
        {
            passage.page_number
            for question in dataset.questions
            for passage in question.evidence
        }
    )
    page_filter = models.Filter(
        must=[
            models.FieldCondition(
                key="file_name",
                match=models.MatchValue(value=dataset.source_file),
            ),
            models.FieldCondition(
                key="page_number",
                match=models.MatchAny(any=pages),
            ),
        ]
    )
    sources: list[SourceChunk] = []
    offset = None
    while True:
        points, offset = qdrant_client.scroll(
            collection_name=collection_name,
            scroll_filter=page_filter,
            limit=100,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        sources.extend(_sources_from_points(points, "Indexed evidence"))
        if offset is None:
            break

    for question in dataset.questions:
        for passage in question.evidence:
            if (
                first_relevant_rank(
                    sources, source_file=dataset.source_file, evidence=[passage]
                )
                is None
            ):
                raise EvaluationPreconditionError(
                    f"Evidence for question {question.id!r} on PDF page "
                    f"{passage.page_number} was not found in an indexed chunk. "
                    "Check the document version, labels, and chunking, then re-ingest "
                    "the PDF if needed."
                )


async def run_evaluation(dataset: EvaluationDataset) -> dict[str, list[int | None]]:
    from app.embeddings import create_embeddings
    from app.reranker import rerank_sources
    from app.vector_store import (
        COLLECTION_NAME,
        HYBRID_PREFETCH_LIMIT,
        client as qdrant_client,
        search_chunks,
        search_hybrid_chunks,
    )

    if CANDIDATE_LIMIT > HYBRID_PREFETCH_LIMIT:
        raise ValueError(
            "The evaluation candidate limit cannot exceed the hybrid prefetch limit."
        )

    source_count = qdrant_client.count(
        collection_name=COLLECTION_NAME,
        count_filter=models.Filter(
            must=[
                models.FieldCondition(
                    key="file_name",
                    match=models.MatchValue(value=dataset.source_file),
                )
            ]
        ),
        exact=True,
    ).count
    if source_count == 0:
        raise EvaluationPreconditionError(
            f"No indexed chunks found for {dataset.source_file!r}. "
            "Ingest the benchmark PDF using that filename first."
        )

    validate_indexed_evidence(qdrant_client, COLLECTION_NAME, dataset)

    embeddings = await create_embeddings(
        [question.question for question in dataset.questions]
    )
    if len(embeddings) != len(dataset.questions):
        raise ValueError("The embedding service returned an unexpected result count.")

    ranks_by_mode = {mode: [] for mode in MODES}
    for question, embedding in zip(dataset.questions, embeddings, strict=True):
        dense_sources = _sources_from_points(
            search_chunks(embedding, limit=CANDIDATE_LIMIT),
            "Dense search",
        )
        hybrid_sources = _sources_from_points(
            search_hybrid_chunks(
                embedding,
                question.question,
                limit=CANDIDATE_LIMIT,
            ),
            "Hybrid search",
        )
        reranked_sources = await rerank_sources(
            question.question,
            hybrid_sources,
            limit=TOP_K,
        )

        for mode, sources in (
            ("dense", dense_sources[:TOP_K]),
            ("hybrid", hybrid_sources[:TOP_K]),
            ("hybrid + Cohere", reranked_sources[:TOP_K]),
        ):
            ranks_by_mode[mode].append(
                first_relevant_rank(
                    sources,
                    source_file=dataset.source_file,
                    evidence=question.evidence,
                )
            )

    return ranks_by_mode


def print_summary(ranks_by_mode: dict[str, list[int | None]]) -> None:
    print("\nRetrieval quality (higher is better)")
    print(f"{'Mode':<20} {'Hit@1':>8} {'Hit@3':>8} {'Hit@5':>8} {'MRR@5':>8}")
    for mode in MODES:
        metrics = calculate_metrics(ranks_by_mode[mode])
        print(
            f"{mode:<20} "
            f"{metrics['hit@1']:>7.0%} "
            f"{metrics['hit@3']:>7.0%} "
            f"{metrics['hit@5']:>7.0%} "
            f"{metrics['mrr@5']:>8.3f}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compare dense, hybrid, and Cohere-reranked retrieval."
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=DEFAULT_DATASET,
        help=f"Evaluation JSON file (default: {DEFAULT_DATASET}).",
    )
    args = parser.parse_args()

    try:
        dataset = load_dataset(args.dataset)
    except ValueError as error:
        parser.error(str(error))

    load_dotenv()
    missing_keys = [
        key for key in ("OPENAI_API_KEY", "COHERE_API_KEY") if not os.getenv(key)
    ]
    if missing_keys:
        parser.error(f"Missing required API key(s): {', '.join(missing_keys)}")

    from app.vector_store import client as qdrant_client

    print(
        f"{dataset.title}: {len(dataset.questions)} questions; "
        f"top {TOP_K} from {CANDIDATE_LIMIT} candidates"
    )
    try:
        ranks_by_mode = asyncio.run(run_evaluation(dataset))
        print_summary(ranks_by_mode)
    finally:
        qdrant_client.close()


if __name__ == "__main__":
    main()
