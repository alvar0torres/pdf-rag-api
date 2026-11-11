from app.chunking import text_splitter


def test_empty_text_returns_no_chunks():
    assert text_splitter.split_text("") == []


def test_short_text_returns_one_chunk():
    assert text_splitter.split_text("These words fit.") == ["These words fit."]


def test_text_splits_at_maximum_size():
    text = " ".join(f"token{index}" for index in range(300))
    chunks = text_splitter.split_text(text)

    assert len(chunks) > 1
    assert all(len(chunk) <= 1000 for chunk in chunks)
    for current, following in zip(chunks, chunks[1:]):
        max_overlap_to_check = min(150, len(current), len(following))
        overlap_length = 0
        for length in range(1, max_overlap_to_check + 1):
            if current[-length:] == following[:length]:
                overlap_length = length

        assert overlap_length >= 100
