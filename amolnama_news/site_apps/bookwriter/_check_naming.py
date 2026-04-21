"""bookwriter — naming-convention linter

Walks bookwriter's CSS / templates / JS and flags violations of the
project naming rules (CLAUDE.md Gate 4 + Gate 5 + Gate 8).

Exit code is the number of violations. Wire into a pre-commit hook:
    cd amolnama_news_project
    python amolnama_news/site_apps/bookwriter/_check_naming.py || exit 1

CHECKS
======
1. Every CSS class defined in bookwriter must carry the `bookwriter-`
   prefix. Anything plain (e.g. `.active`, `.row`, `.is-active`) is a
   violation — replace with a descriptive component-scoped form like
   `.bookwriter-chapter-row-is-active`.
2. JS class refs (querySelector / closest / matches / classList /
   className / innerHTML class= / *Class option keys) must reference
   classes that exist in the bookwriter CSS.
3. Templates: every <input>/<select>/<textarea>/<button> needs both
   id + name (hidden inputs exempt).
4. Inline `style=""` in templates may carry only data values
   (template variables or CSS custom-property hex injection). Static
   design rules (linear-gradient, calc, rgba, hardcoded background)
   must move to a CSS class.
"""
import pathlib
import re
import sys

BOOKWRITER_ROOT = pathlib.Path("amolnama_news/site_apps/bookwriter")
CSS_DIR = BOOKWRITER_ROOT / "static/bookwriter/assets/css"
JS_DIR = BOOKWRITER_ROOT / "static/bookwriter/assets/js"
TEMPLATE_DIR = BOOKWRITER_ROOT / "templates"

# Classes that intentionally are NOT bookwriter-prefixed because they
# are universal HTML/CSS conventions or come from other apps' shared
# stylesheets. Add to this set ONLY when you have a real reason.
ALLOWED_PLAIN_CLASSES = {
    "hidden",                    # html attribute equivalent
    # Bootstrap-ish utility names that should NEVER be used inside
    # bookwriter — listing them here would be a license to use them.
    # Keep this set tiny.
}


def collect_css_classes() -> set[str]:
    classes: set[str] = set()
    for path in sorted(CSS_DIR.rglob("*.css")):
        text = re.sub(r"/\*.*?\*/", "", path.read_text(encoding="utf-8"), flags=re.DOTALL)
        for match in re.finditer(r"\.([a-zA-Z_][a-zA-Z0-9_-]*)", text):
            classes.add(match.group(1))
    return classes


def check_css_naming(violations: list[str]) -> None:
    for path in sorted(CSS_DIR.rglob("*.css")):
        text = path.read_text(encoding="utf-8")
        no_comments = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
        # Strip url(...) contents — dots inside data URLs (e.g. www.w3.org)
        # are NOT class selectors. Replace each url(...) with a single
        # space so byte offsets stay roughly aligned for line counting.
        no_comments = re.sub(r"url\([^)]*\)", " ", no_comments)
        # Strip CSS string literals "..." and '...' (font-family names etc.)
        no_comments = re.sub(r'"[^"]*"', " ", no_comments)
        no_comments = re.sub(r"'[^']*'", " ", no_comments)
        seen_at_line: set[tuple[int, str]] = set()
        for match in re.finditer(r"\.([a-zA-Z_][a-zA-Z0-9_-]*)", no_comments):
            cls = match.group(1)
            if cls.startswith("bookwriter-"):
                continue
            if cls in ALLOWED_PLAIN_CLASSES:
                continue
            line = text.count("\n", 0, match.start()) + 1
            key = (line, cls)
            if key in seen_at_line:
                continue
            seen_at_line.add(key)
            violations.append(
                f"{path.as_posix()}:{line}  CSS class .{cls} is not prefixed — "
                f"rename to descriptive .bookwriter-<component>-... form"
            )


