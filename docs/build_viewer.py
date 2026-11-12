"""Builds docs/architecture.html from the Mermaid blocks in ONBOARDING.md."""
import html
import io
import pathlib
import re

here = pathlib.Path(__file__).parent
md = io.open(here / "ONBOARDING.md", encoding="utf-8").read()
blocks = re.findall(r"```mermaid\n(.*?)```", md, re.S)
titles = [
    "System architecture",
    "Settlement flow (Payment Guardian)",
    "Dispute flow (AI triage)",
    "Data model",
    "Security model",
]
sections = "".join(
    f'<section><h2>{t}</h2><pre class="mermaid">{html.escape(b)}</pre>'
    f'<button onclick="dl(this)">Download SVG</button></section>'
    for t, b in zip(titles, blocks)
)
page = """<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SettlAgent Architecture</title>
<style>
body{font-family:system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:24px;background:#f6f8f9;color:#0b2b3b}
section{background:#fff;border:1px solid #dde4e7;border-radius:14px;padding:20px;margin:20px 0;overflow:auto}
button{margin-top:8px;padding:6px 12px;border-radius:8px;border:1px solid #1E7A5F;background:#fff;color:#1E7A5F;cursor:pointer}
</style></head><body>
<h1>SettlAgent — Architecture &amp; Flow Diagrams</h1>
<p>Full guide: ONBOARDING.md. Use the buttons to save each diagram as an image (SVG).</p>
""" + sections + """
<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs";
mermaid.initialize({startOnLoad:true, theme:"neutral"});
window.dl = (b) => {
  const s = b.parentElement.querySelector("svg");
  const u = URL.createObjectURL(new Blob([s.outerHTML], {type:"image/svg+xml"}));
  const a = document.createElement("a"); a.href = u; a.download = "settlagent-diagram.svg"; a.click();
};
</script></body></html>"""
io.open(here / "architecture.html", "w", encoding="utf-8").write(page)
print(len(blocks), "diagrams")
