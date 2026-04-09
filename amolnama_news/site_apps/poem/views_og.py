"""Poem OG image generator — renders Bengali text properly using Chrome headless."""

import io
import os
import subprocess
import tempfile

from django.http import HttpResponse, Http404
from django.views.decorators.cache import cache_control

from amolnama_news.site_apps.content.models import RefContentSubcategory
from .models import CollPoemEntry

# Chrome path
CHROME_PATH = None
for p in [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
]:
    if os.path.exists(p):
        CHROME_PATH = p
        break


def _build_html(title, author, body, category, poem_type):
    """Build HTML card for rendering."""
    accent = "#5b6abf" if poem_type == "poem" else "#7c3aed"
    type_label = "কবিতা" if poem_type == "poem" else "গানের কথা"
    meta = type_label
    if category:
        meta += "  ·  " + category

    # Truncate body to ~8 lines
    body_lines = body.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    preview_lines = []
    for line in body_lines:
        preview_lines.append(line.strip())
        if len(preview_lines) >= 8:
            preview_lines.append("...")
            break
    body_html = "<br>".join(_esc(l) for l in preview_lines)

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;700&family=Noto+Sans+Bengali:wght@400;600&display=swap');
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{
  width: 1200px; height: 630px; overflow: hidden;
  background: linear-gradient(135deg, #f5f0e6 0%, #ede6d6 100%);
  font-family: 'Noto Serif Bengali', 'Noto Sans Bengali', serif;
  position: relative;
}}
.accent {{ position: absolute; left: 0; top: 0; width: 8px; height: 100%; background: {accent}; }}
.meta {{
  position: absolute; top: 45px; left: 60px;
  font-family: 'Noto Sans Bengali', sans-serif;
  font-size: 20px; font-weight: 600; color: {accent};
  letter-spacing: .03em;
}}
.title {{
  position: absolute; top: 85px; left: 60px; right: 60px;
  font-size: 46px; font-weight: 700; color: #333;
  line-height: 1.3;
}}
.author {{
  position: absolute; top: 195px; left: 60px;
  font-family: 'Noto Sans Bengali', sans-serif;
  font-size: 26px; color: #888;
}}
.divider {{
  position: absolute; top: 240px; left: 60px;
  width: 120px; height: 2px; background: #cdc5b5;
}}
.body {{
  position: absolute; top: 260px; left: 60px; right: 60px; bottom: 65px;
  font-size: 28px; line-height: 1.6; color: #4a4540;
  overflow: hidden;
}}
.brand {{
  position: absolute; bottom: 0; left: 0; right: 0; height: 55px;
  background: #1e1e32; display: flex; align-items: center; padding: 0 60px;
  font-family: 'Noto Sans Bengali', sans-serif;
  font-size: 20px; color: #c8c8d4;
}}
</style>
</head>
<body>
  <div class="accent"></div>
  <div class="meta">{_esc(meta)}</div>
  <div class="title">{_esc(title)}</div>
  <div class="author">— {_esc(author)}</div>
  <div class="divider"></div>
  <div class="body">{body_html}</div>
  <div class="brand">আমলনামা নিউজ &nbsp;·&nbsp; amolnama.news &nbsp;·&nbsp; কবিতা ও গান</div>
</body>
</html>"""


def _esc(text):
    """HTML-escape text."""
    return (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


@cache_control(public=True, max_age=86400)
def poem_og_image(request, poem_slug):
    """Generate a dynamic OG share image for a poem using Chrome headless."""
    if poem_slug.isdigit():
        try:
            poem = CollPoemEntry.objects.get(blog_poem_coll_poem_entry_id=int(poem_slug))
        except CollPoemEntry.DoesNotExist:
            raise Http404
    else:
        try:
            poem = CollPoemEntry.objects.get(poem_slug=poem_slug)
        except CollPoemEntry.DoesNotExist:
            raise Http404
    return _render_og_image(poem)


@cache_control(public=True, max_age=86400)
def poem_og_image_by_id(request, poem_id):
    """Legacy ID-based OG image endpoint."""
    try:
        poem = CollPoemEntry.objects.get(blog_poem_coll_poem_entry_id=poem_id)
    except CollPoemEntry.DoesNotExist:
        raise Http404
    return _render_og_image(poem)


def _render_og_image(poem):
    """Shared OG image renderer."""

    cat_name = ""
    try:
        cat = RefContentSubcategory.objects.get(
            content_ref_content_subcategory_id=poem.link_content_ref_content_subcategory_id
        )
        cat_name = cat.subcategory_name_bn
    except RefContentSubcategory.DoesNotExist:
        pass

    title = poem.poem_title_bn or poem.poem_title_en or "শিরোনামহীন"
    author = poem.poem_author_display_name or ""
    body = poem.poem_body_bn or poem.poem_body_en or ""
    poem_type = getattr(poem, "poem_type_code", "poem")

    html = _build_html(title, author, body, cat_name, poem_type)

    # Write HTML to temp file
    with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w", encoding="utf-8") as f:
        f.write(html)
        html_path = f.name

    png_path = html_path.replace(".html", ".png")

    try:
        # Use Chrome headless to render HTML to PNG
        cmd = [
            CHROME_PATH,
            "--headless",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-software-rasterizer",
            "--window-size=1200,630",
            f"--screenshot={png_path}",
            f"file:///{html_path.replace(os.sep, '/')}",
        ]
        subprocess.run(cmd, timeout=15, capture_output=True)

        with open(png_path, "rb") as img_file:
            png_data = img_file.read()

        return HttpResponse(png_data, content_type="image/png")
    except Exception:
        # Fallback: return a simple 1x1 pixel
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (1200, 630), (245, 240, 230)).save(buf, "PNG")
        buf.seek(0)
        return HttpResponse(buf.getvalue(), content_type="image/png")
    finally:
        # Cleanup temp files
        try:
            os.unlink(html_path)
        except OSError:
            pass
        try:
            os.unlink(png_path)
        except OSError:
            pass
