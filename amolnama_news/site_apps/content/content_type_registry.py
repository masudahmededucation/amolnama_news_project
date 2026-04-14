"""Universal content type registry — single source of truth for every blog content type.

Purpose
-------
Shared code (promo cards, bookmarks, search results, related content, universal
feed, portal dashboards, sitemap builders) resolves title/slug/URL/counts/
is_published for any content type through this ONE registry instead of
per-type if/elif ladders.

Adding a new blog content type = ONE entry in CONTENT_TYPE_REGISTRY below.
No other code needs to change — every shared consumer picks up the new type
automatically on the next import.

Why a Python dict, not a DB table
---------------------------------
The registry holds Python references (model classes, field names, URL builder
callables). SQL Server can't represent callables, and adding a new content
type needs a code change anyway (you need a Django model class to point at).
So the registry is configuration code, not data — same category as urls.py
and settings.py.

Cross-referenced in the DB
--------------------------
notes/sql-script/phase3b-content-type-extended-properties.sql emits SQL
Server extended properties on every registered column. SSMS then shows the
role ("title_bn for art", "pk_field for poem", etc.) when you hover a column.
Inspect from the DB side with:

    SELECT OBJECT_SCHEMA_NAME(ep.major_id) AS schema_name,
           OBJECT_NAME(ep.major_id)        AS table_name,
           c.name                           AS column_name,
           CAST(ep.value AS NVARCHAR(500)) AS registry_role
    FROM sys.extended_properties ep
    JOIN sys.columns c
         ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE ep.name = N'registry_role'
    ORDER BY schema_name, table_name, column_name;

The SQL script is re-runnable — it DROPs then ADDs each property, so code
changes get mirrored into the DB on the next run.

Design notes
------------
- Entries use plain dicts, not a dataclass, to match the existing
  CONTENT_TYPE_METADATA style in content/bookmarks.py and to keep the file
  readable by everyone on the team regardless of Python familiarity.
- Per-type overrides (e.g. story's secondary age_group subcategory, poem's
  @property is_published, destination without summary) are marked with
  None. Helpers tolerate None — no field lookup errors.
- Model classes are referenced by module + class name as strings. They are
  imported lazily via importlib inside get_model_class() to avoid circular
  imports (content app imports from blog apps that import from content app).
- newshub/PubArticle is NOT in this registry. It has a split model
  (PubArticle <-> CollNewsEntry) with different fields and a different
  pipeline. If unified later, it gets its own entry then.
"""

import importlib
import logging

logger = logging.getLogger(__name__)


