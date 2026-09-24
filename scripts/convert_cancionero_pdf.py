import argparse
from datetime import datetime, timezone
import json
import re
import unicodedata
from pathlib import Path

import pdfplumber


SPANISH_ROOTS = ("do", "re", "mi", "fa", "sol", "la", "si")
ROOT_TO_KEY = {
    "do": "Do",
    "re": "Re",
    "mi": "Mi",
    "fa": "Fa",
    "sol": "Sol",
    "la": "La",
    "si": "Si",
}
SUFFIX = r"(?:-|m|maj7|m7|7|sus2|sus4|sus|add2|add9|dim|aug|°|2|4|5|6|9|11|13)?"
ROOT = rf"(?:{'|'.join(SPANISH_ROOTS)})(?:#|b)?{SUFFIX}"
CHORD_RE = re.compile(rf"^{ROOT}(?:/{ROOT})?$", re.IGNORECASE)
LABEL_RE = re.compile(r"^(?:intro|fin|subir|tono|bis|x\d+):?$", re.IGNORECASE)


def normalize_text(value):
    value = "".join(
        char
        for char in unicodedata.normalize("NFD", str(value).lower())
        if unicodedata.category(char) != "Mn"
    )
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def parse_title_index(path):
    entries = []
    for raw_line in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        match = re.match(r"(.+?)\s+(\d+)$", line)
        if not match:
            continue
        entries.append({"title": match.group(1).strip(), "page": int(match.group(2))})
    return entries


def clean_chord(token):
    token = token.strip().strip("[]{}.,;:¡!¿?\"“”'|")
    token = token.strip("()")
    token = token.replace("_", "/")
    return token if CHORD_RE.match(token) else ""


def chord_tokens(text):
    tokens = []
    ignored = 0
    for match in re.finditer(r"\S+", text.replace("_", " ")):
        raw = match.group(0)
        chord = clean_chord(raw)
        if chord:
            tokens.append({"chord": chord, "x": None})
        elif LABEL_RE.match(raw.strip(".,;:()")):
            ignored += 1
        else:
            ignored += 1
    return tokens, ignored


def is_chord_word(text):
    return bool(clean_chord(text))


def is_chord_line(line):
    words = line["words"]
    if not words:
        return False
    chord_count = sum(1 for word in words if is_chord_word(word["text"]))
    if not chord_count:
        return False
    other_count = sum(
        1
        for word in words
        if not is_chord_word(word["text"]) and not LABEL_RE.match(word["text"].strip(".,;:()"))
    )
    return chord_count >= max(1, other_count)


def line_text(words):
    return " ".join(word["text"] for word in words).strip()


def page_lines(page):
    words = page.extract_words(
        x_tolerance=2,
        y_tolerance=3,
        keep_blank_chars=False,
        use_text_flow=False,
        extra_attrs=["size"],
    )
    rows = []
    for word in sorted(words, key=lambda item: (item["top"], item["x0"])):
        for row in rows:
            if abs(row["top"] - word["top"]) <= 3:
                row["words"].append(word)
                row["top"] = min(row["top"], word["top"])
                row["bottom"] = max(row["bottom"], word["bottom"])
                break
        else:
            rows.append({"top": word["top"], "bottom": word["bottom"], "words": [word]})
    for row in rows:
        row["words"].sort(key=lambda item: item["x0"])
        row["text"] = line_text(row["words"])
        row["max_size"] = max(float(word.get("size") or 0) for word in row["words"])
    return rows


def is_title_line(line):
    return line.get("max_size", 0) >= 18


def find_title_line(lines, title, min_top=0):
    target = normalize_text(title)
    best = None
    for line in lines:
        if line["top"] < min_top:
            continue
        text = normalize_text(line["text"])
        if not text:
            continue
        if target == text or target in text or text in target:
            score = abs(len(target) - len(text)) + line["top"] / 1000
            if best is None or score < best[0]:
                best = (score, line)
    return best[1] if best else None


