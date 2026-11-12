"""Builds SettlAgent_Onboarding_Guide.docx from ONBOARDING.md, swapping each
Mermaid block for its rendered PNG in docs/img (see architecture.html)."""
import pathlib
import re

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

here = pathlib.Path(__file__).parent
lines = (here / "ONBOARDING.md").read_text(encoding="utf-8").splitlines()

IMAGES = [
    ("01-architecture.png", 6.5, "Figure 1 — System architecture (layers)"),
    ("02-settlement-flow.png", 3.6, "Figure 2 — Settlement flow with the Payment Guardian"),
    ("03-dispute-flow.png", 6.5, "Figure 3 — Dispute flow (where the AI works)"),
    ("04-data-model.png", 5.5, "Figure 4 — Data model"),
    ("05-security.png", 6.5, "Figure 5 — Security model"),
]
img_iter = iter(IMAGES)

doc = Document()
sec = doc.sections[0]
sec.left_margin = sec.right_margin = Inches(0.9)
sec.top_margin = sec.bottom_margin = Inches(0.9)
normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(10.5)
GREEN = RGBColor(0x1E, 0x7A, 0x5F)
for name, size in (("Heading 1", 18), ("Heading 2", 14), ("Heading 3", 12)):
    st = doc.styles[name]
    st.font.name = "Calibri"
    st.font.size = Pt(size)
    st.font.color.rgb = GREEN


def add_runs(par, text):
    for part in re.split(r"(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)", text):
        if not part:
            continue
        if part.startswith("**"):
            par.add_run(part[2:-2]).bold = True
        elif part.startswith("`"):
            run = par.add_run(part[1:-1])
            run.font.name = "Consolas"
            run.font.size = Pt(9.5)
        elif part.startswith("*") and len(part) > 2:
            par.add_run(part[1:-1]).italic = True
        else:
            par.add_run(part)


def shade(cell, color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color)
    tcPr.append(shd)


def add_table(rows):
    header = [c.strip() for c in rows[0].strip("|").split("|")]
    body = [[c.strip() for c in r.strip("|").split("|")] for r in rows[2:]]
    table = doc.add_table(rows=1, cols=len(header))
    table.style = "Table Grid"
    for i, h in enumerate(header):
        cell = table.rows[0].cells[i]
        cell.text = ""
        add_runs(cell.paragraphs[0], f"**{h}**")
        shade(cell, "DDEFE8")
    for r in body:
        cells = table.add_row().cells
        for i, v in enumerate(r[: len(header)]):
            cells[i].text = ""
            add_runs(cells[i].paragraphs[0], v)
    for row in table.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.size = Pt(9.5)
    doc.add_paragraph()


title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.LEFT
run = title.add_run("SettlAgent")
run.bold = True
run.font.size = Pt(28)
run.font.color.rgb = GREEN
sub = doc.add_paragraph()
sub.add_run("Architecture & Onboarding Guide").font.size = Pt(16)
doc.add_paragraph("Autonomous settlement and dispute-triage agent for PayPal marketplaces")
doc.add_page_break()

i = 0
in_code = False
in_mermaid = False
while i < len(lines):
    line = lines[i]
    if line.startswith("```"):
        if line.startswith("```mermaid"):
            in_mermaid = True
            fname, width, caption = next(img_iter)
            doc.add_picture(str(here / "img" / fname), width=Inches(width))
            doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
            cap = doc.add_paragraph()
            cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = cap.add_run(caption)
            r.italic = True
            r.font.size = Pt(9)
        elif in_mermaid:
            in_mermaid = False
        elif in_code:
            in_code = False
        else:
            in_code = True
        i += 1
        continue
    if in_mermaid:
        i += 1
        continue
    if in_code:
        p = doc.add_paragraph()
        r = p.add_run(line)
        r.font.name = "Consolas"
        r.font.size = Pt(9.5)
        i += 1
        continue
    if line.startswith("|"):
        block = []
        while i < len(lines) and lines[i].startswith("|"):
            block.append(lines[i])
            i += 1
        add_table(block)
        continue
    if line.strip() in ("---", ""):
        i += 1
        continue
    if line.startswith("# "):
        i += 1
        continue
    if line.startswith("## "):
        doc.add_heading(line[3:].replace("`", ""), level=1)
    elif line.startswith("### "):
        doc.add_heading(line[4:], level=2)
    elif line.startswith("> "):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.3)
        add_runs(p, line[2:])
    elif re.match(r"^\d+\. ", line):
        add_runs(doc.add_paragraph(style="List Number"), re.sub(r"^\d+\. ", "", line))
    elif line.startswith("- "):
        add_runs(doc.add_paragraph(style="List Bullet"), line[2:])
    else:
        add_runs(doc.add_paragraph(), line)
    i += 1

out = here / "SettlAgent_Onboarding_Guide.docx"
doc.save(out)
print("saved", out)