CONTENT_TYPE_REGISTRY = {
    'art': {
        'code':                  'art',
        'label_bn':              'শিল্পকলা',
        'badge':                 'ART',
        'color':                 'blue',
        'cta':                   'দেখুন',
        'model_module':          'amolnama_news.site_apps.art.models',
        'model_name':            'CollArtwork',
        'table_schema':          'blog_art',
        'table_name':            'coll_artwork',
        'pk_field':              'blog_art_coll_artwork_id',
        'title_bn_field':        'artwork_title_bn',
        'title_en_field':        'artwork_title_en',
        'slug_field':            'artwork_slug',
        'summary_bn_field':      'artwork_summary_bn',
        'summary_en_field':      'artwork_summary_en',
        'is_published_field':    'is_published',
        'is_active_field':       'is_active',
        'is_featured_field':     'is_featured',
        'status_code_field':     None,
        'bookmark_count_field':  'bookmark_count',
        'like_count_field':      'like_count',
        'view_count_field':      'view_count',
        'comment_count_field':   'comment_count',
        'detail_url_prefix':     '/art-and-craft/',
        'category_group_code':   'blog_art_category',
        'secondary_group_code':  None,
    },
    'story': {
        'code':                  'story',
        'label_bn':              'গল্প',
        'badge':                 'STORY',
        'color':                 'amber',
        'cta':                   'পড়ুন',
        'model_module':          'amolnama_news.site_apps.stories.models',
        'model_name':            'CollStory',
        'table_schema':          'blog_stories',
        'table_name':            'coll_story',
        'pk_field':              'blog_stories_coll_story_id',
        'title_bn_field':        'story_title_bn',
        'title_en_field':        'story_title_en',
        'slug_field':            'story_slug',
        'summary_bn_field':      'story_summary_bn',
        'summary_en_field':      None,
        'is_published_field':    'is_published',
        'is_active_field':       'is_active',
        'is_featured_field':     'is_featured',
        'status_code_field':     None,
        'bookmark_count_field':  'bookmark_count',
        'like_count_field':      'like_count',
        'view_count_field':      'view_count',
        'comment_count_field':   'comment_count',
        'detail_url_prefix':     '/stories-for-kids/',
        'category_group_code':   'blog_stories_category',
        'secondary_group_code':  'blog_stories_age_group',
    },
    'poem': {
        'code':                  'poem',
        'label_bn':              'কবিতা',
        'badge':                 'POEM',
        'color':                 'purple',
        'cta':                   'পড়ুন',
        'model_module':          'amolnama_news.site_apps.poem.models',
        'model_name':            'CollPoemEntry',
        'table_schema':          'blog_poem',
        'table_name':            'coll_poem_entry',
        'pk_field':              'blog_poem_coll_poem_entry_id',
        'title_bn_field':        'poem_title_bn',
        'title_en_field':        'poem_title_en',
        'slug_field':            'poem_slug',
        'summary_bn_field':      'poem_summary_bn',
        'summary_en_field':      'poem_summary_en',
        'is_published_field':    'is_published',   # @property, reads poem_status_code
        'is_active_field':       'is_active',
        'is_featured_field':     'is_featured',
        'status_code_field':     'poem_status_code',
        'bookmark_count_field':  'bookmark_count',
        'like_count_field':      'like_count',
        'view_count_field':      'view_count',
        'comment_count_field':   'comment_count',
        'detail_url_prefix':     '/bangla-kobita-gaan/',
        'category_group_code':   'blog_poem_category',
        'secondary_group_code':  None,
    },
    'destination': {
        'code':                  'destination',
        'label_bn':              'ভ্রমণ',
        'badge':                 'TRAVEL',
        'color':                 'green',
        'cta':                   'ঘুরে আসুন',
        'model_module':          'amolnama_news.site_apps.bangladesh.models',
        'model_name':            'CollDestination',
        'table_schema':          'blog_bangladesh',
        'table_name':            'coll_destination',
        'pk_field':              'blog_bangladesh_coll_destination_id',
        'title_bn_field':        'destination_name_bn',
        'title_en_field':        'destination_name_en',
        'slug_field':            'destination_slug',
        'summary_bn_field':      'destination_short_description_bn',
        'summary_en_field':      'destination_short_description_en',
        'is_published_field':    'is_published',   # @property, reads destination_status
        'is_active_field':       'is_active',
        'is_featured_field':     'is_featured',
        'status_code_field':     'destination_status',
        'bookmark_count_field':  'bookmark_count',
        'like_count_field':      'like_count',
        'view_count_field':      'view_count',
        'comment_count_field':   'comment_count',
        'detail_url_prefix':     '/bangladesh-tourist-destinations/travel/',
        'category_group_code':   'blog_bangladesh_destination_category',
        'secondary_group_code':  'blog_bangladesh_season',
    },
    'media': {
        'code':                  'media',
        'label_bn':              'মিডিয়া',
        'badge':                 'MEDIA',
        'color':                 'green',
        'cta':                   'দেখুন',
        'model_module':          'amolnama_news.site_apps.bangladesh.models',
        'model_name':            'CollMediaEntry',
        'table_schema':          'blog_bangladesh',
        'table_name':            'coll_media_entry',
        'pk_field':              'blog_bangladesh_coll_media_entry_id',
        'title_bn_field':        'media_title_bn',
        'title_en_field':        'media_title_en',
        'slug_field':            'media_slug',
        'summary_bn_field':      None,
        'summary_en_field':      None,
        'is_published_field':    'is_published',   # @property, reads media_status
        'is_active_field':       'is_active',
        'is_featured_field':     'is_featured',
        'status_code_field':     'media_status',
        'bookmark_count_field':  'bookmark_count',
        'like_count_field':      'like_count',
        'view_count_field':      'view_count',
        'comment_count_field':   'comment_count',
        'detail_url_prefix':     '/bangladesh-tourist-destinations/beauty/',
        'category_group_code':   'blog_bangladesh_media_category',
        'secondary_group_code':  'blog_bangladesh_season',
    },
    'debate': {
        'code':                  'debate',
        'label_bn':              'বিতর্ক',
        'badge':                 'DEBATE',
        'color':                 'amber',
        'cta':                   'দেখুন',
        'model_module':          'amolnama_news.site_apps.debate.models',
        'model_name':            'CollTopic',
        'table_schema':          'blog_debate',
        'table_name':            'coll_topic',
        'pk_field':              'blog_debate_coll_topic_id',
        'title_bn_field':        'topic_title',
        'title_en_field':        None,
        'slug_field':            'topic_slug',
        'summary_bn_field':      'topic_description',
        'summary_en_field':      None,
        'is_published_field':    None,              # debate lifecycle is richer than a boolean
        'is_active_field':       'is_active',
        'is_featured_field':     None,
        'status_code_field':     None,              # link_blog_debate_ref_topic_status_id
        'bookmark_count_field':  'bookmark_count',
        'like_count_field':      'like_count',
        'view_count_field':      'view_count',
        'comment_count_field':   'comment_count',
        'detail_url_prefix':     '/debate/topic/',
        'category_group_code':   'blog_debate_category',
        'secondary_group_code':  None,
    },

    'campus_life': {
        'code':                  'campus_life',
        'label_bn':              'ক্যাম্পাস',
        'badge':                 'CAMPUS',
        'color':                 'blue',
        'cta':                   'জানুন',
        'model_module':          'amolnama_news.site_apps.studentlife.models',
        'model_name':            'CollCampusEntry',
        'table_schema':          'blog_studentlife',
        'table_name':            'coll_campus_entry',
        'pk_field':              'blog_studentlife_coll_campus_entry_id',
        'title_bn_field':        'campus_entry_title_bn',
        'title_en_field':        'campus_entry_title_en',
        'slug_field':            'campus_entry_slug',
        'summary_bn_field':      'campus_entry_short_description_bn',
        'summary_en_field':      'campus_entry_short_description_en',
        'is_published_field':    'is_published',
        'is_active_field':       'is_active',
        'is_featured_field':     'is_featured',
        'status_code_field':     'campus_entry_status_code',
        'bookmark_count_field':  'bookmark_count',
        'like_count_field':      'like_count',
        'view_count_field':      'view_count',
        'comment_count_field':   'comment_count',
        'detail_url_prefix':     '/campus-life/',
        'category_group_code':   'blog_studentlife_category',
        'secondary_group_code':  None,
    },

    'probash_barta': {
        'code':                  'probash_barta',
        'label_bn':              'প্রবাস',
        'badge':                 'PROBASH',
        'color':                 'teal',
        'cta':                   'পড়ুন',
        'model_module':          'amolnama_news.site_apps.probashbarta.models',
        'model_name':            'CollProbashEntry',
        'table_schema':          'blog_probashbarta',
        'table_name':            'coll_probash_entry',
        'pk_field':              'blog_probashbarta_coll_probash_entry_id',
        'title_bn_field':        'probash_entry_title_bn',
        'title_en_field':        'probash_entry_title_en',
        'slug_field':            'probash_entry_slug',
        'summary_bn_field':      'probash_entry_short_description_bn',
        'summary_en_field':      'probash_entry_short_description_en',
        'is_published_field':    'is_published',
        'is_active_field':       'is_active',
        'is_featured_field':     'is_featured',
        'status_code_field':     'probash_entry_status_code',
        'bookmark_count_field':  'bookmark_count',
        'like_count_field':      'like_count',
        'view_count_field':      'view_count',
        'comment_count_field':   'comment_count',
        'detail_url_prefix':     '/probash-barta/',
        'category_group_code':   'blog_probashbarta_topic',
        'secondary_group_code':  'blog_probashbarta_region',
    },
}


