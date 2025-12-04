import os, re, json
from pathlib import Path

GENRE_PILL_MAP = {
    "Adventure & Survival": "Adventure",
    "Classics & Canon": "Classics",
    "Fantasy Worlds": "Fantasy",
    "Historical & War": "Historical",
    "Horror & Supernatural": "Horror",
    "Humour & Feel-Good": "Humour",
    "Mystery, Crime & Thrillers": "Mystery",
    "Non-Fiction, Biography & Memoir": "Non-Fiction",
    "Poetry, Verse & Short Stories": "Poetry",
    "Reference, Study & Dictionaries": "Reference",
    "Romance & Relationships": "Romance",
    "School, Family & Growing Up": "School",
    "Sci-Fi & Dystopia": "Sci-Fi",
    "Social Issues & Justice": "Social",
    "Sport": "Sport",
}

def parse_genre_file(path):
    text = Path(path).read_text(encoding="utf-8")
    parts = text.split("class='book-card'")
    books = []
    for part in parts[1:]:
        chunk = "class='book-card'" + part

        img_match = re.search(r"src=['\"]([^'\"]+)['\"]", chunk)
        img = img_match.group(1) if img_match else None

        title_match = re.search(r"<h3>(.*?)</h3>", chunk)
        title = re.sub(r"\s+", " ", title_match.group(1)).strip() if title_match else None

        author_match = re.search(r"<p><strong>Author:</strong>\s*(.*?)</p>", chunk)
        author = re.sub(r"\s+", " ", author_match.group(1)).strip() if author_match else None

        genre_match = re.search(r"<p><strong>Genre:</strong>\s*(.*?)</p>", chunk)
        genre_raw = genre_match.group(1).strip() if genre_match else ""
        genres = [g.strip() for g in re.split(r"\s*\|\s*", genre_raw) if g.strip()]

        level_match = re.search(r"<p><strong>Reading Level:</strong>\s*(.*?)</p>", chunk)
        level = level_match.group(1).strip() if level_match else None

        desc = None
        for m in re.finditer(r"<p>(.*?)</p>", chunk):
            content = m.group(1).strip()
            if not content.startswith("<strong>"):
                desc_text = re.sub(r"<.*?>", "", content)
                desc = re.sub(r"\s+", " ", desc_text).strip()
                break

        books.append({
            "title": title,
            "author": author,
            "description": desc,
            "genres": genres,
            "reading_level": level,
            "image": img
        })
    return books

genre_files = [f for f in os.listdir(".") if f.startswith("genre_") and f.endswith(".html")]

all_books = {}
for fname in genre_files:
    for b in parse_genre_file(fname):
        key = (b["title"], b["author"])
        if key not in all_books:
            all_books[key] = b
        else:
            gset = set(all_books[key]["genres"])
            gset.update(b["genres"])
            all_books[key]["genres"] = sorted(gset)

output = []
for i, ((title, author), b) in enumerate(sorted(all_books.items()), start=1):
    genre_pills = sorted({GENRE_PILL_MAP[g] for g in b["genres"] if g in GENRE_PILL_MAP})
    output.append({
        "id": f"sd-{i:03d}",
        "title": b["title"],
        "author": b["author"],
        "description": b["description"],
        "genres": b["genres"],
        "genre_pills": genre_pills,
        "reading_level": b["reading_level"],
        "image": b["image"],
        "division": "SD-English",
        "language": "English"
    })

with open("books.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"Wrote {len(output)} books to books.json")
