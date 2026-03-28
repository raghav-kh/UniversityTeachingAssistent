import re
import logging
from typing import Generator, Dict, Any, List, Optional

# PyMuPDF import; keep at module level so import error surfaces early
import fitz  # pip install PyMuPDF

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def clean_text(text: str) -> str:
    """Remove excessive whitespace and normalize text."""
    if not isinstance(text, str):
        return ""
    text = re.sub(r'\r\n?', '\n', text)          # normalize CRLF
    text = re.sub(r'\n{3,}', '\n\n', text)       # collapse 3+ newlines to 2
    text = re.sub(r' {2,}', ' ', text)           # collapse multiple spaces
    return text.strip()


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract text from a PDF provided as raw bytes.
    Returns concatenated text with page markers.
    Raises ValueError if bytes are not a valid PDF.
    """
    if not file_bytes:
        raise ValueError("Empty file bytes provided")

    try:
        # Use context manager to ensure doc is closed on exceptions
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            pages: List[str] = []
            for page_num, page in enumerate(doc):
                try:
                    text = page.get_text()
                except Exception as e:
                    logger.debug("Failed to extract text from page %s: %s", page_num + 1, e)
                    text = ""
                text = clean_text(text)
                pages.append(f"[PAGE {page_num + 1}]\n{text}")
            return "\n\n".join(pages).strip()
    except Exception as exc:
        logger.exception("Failed to open PDF from bytes")
        raise ValueError("Invalid PDF data or unable to parse PDF") from exc


def _word_based_chunking(
    text: str,
    chunk_size_words: int,
    chunk_overlap_words: int
) -> Generator[Dict[str, Any], None, None]:
    """
    Word-based chunking generator. Yields dicts with content and metadata.
    Ensures final chunk is yielded even if small.
    """
    words = text.split()
    total_words = len(words)
    if total_words == 0:
        return

    chunk_index = 0
    start = 0

    while start < total_words:
        end = min(start + chunk_size_words, total_words)
        chunk_words = words[start:end]
        chunk_content = " ".join(chunk_words)

        # compute character offsets for the chunk for easier DB storage
        # find the nth word start by reconstructing prefix
        prefix = " ".join(words[:start])
        char_start = len(prefix) + (1 if start > 0 else 0)
        char_end = char_start + len(chunk_content)

        yield {
            "content": chunk_content,
            "chunk_index": chunk_index,
            "word_start": start,
            "word_end": end,
            "char_start": char_start,
            "char_end": char_end,
        }

        chunk_index += 1
        # advance with overlap
        start += max(1, chunk_size_words - chunk_overlap_words)

    # no early break — final chunk always yielded


def chunk_text(
    text: str,
    chunk_size_words: int = 500,
    chunk_overlap_words: int = 50,
) -> Generator[Dict[str, Any], None, None]:
    """
    Public chunking function using word-based chunking by default.
    If tiktoken is available and you prefer token-based chunking,
    use chunk_text_by_tokens instead.
    """
    text = text or ""
    yield from _word_based_chunking(text, chunk_size_words, chunk_overlap_words)


# Optional token-aware chunking using tiktoken (if installed)
def chunk_text_by_tokens(
    text: str,
    chunk_size_tokens: int = 500,
    chunk_overlap_tokens: int = 50,
    encoding_name: str = "cl100k_base"
) -> Generator[Dict[str, Any], None, None]:
    """
    Token-aware chunking. Requires tiktoken to be installed.
    Falls back to word-based chunking if tiktoken is not available.
    Yields same metadata as word-based chunking, but chunk boundaries are token-based.
    """
    try:
        import tiktoken
    except Exception:
        logger.warning("tiktoken not available; falling back to word-based chunking")
        # approximate tokens with words
        return chunk_text(text, chunk_size_words=chunk_size_tokens, chunk_overlap_words=chunk_overlap_tokens)

    enc = tiktoken.get_encoding(encoding_name)
    tokens = enc.encode(text)
    total_tokens = len(tokens)
    if total_tokens == 0:
        return

    chunk_index = 0
    start = 0

    while start < total_tokens:
        end = min(start + chunk_size_tokens, total_tokens)
        chunk_tokens = tokens[start:end]
        chunk_content = enc.decode(chunk_tokens)

        # compute approximate character offsets by searching for chunk_content in text
        # this is best-effort; for exact offsets more complex mapping is needed
        char_start = text.find(chunk_content)
        if char_start == -1:
            # fallback: approximate by counting characters of prefix tokens
            prefix = enc.decode(tokens[:start])
            char_start = len(prefix)
        char_end = char_start + len(chunk_content)

        yield {
            "content": chunk_content,
            "chunk_index": chunk_index,
            "token_start": start,
            "token_end": end,
            "char_start": char_start,
            "char_end": char_end,
        }

        chunk_index += 1
        start += max(1, chunk_size_tokens - chunk_overlap_tokens)


# Convenience wrapper to extract and chunk a PDF in one call
def extract_and_chunk_pdf(
    file_bytes: bytes,
    chunk_size_words: int = 500,
    chunk_overlap_words: int = 50,
    use_token_chunking: bool = False,
    token_chunk_size: int = 500,
    token_chunk_overlap: int = 50,
) -> Generator[Dict[str, Any], None, None]:
    """
    Extract text from PDF bytes and yield chunks.
    Set use_token_chunking=True to attempt token-aware chunking (requires tiktoken).
    """
    text = extract_text_from_pdf(file_bytes)
    if use_token_chunking:
        yield from chunk_text_by_tokens(text, chunk_size_tokens=token_chunk_size, chunk_overlap_tokens=token_chunk_overlap)
    else:
        yield from chunk_text(text, chunk_size_words=chunk_size_words, chunk_overlap_words=chunk_overlap_words)


# Quick self-test when run directly
if __name__ == "__main__":
    # Minimal smoke test (requires a small PDF file read as bytes)
    try:
        with open("sample.pdf", "rb") as f:
            b = f.read()
        text = extract_text_from_pdf(b)
        print("Extracted length:", len(text))
        for c in extract_and_chunk_pdf(b, chunk_size_words=120, chunk_overlap_words=20):
            print("Chunk", c["chunk_index"], "words", c.get("word_start"), "-", c.get("word_end"))
    except FileNotFoundError:
        logger.info("No sample.pdf found; skip smoke test")
    except Exception as e:
        logger.exception("Self-test failed: %s", e)