def resolve_title_positions(entries, lines_for_page, page_count):
    positions = []
    normalized_entries = [(index, normalize_text(entry["title"]), entry) for index, entry in enumerate(entries)]
    used_title_lines = set()
    last_location = (0, 0)

    for index, target, entry in normalized_entries:
        candidates = []
        search_start = max(1, entry["page"] - 2)
        search_end = min(page_count, entry["page"] + 8)

        for page_number in range(search_start, search_end + 1):
            for line_index, line in enumerate(lines_for_page(page_number)):
                if not is_title_line(line):
                    continue
                line_key = (page_number, line_index)
                if line_key in used_title_lines:
                    continue
                location = (page_number, line["top"])
                if location < last_location:
                    continue
                text = normalize_text(line["text"])
                if target == text:
                    match_penalty = 0
                elif target in text or text in target:
                    match_penalty = 10
                else:
                    continue
                if match_penalty == 0 or abs(page_number - entry["page"]) <= 4:
                    distance = abs(page_number - entry["page"])
                    text_penalty = abs(len(target) - len(text)) / 100
                    score = match_penalty + distance + text_penalty + line["top"] / 10000
                    candidates.append((score, page_number, line_index, line))

        best = min(candidates, default=None)

        if best is None:
            lines = lines_for_page(entry["page"]) if 1 <= entry["page"] <= page_count else []
            fallback = find_title_line(lines, entry["title"])
            if fallback and (entry["page"], fallback["top"]) >= last_location:
                best = (999, entry["page"], -1, fallback)

        if best:
            positions.append({"page": best[1], "line": best[3], "matched": True})
            if best[2] >= 0:
                used_title_lines.add((best[1], best[2]))
            last_location = (best[1], best[3]["top"])
        else:
            positions.append({"page": entry["page"], "line": None, "matched": False})
            last_location = max(last_location, (entry["page"], 0))

    return positions


def build_text_and_positions(words):
    text = ""
    positions = []
    previous_x1 = None
    for word in words:
        if text:
            text += " "
            gap_x = ((previous_x1 or word["x0"]) + word["x0"]) / 2
            positions.append(gap_x)
        token = word["text"]
        width = max(word["x1"] - word["x0"], 1)
        for index, char in enumerate(token):
            text += char
            positions.append(word["x0"] + width * (index / max(len(token), 1)))
        previous_x1 = word["x1"]
    positions.append((previous_x1 or 0) + 2)
    return text, positions


def x_to_text_index(positions, x):
    if not positions:
        return 0
    return min(range(len(positions)), key=lambda index: abs(positions[index] - x))


def insert_chords(lyric_line, chord_line):
    lyric_text, positions = build_text_and_positions(lyric_line["words"])
    inserts = {}
    for word in chord_line["words"]:
        chord = clean_chord(word["text"])
        if not chord:
            continue
        index = x_to_text_index(positions, word["x0"])
        inserts.setdefault(index, []).append(chord)

    output = []
    for index, char in enumerate(lyric_text):
        if index in inserts:
            output.extend(f"[{chord}]" for chord in inserts[index])
        output.append(char)
    if len(lyric_text) in inserts:
        output.extend(f"[{chord}]" for chord in inserts[len(lyric_text)])
    return "".join(output).rstrip()


def convert_lines(lines):
    output = []
    converted_pairs = 0
    index = 0
    while index < len(lines):
        current = lines[index]
        if not current["text"]:
            index += 1
            continue
        if is_chord_line(current) and index + 1 < len(lines) and not is_chord_line(lines[index + 1]):
            output.append(insert_chords(lines[index + 1], current))
            converted_pairs += 1
            index += 2
            continue
        if is_chord_line(current):
            chords = [clean_chord(word["text"]) for word in current["words"] if clean_chord(word["text"])]
            if chords:
                output.append("".join(f"[{chord}]" for chord in chords))
            index += 1
            continue
        output.append(current["text"])
        index += 1

    cleaned = []
    for line in output:
        if not line.strip():
            if cleaned and cleaned[-1] != "":
                cleaned.append("")
        else:
            cleaned.append(line.rstrip())
    while cleaned and cleaned[-1] == "":
        cleaned.pop()
    return "\n".join(cleaned), converted_pairs


