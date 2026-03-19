"""Template tags for SEO — JSON-LD schema, meta tags, breadcrumbs."""

import json
from django import template
from django.utils.safestring import mark_safe

register = template.Library()


@register.simple_tag(takes_context=True)
def seo_meta_tags(context):
    """Render all SEO meta tags (OG, Twitter, canonical, description, robots).

    Uses 'seo' dict from view context, falling back to 'seo_defaults' from
    the context processor.
    """
    defaults = context.get("seo_defaults", {})
    seo = context.get("seo", {})

    # Merge: view-level seo overrides defaults
    title = seo.get("title") or context.get("page_title", defaults.get("site_name", "Amolnama News"))
    description = seo.get("description", defaults.get("description", ""))
    og_image = seo.get("og_image", defaults.get("og_image", ""))
    og_type = seo.get("og_type", defaults.get("og_type", "website"))
    canonical = seo.get("canonical", defaults.get("canonical", ""))
    noindex = seo.get("noindex", defaults.get("noindex", False))
    site_name = defaults.get("site_name", "Amolnama News")
    locale = defaults.get("locale", "bn_BD")
    locale_alt = defaults.get("locale_alternate", "en_US")

    tags = []

    # Description
    tags.append(f'<meta name="description" content="{_esc(description)}"/>')

    # Canonical
    if canonical:
        tags.append(f'<link rel="canonical" href="{_esc(canonical)}"/>')

    # Robots
    if noindex:
        tags.append('<meta name="robots" content="noindex, nofollow"/>')

    # Open Graph
    tags.append(f'<meta property="og:title" content="{_esc(title)}"/>')
    tags.append(f'<meta property="og:description" content="{_esc(description)}"/>')
    tags.append(f'<meta property="og:type" content="{_esc(og_type)}"/>')
    tags.append(f'<meta property="og:site_name" content="{_esc(site_name)}"/>')
    tags.append(f'<meta property="og:locale" content="{_esc(locale)}"/>')
    tags.append(f'<meta property="og:locale:alternate" content="{_esc(locale_alt)}"/>')
    if canonical:
        tags.append(f'<meta property="og:url" content="{_esc(canonical)}"/>')
    if og_image:
        tags.append(f'<meta property="og:image" content="{_esc(og_image)}"/>')
        tags.append('<meta property="og:image:width" content="1200"/>')
        tags.append('<meta property="og:image:height" content="630"/>')

    # Twitter Card
    tags.append('<meta name="twitter:card" content="summary_large_image"/>')
    tags.append(f'<meta name="twitter:title" content="{_esc(title)}"/>')
    tags.append(f'<meta name="twitter:description" content="{_esc(description)}"/>')
    if og_image:
        tags.append(f'<meta name="twitter:image" content="{_esc(og_image)}"/>')

    return mark_safe("\n  ".join(tags))


@register.simple_tag(takes_context=True)
def seo_json_ld(context):
    """Render JSON-LD <script> blocks for structured data.

    Always outputs Organization schema. If 'seo.json_ld' is set in context,
    outputs that too (Article, BreadcrumbList, etc.).
    """
    request = context.get("request")
    defaults = context.get("seo_defaults", {})
    seo = context.get("seo", {})
    host = request.build_absolute_uri("/") if request else "https://amolnama.news/"

    schemas = []

    # Organization schema (always present)
    org = {
        "@context": "https://schema.org",
        "@type": "NewsMediaOrganization",
        "name": "Amolnama News",
        "alternateName": "আমলনামা নিউজ",
        "url": host,
        "logo": {
            "@type": "ImageObject",
            "url": request.build_absolute_uri("/static/core/assets/img/logo.png") if request else "",
        },
        "sameAs": [],
        "description": defaults.get("description", ""),
    }
    schemas.append(org)

    # WebSite schema with SearchAction (enables Google sitelinks search box)
    website = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Amolnama News",
        "alternateName": "আমলনামা নিউজ",
        "url": host,
    }
    schemas.append(website)

    # Breadcrumbs from view context
    breadcrumbs = seo.get("breadcrumbs")
    if breadcrumbs:
        bc_schema = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [],
        }
        for i, crumb in enumerate(breadcrumbs, 1):
            bc_schema["itemListElement"].append({
                "@type": "ListItem",
                "position": i,
                "name": crumb["name"],
                "item": request.build_absolute_uri(crumb["url"]) if request else crumb["url"],
            })
        schemas.append(bc_schema)

    # Custom JSON-LD from view (Article, FAQPage, etc.)
    custom_ld = seo.get("json_ld")
    if custom_ld:
        if isinstance(custom_ld, list):
            schemas.extend(custom_ld)
        else:
            schemas.append(custom_ld)

    # Render
    parts = []
    for schema in schemas:
        parts.append(
            '<script type="application/ld+json">'
            + json.dumps(schema, ensure_ascii=False)
            + "</script>"
        )
    return mark_safe("\n  ".join(parts))


def _esc(text):
    """Escape HTML attribute value."""
    if not text:
        return ""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