def check_js_class_refs(violations: list[str]) -> None:
    defined = collect_css_classes()
    for path in sorted(JS_DIR.rglob("*.js")):
        text = path.read_text(encoding="utf-8")

        def report(line_offset: int, message: str) -> None:
            line = text.count("\n", 0, line_offset) + 1
            violations.append(f"{path.as_posix()}:{line}  {message}")

        for match in re.finditer(
            r"classList\.(?:add|remove|contains|toggle|replace)"
            r"\s*\(\s*['\"]([a-zA-Z_][a-zA-Z0-9_-]*)['\"]",
            text,
        ):
            name = match.group(1)
            # Strings ending in `-` are JS prefix concatenations
            # (e.g. `classList.add('mode-' + variant)`), not actual class
            # names. The runtime value is computed and can't be linted.
            if name.endswith("-"):
                continue
            if name in defined or name in ALLOWED_PLAIN_CLASSES:
                continue
            report(match.start(), f"classList ref to '{name}' — not in CSS")

        for match in re.finditer(
            r"\.className\s*\+?=\s*['\"]([^'\"]+)['\"]",
            text,
        ):
            for token in match.group(1).split():
                if token in defined or token in ALLOWED_PLAIN_CLASSES:
                    continue
                report(match.start(), f"className token '{token}' — not in CSS")

        for match in re.finditer(
            r"(?:querySelector(?:All)?|closest|matches)"
            r"\s*\(\s*['\"]([^'\"]+)['\"]",
            text,
        ):
            selector = match.group(1)
            for class_match in re.finditer(r"\.([a-zA-Z_][a-zA-Z0-9_-]*)", selector):
                name = class_match.group(1)
                if name in defined or name in ALLOWED_PLAIN_CLASSES:
                    continue
                report(match.start(), f"selector '.{name}' (in '{selector}') — not in CSS")

        # Object-literal options whose KEY ends in `Class`.
        for match in re.finditer(
            r"([a-zA-Z_][a-zA-Z0-9_]*Class\s*:\s*)['\"]([a-zA-Z_][a-zA-Z0-9_-]*)['\"]",
            text,
        ):
            name = match.group(2)
            if name in defined or name in ALLOWED_PLAIN_CLASSES:
                continue
            report(match.start(), f"option-key class '{name}' — not in CSS")

        # innerHTML class="..." attribute tokens.
        for match in re.finditer(r'class=(?:"([^"]*)"|\'([^\']*)\')', text):
            inner = match.group(1) if match.group(1) is not None else match.group(2)
            for token in inner.split():
                if token in defined or token in ALLOWED_PLAIN_CLASSES:
                    continue
                report(match.start(), f"innerHTML class token '{token}' — not in CSS")


def check_templates(violations: list[str]) -> None:
    defined = collect_css_classes()
    for path in sorted(TEMPLATE_DIR.rglob("*.html")):
        text = path.read_text(encoding="utf-8")

        # Form elements need id + name (hidden inputs exempt).
        for match in re.finditer(
            r"<(input|select|textarea|button)\b([^>]*)>", text, flags=re.IGNORECASE
        ):
            tag = match.group(1).lower()
            attrs = match.group(2)
            if tag == "input" and re.search(r'\btype\s*=\s*["\']hidden["\']', attrs, re.I):
                continue
            has_id = re.search(r"\bid\s*=", attrs, re.I) is not None
            has_name = re.search(r"\bname\s*=", attrs, re.I) is not None
            if not (has_id and has_name):
                line = text.count("\n", 0, match.start()) + 1
                violations.append(
                    f"{path.as_posix()}:{line}  <{tag}> missing id or name attribute"
                )

        # class= attribute tokens must be prefixed (or allowed-plain).
        # The two alternatives in the regex handle the case where the
        # attribute value contains the OPPOSITE quote (e.g. <div class="x{% if y == 'foo' %}…">).
        for match in re.finditer(r'class=(?:"([^"]*)"|\'([^\']*)\')', text):
            inner = match.group(1) if match.group(1) is not None else match.group(2)
            cleaned = re.sub(r"\{\{[^{}]*\}\}|\{%[^%]*%\}", "", inner)
            for token in cleaned.split():
                token = token.strip()
                if not token:
                    continue
                if token.startswith("bookwriter-") or token in ALLOWED_PLAIN_CLASSES:
                    continue
                line = text.count("\n", 0, match.start()) + 1
                violations.append(
                    f"{path.as_posix()}:{line}  template class '{token}' — not prefixed"
                )

        # Inline style attrs must be data-only.
        for match in re.finditer(r'style=(["\'])([^"\']*)\1', text):
            value = match.group(2)
            if "{{" in value or "{%" in value:
                continue
            if re.search(
                r"linear-gradient\(|radial-gradient\(|calc\(|rgba?\(|hsla?\(",
                value,
            ):
                line = text.count("\n", 0, match.start()) + 1
                violations.append(
                    f"{path.as_posix()}:{line}  inline style with design rule — "
                    f"extract to CSS class: style=\"{value[:80]}\""
                )


def main() -> int:
    if not BOOKWRITER_ROOT.exists():
        print(f"ERROR: not in project root — run from the directory containing {BOOKWRITER_ROOT}")
        return 1
    violations: list[str] = []
    check_css_naming(violations)
    check_js_class_refs(violations)
    check_templates(violations)
    if violations:
        print(f"NAMING VIOLATIONS: {len(violations)}")
        for line in violations:
            print(f"  {line}")
        return 1
    print("OK — 0 naming violations.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