# =========================================================
# Reverse lookup — resolve a content type from a model instance
# =========================================================
_MODEL_NAME_TO_CODE = {
    spec['model_name']: code
    for code, spec in CONTENT_TYPE_REGISTRY.items()
}


def get_spec(content_type_code):
    """Return the registry spec dict for a content_type_code, or None."""
    return CONTENT_TYPE_REGISTRY.get(content_type_code)


def iter_all_specs():
    """Iterator over every (content_type_code, spec) pair — for loops that
    touch every content type (e.g. portal content dashboard, sitemap)."""
    return CONTENT_TYPE_REGISTRY.items()


def get_code_for_instance(instance):
    """Resolve a registered content_type_code from a model instance.
    Returns None if the instance is not registered."""
    return _MODEL_NAME_TO_CODE.get(type(instance).__name__)


def get_model_class(content_type_code):
    """Lazy-import and return the Django model class for a content_type_code.
    Returns None if the content type isn't registered."""
    spec = get_spec(content_type_code)
    if not spec:
        return None
    try:
        module = importlib.import_module(spec['model_module'])
        return getattr(module, spec['model_name'])
    except (ImportError, AttributeError) as registry_import_error:
        logger.error(
            'get_model_class failed for %s — %s',
            content_type_code, registry_import_error,
        )
        return None