def first_chord(lyrics):
    match = re.search(r"\[([^\]]+)\]", lyrics)
    return match.group(1) if match else ""


def key_from_chord(chord):
    chord = clean_chord(chord)
    match = re.match(r"^(do|re|mi|fa|sol|la|si)(#|b)?", chord, re.IGNORECASE)
    if not match:
        return "Do"
    return ROOT_TO_KEY[match.group(1).lower()] + (match.group(2) or "")


def convert(pdf_path, titles_path):
    entries = parse_title_index(titles_path)
    songs = []
    report_items = []
    with pdfplumber.open(pdf_path) as pdf:
        cached_lines = {}

        def lines_for_page(page_number):
            if page_number not in cached_lines:
                cached_lines[page_number] = page_lines(pdf.pages[page_number - 1])
            return cached_lines[page_number]

        title_positions = resolve_title_positions(entries, lines_for_page, len(pdf.pages))

        for index, entry in enumerate(entries):
            next_entry = entries[index + 1] if index + 1 < len(entries) else None
            position = title_positions[index]
            next_position = title_positions[index + 1] if next_entry else None
            page_start = position["page"]
            page_end = next_position["page"] if next_position else len(pdf.pages) + 1
            collected = []
            title_found = position["matched"]

            for page_number in range(page_start, page_end + 1):
                if page_number < 1 or page_number > len(pdf.pages):
                    continue
                lines = lines_for_page(page_number)
                start_y = 0
                end_y = pdf.pages[page_number - 1].height

                if page_number == page_start:
                    title_line = position["line"]
                    if not title_line:
                        title_line = find_title_line(lines, entry["title"])
                    if title_line:
                        start_y = title_line["bottom"] + 12

                if next_position and page_number == next_position["page"]:
                    next_title_line = next_position["line"] if next_position else None
                    if not next_title_line:
                        next_title_line = find_title_line(lines, next_entry["title"], min_top=start_y + 30)
                    if next_title_line:
                        end_y = next_title_line["top"] - 6
                    elif page_number != page_start:
                        end_y = 0

                if page_number > page_start and next_position and page_number == next_position["page"]:
                    pass

                for line in lines:
                    if start_y <= line["top"] <= end_y and line["text"].strip():
                        collected.append(line)

                if next_position and page_number == next_position["page"]:
                    break

            lyrics, converted_pairs = convert_lines(collected)
            key = key_from_chord(first_chord(lyrics))
            songs.append({
                "songbook": "mayor",
                "title": entry["title"],
                "artist": "",
                "key": key,
                "capo": 0,
                "versionName": f"Tono {key}",
                "lyrics": lyrics,
                "bpm": 96,
                "duration": "4:00",
                "level": "Inicial",
                "comments": f"Importado desde {Path(pdf_path).name}",
                "notes": f"Pagina original: {entry['page']}. Corte por indice PDF.",
                "reviewed": False,
            })
            report_items.append({
                "index": index,
                "title": entry["title"],
                "indexPage": entry["page"],
                "pdfPage": page_start,
                "titleFound": title_found,
                "lineCount": len([line for line in lyrics.splitlines() if line.strip()]),
                "convertedChordPairs": converted_pairs,
                "chordCount": len(re.findall(r"\[[^\]]+\]", lyrics)),
                "hasLyrics": bool(lyrics.strip()),
            })
    return {
        "format": "acordia-song-import",
        "version": 1,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "source": Path(pdf_path).name,
        "songs": songs,
    }, {"source": str(pdf_path), "titles": str(titles_path), "total": len(entries), "items": report_items}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--titles", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    payload, report = convert(args.pdf, args.titles)
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"songs={len(payload['songs'])}")
    print(f"empty={sum(not song['lyrics'].strip() for song in payload['songs'])}")
    print(f"without_chords={sum('[' not in song['lyrics'] for song in payload['songs'])}")
    print(args.output)
    print(args.report)


if __name__ == "__main__":
    main()