# =========================================================
# Field readers — work on any registered model instance
# =========================================================

def _get_field(instance, spec_key):
    """Look up spec[spec_key] and return getattr(instance, <that field>) or None.
    Returns None if the spec key is not set or the field does not exist on
    the instance — never raises."""
    if instance is None:
        return None
    code = get_code_for_instance(instance)
    if not code:
        return None
    spec = CONTENT_TYPE_REGISTRY[code]
    field = spec.get(spec_key)
    if not field:
        return None
    return getattr(instance, field, None)


def get_title(instance, lang='bn'):
    """Return the title for a registered model instance. Falls back from the
    requested language to the other if empty."""
    primary_key = 'title_bn_field' if lang == 'bn' else 'title_en_field'
    fallback_key = 'title_en_field' if lang == 'bn' else 'title_bn_field'
    return (_get_field(instance, primary_key) or _get_field(instance, fallback_key) or '')


def get_summary(instance, lang='bn'):
    """Return the summary for a registered model instance, with fallback."""
    primary_key = 'summary_bn_field' if lang == 'bn' else 'summary_en_field'
    fallback_key = 'summary_en_field' if lang == 'bn' else 'summary_bn_field'
    return (_get_field(instance, primary_key) or _get_field(instance, fallback_key) or '')


def get_slug(instance):
    """Return the slug for a registered model instance, or empty string."""
    return _get_field(instance, 'slug_field') or ''


def get_pk(instance):
    """Return the primary key value for a registered model instance."""
    return _get_field(instance, 'pk_field')


def get_detail_url(instance):
    """Return the canonical detail URL for a registered model instance.

    Slug-based content types: /prefix/<slug>/
    Slugless content types (debate): fall back to /prefix/<pk>/
    Returns empty string if neither is available.
    """
    code = get_code_for_instance(instance)
    if not code:
        return ''
    spec = CONTENT_TYPE_REGISTRY[code]
    prefix = spec['detail_url_prefix']
    slug = get_slug(instance)
    if slug:
        return f'{prefix}{slug}/'
    pk = get_pk(instance)
    if pk:
        return f'{prefix}{pk}/'
    return ''


def get_is_published(instance):
    """Return True if the instance is published, False otherwise.

    For types where is_published is a @property on the model (poem, destination,
    media), this reads the property which in turn reads status_code. For types
    where is_published is a real boolean column (art, stories), this reads the
    column directly. Both paths yield the same answer through one helper.
    """
    value = _get_field(instance, 'is_published_field')
    return bool(value) if value is not None else False


def get_counts(instance):
    """Return {bookmark, like, view, comment} counts for a registered instance."""
    return {
        'bookmark': _get_field(instance, 'bookmark_count_field') or 0,
        'like':     _get_field(instance, 'like_count_field') or 0,
        'view':     _get_field(instance, 'view_count_field') or 0,
        'comment':  _get_field(instance, 'comment_count_field') or 0,
    }


def get_presentation(content_type_code):
    """Return {badge, color, cta, label_bn} for a content_type_code.
    Used by promo cards, bookmarks list, feed cards, search results."""
    spec = get_spec(content_type_code)
    if not spec:
        return {'badge': 'CONTENT', 'color': 'blue', 'cta': 'দেখুন', 'label_bn': 'বিষয়বস্তু'}
    return {
        'badge':    spec['badge'],
        'color':    spec['color'],
        'cta':      spec['cta'],
        'label_bn': spec['label_bn'],
    }
