"""Post API views — create post, vote, bookmark, follow, flag."""

import hashlib
import json
import logging
import os
import uuid

logger = logging.getLogger(__name__)

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db import connection
from django.db.models import F
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

from .models import Post, PostMedia, PostLike, PostBookmark, PostVote, PostFollow, PostFlag

MEDIA_EXTENSION_MAP = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
}


@require_POST
@login_required
def api_post_create(request):
    """Create a new post with optional photo attachments (up to 4)."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    # Support both JSON and FormData
    scheduled_publish_at = None
    if request.content_type and 'multipart' in request.content_type:
        post_text = (request.POST.get('post_text') or '').strip()
        visibility_code = request.POST.get('visibility_code') or 'public'
        scheduled_publish_at_raw = request.POST.get('scheduled_publish_at') or ''
    else:
        try:
            data = json.loads(request.body)
            post_text = (data.get('post_text') or '').strip()
            visibility_code = data.get('visibility_code') or 'public'
            scheduled_publish_at_raw = data.get('scheduled_publish_at') or ''
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    if scheduled_publish_at_raw:
        from datetime import datetime as dt
        try:
            scheduled_publish_at = dt.fromisoformat(scheduled_publish_at_raw)
        except (ValueError, TypeError):
            scheduled_publish_at = None

    if visibility_code not in ('public', 'followers', 'private'):
        visibility_code = 'public'

    uploaded_files = request.FILES.getlist('post_media_files')

    # Must have text or media
    if not post_text and not uploaded_files:
        return JsonResponse({'success': False, 'error': 'পোস্টে কিছু লিখুন বা ছবি যোগ করুন'}, status=400)

    if post_text and len(post_text) > 1000:
        return JsonResponse({'success': False, 'error': 'পোস্ট ১০০০ অক্ষরের বেশি হতে পারবে না'}, status=400)

    # Minimum 150 characters for text-only posts (no media)
    if not uploaded_files and post_text and len(post_text) < 150:
        return JsonResponse({'success': False, 'error': 'শুধু টেক্সট পোস্টে সর্বনিম্ন ১৫০ অক্ষর লিখুন (Minimum 150 characters for text-only posts)'}, status=400)

    if len(uploaded_files) > 4:
        return JsonResponse({'success': False, 'error': 'সর্বোচ্চ ৪টি ছবি যোগ করা যায়'}, status=400)

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    # Determine post type
    post_type_code = 'text'
    if uploaded_files:
        post_type_code = 'media'

    # Save post immediately — NO keyword extraction here (done in background after response)
    post_guid = str(uuid.uuid4())
    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [post].[coll_post]
                ([post_guid], [link_user_profile_id], [post_text], [post_type_code], [visibility_code], [post_keywords_json], [scheduled_publish_at], [is_published], [is_active])
            OUTPUT INSERTED.post_post_id
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, [post_guid, user_profile.user_profile_id, post_text or None, post_type_code, visibility_code, None,
              scheduled_publish_at, 0 if scheduled_publish_at else 1, 1])
        post_post_id = cursor.fetchone()[0]

    post = Post.objects.get(post_post_id=post_post_id)

    # Save uploaded media files
    media_urls = []
    for file_index, uploaded_file in enumerate(uploaded_files):
        if uploaded_file.size > 10 * 1024 * 1024:
            continue
        if not uploaded_file.content_type.startswith('image/') and not uploaded_file.content_type.startswith('video/'):
            continue

        file_content = uploaded_file.read()
        sha256_hash = hashlib.sha256(file_content).digest()
        file_extension = MEDIA_EXTENSION_MAP.get(uploaded_file.content_type, '.jpg')

        # Reuse existing asset if same file was uploaded before (hash + size match)
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT [asset_id], [file_storage_path] FROM [media].[asset] WHERE [hash_sha256] = %s AND [file_size_bytes] = %s AND [is_active] = 1",
                [sha256_hash, len(file_content)],
            )
            existing_asset_row = cursor.fetchone()

        if existing_asset_row:
            asset_id = existing_asset_row[0]
            file_storage_path = existing_asset_row[1]
        else:
            asset_guid = uuid.uuid4()
            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO [media].[asset]
                        ([asset_guid], [file_original_name], [file_extension], [file_mime_type],
                         [file_size_bytes], [hash_sha256], [hash_algorithm_used], [hash_is_verified], [is_active])
                    OUTPUT INSERTED.asset_id, INSERTED.file_storage_path
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 1, 1)
                """, [
                    str(asset_guid),
                    uploaded_file.name or f'post_media_{file_index}.jpg',
                    file_extension,
                    uploaded_file.content_type,
                    len(file_content),
                    sha256_hash,
                    'sha256',
                ])
                row = cursor.fetchone()
                asset_id = row[0]
                file_storage_path = row[1]

            # Save file to disk (only for new assets)
            full_path = os.path.join(settings.MEDIA_ROOT, file_storage_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, 'wb') as destination_file:
                destination_file.write(file_content)

        # Get alt text for this file
        alt_texts_json = request.POST.get('alt_texts_json', '[]')
        try:
            alt_texts_list = json.loads(alt_texts_json)
        except (json.JSONDecodeError, ValueError):
            alt_texts_list = []
        alt_text_value = alt_texts_list[file_index] if file_index < len(alt_texts_list) else None
        alt_text_value = alt_text_value.strip() if alt_text_value else None

        # Link to post
        PostMedia.objects.create(
            link_post_id=post.post_post_id,
            link_asset_id=asset_id,
            sort_order=file_index,
            alt_text=alt_text_value or None,
        )
        media_urls.append('/media/' + file_storage_path)

    # Extract keywords in background thread — don't block the user
    if post_text and len(post_text) >= 20:
        import threading
        def _background_keyword_extraction(background_post_id, background_text):
            try:
                import django
                from django.db import connection as background_connection
                keywords_json = _extract_keywords(background_text)
                if keywords_json:
                    with background_connection.cursor() as background_cursor:
                        background_cursor.execute(
                            "UPDATE [post].[coll_post] SET [post_keywords_json] = %s WHERE [post_post_id] = %s",
                            [keywords_json, background_post_id],
                        )
            except Exception:
                logger.exception('Background keyword extraction failed for post %s', background_post_id)

        keyword_thread = threading.Thread(
            target=_background_keyword_extraction,
            args=(post.post_post_id, post_text),
            daemon=True,
        )
        keyword_thread.start()

    # Extract and link hashtags in background
    if post_text:
        import threading
        def _background_hashtag_extraction(background_post_id, background_text):
            try:
                _extract_and_link_hashtags(background_post_id, background_text)
            except Exception:
                logger.exception('Hashtag extraction failed for post %s', background_post_id)
        threading.Thread(target=_background_hashtag_extraction, args=(post.post_post_id, post_text), daemon=True).start()

    # Extract and link @mentions in background + send notifications
    if post_text:
        import threading
        def _background_mention_extraction(background_post_id, background_text, author_profile_id):
            try:
                _extract_and_link_mentions(background_post_id, background_text, author_profile_id)
            except Exception:
                logger.exception('Mention extraction failed for post %s', background_post_id)
        threading.Thread(target=_background_mention_extraction, args=(post.post_post_id, post_text, user_profile.user_profile_id), daemon=True).start()

    # Classify content in background — auto-flag harmful content
    if post_text:
        import threading
        def _background_content_classification(background_post_id, background_text):
            try:
                from amolnama_news.site_apps.newsengine.content_classifier import classify_and_store
                classify_and_store('post', background_post_id, background_text)
            except Exception:
                logger.exception('Content classification failed for post %s', background_post_id)
        threading.Thread(target=_background_content_classification, args=(post.post_post_id, post_text), daemon=True).start()

    # Fact-check in background — pattern detection, duplicate claims, domain blacklist, Google API
    if post_text and len(post_text) >= 20:
        import threading
        def _background_fact_check(background_post_id, background_text):
            try:
                from amolnama_news.site_apps.newsengine.fact_checker import fact_check_content
                fact_check_content('post', background_post_id, background_text)
            except Exception:
                logger.exception('Fact-check failed for post %s', background_post_id)
        threading.Thread(target=_background_fact_check, args=(post.post_post_id, post_text), daemon=True).start()

    # Render the post card HTML server-side — single source of truth (post-card.html template)
    from django.template.loader import render_to_string
    from .views import _calculate_time_ago, _highlight_text_with_entities, _parse_keywords_json

    keywords = _parse_keywords_json(post.post_keywords_json)
    post_item = {
        'post_post_id': post.post_post_id,
        'post_text': post.post_text,
        'post_text_highlighted': _highlight_text_with_entities(post.post_text, keywords),
        'author_display_name': user_profile.display_name or 'ব্যবহারকারী',
        'author_avatar_url': _get_user_avatar_url(user_profile),
        'author_user_profile_id': user_profile.user_profile_id,
        'author_is_verified': user_profile.is_verified if hasattr(user_profile, 'is_verified') else False,
        'author_bio': user_profile.professional_bio_summary if hasattr(user_profile, 'professional_bio_summary') else '',
        'author_username_handle': user_profile.username_handle if hasattr(user_profile, 'username_handle') else '',
        'author_follower_count': 0,
        'author_following_count': 0,
        'time_ago': 'এইমাত্র',
        'created_at_formatted': timezone.now().strftime('%d %b %Y, %I:%M %p'),
        'like_count': 0, 'reply_count': 0, 'repost_count': 0, 'view_count': 0,
        'bookmark_count': 0, 'vote_score_count': 0,
        'user_voted': False, 'user_followed_post': False, 'user_liked': False,
        'user_bookmarked': False, 'user_reposted': False,
        'media_urls': media_urls,
        'keywords': keywords,
        'is_repost': False,
        'can_delete': True,
        'can_edit': True,
        'is_edited': False,
        'is_pinned': False,
        'content_category_code': '',
        'is_auto_flagged': False,
        'is_scheduled': bool(scheduled_publish_at),
        'scheduled_publish_at': scheduled_publish_at,
        'quote_comment_text': None,
        'poll': None,
    }
    post_card_html = render_to_string('post/components/post-card.html', {
        'post_item': post_item,
        'request': request,
    })

    return JsonResponse({
        'success': True,
        'post_post_id': post.post_post_id,
        'post_card_html': post_card_html,
    })


def _get_user_avatar_url(user_profile):
    """Get avatar URL for a user profile."""
    if not user_profile.link_avatar_asset_id:
        return None
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT '/media/' + [file_storage_path] FROM [media].[asset] WHERE [asset_id] = %s AND [is_active] = 1",
            [user_profile.link_avatar_asset_id],
        )
        row = cursor.fetchone()
    return row[0] if row else None


def _extract_and_link_mentions(post_id, text, author_user_profile_id):
    """Extract @handles from post text, link to PostMention, send notifications."""
    import re
    from django.db import connection as mention_connection
    from amolnama_news.site_apps.user_account.models import UserProfile

    mention_pattern = re.compile(r'@([\w.-]+)', re.UNICODE)
    matches = mention_pattern.findall(text)
    if not matches:
        return

    seen_handles = set()
    for handle in matches:
        handle_lower = handle.lower().strip()
        if len(handle_lower) < 2 or handle_lower in seen_handles:
            continue
        seen_handles.add(handle_lower)

        # Look up user by handle
        mentioned_profile = UserProfile.objects.filter(username_handle__iexact=handle_lower).first()
        if not mentioned_profile:
            continue

        mentioned_user_profile_id = mentioned_profile.user_profile_id

        # Skip self-mention
        if mentioned_user_profile_id == author_user_profile_id:
            continue

        # Insert mention record
        with mention_connection.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM [post].[post_mention] WHERE [link_post_id] = %s AND [link_mentioned_user_profile_id] = %s",
                [post_id, mentioned_user_profile_id],
            )
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO [post].[post_mention] ([link_post_id], [link_mentioned_user_profile_id]) VALUES (%s, %s)",
                    [post_id, mentioned_user_profile_id],
                )

        # Send notification
        try:
            from amolnama_news.site_apps.newsengine.notifications import create_notification
            create_notification(
                recipient_user_profile_id=mentioned_user_profile_id,
                actor_user_profile_id=author_user_profile_id,
                event_code='mention',
                source_app='post',
                content_id=post_id,
                message='আপনাকে একটি পোস্টে উল্লেখ করা হয়েছে',
                url=f'/post/{post_id}/',
            )
        except Exception:
            logger.exception('Mention notification failed for user %s', mentioned_user_profile_id)


def _extract_and_link_hashtags(post_id, text):
    """Extract #hashtags from post text, upsert into HashtagItem, link via HashtagPostLink."""
    import re
    import unicodedata
    from django.db import connection as hashtag_connection

    hashtag_pattern = re.compile(r'#([\w\u0980-\u09FF]+)', re.UNICODE)
    matches = hashtag_pattern.findall(text)
    if not matches:
        return

    seen_tags = set()
    for raw_tag in matches:
        tag_text = raw_tag.strip()
        if len(tag_text) < 2 or tag_text in seen_tags:
            continue
        seen_tags.add(tag_text)
        tag_normalized = unicodedata.normalize('NFC', tag_text.lower())

        with hashtag_connection.cursor() as cursor:
            # Upsert hashtag — get or create
            cursor.execute(
                "SELECT [newsengine_hashtag_item_id] FROM [newsengine].[hashtag_item] WHERE [hashtag_text_normalized] = %s",
                [tag_normalized],
            )
            row = cursor.fetchone()
            if row:
                hashtag_id = row[0]
                cursor.execute(
                    "UPDATE [newsengine].[hashtag_item] SET [hashtag_post_count] = [hashtag_post_count] + 1 WHERE [newsengine_hashtag_item_id] = %s",
                    [hashtag_id],
                )
            else:
                cursor.execute(
                    "INSERT INTO [newsengine].[hashtag_item] ([hashtag_text], [hashtag_text_normalized], [hashtag_post_count]) OUTPUT INSERTED.[newsengine_hashtag_item_id] VALUES (%s, %s, 1)",
                    [tag_text, tag_normalized],
                )
                hashtag_id = cursor.fetchone()[0]

            # Link post to hashtag (skip if already linked)
            cursor.execute(
                "SELECT 1 FROM [newsengine].[hashtag_post_link] WHERE [link_hashtag_id] = %s AND [link_post_id] = %s",
                [hashtag_id, post_id],
            )
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO [newsengine].[hashtag_post_link] ([link_hashtag_id], [link_post_id]) VALUES (%s, %s)",
                    [hashtag_id, post_id],
                )


def _extract_keywords(text):
    """Extract theme keywords from Bengali/English text. Returns JSON string.

    Strategy: frequency-based theme detection (finds what the text is ABOUT)
    rather than statistical n-gram extraction (which just picks common word pairs).
    Repeated meaningful words = the topic/theme of the text.
    """
    try:
        import re
        from collections import Counter

        # Bengali stopwords — grammatical particles, pronouns, common verbs
        bengali_stopwords = {
            'এবং', 'ও', 'এই', 'একটি', 'একটা', 'তার', 'এর', 'যে', 'করে', 'হয়',
            'হয়েছে', 'করা', 'করেছে', 'থেকে', 'জন্য', 'সাথে', 'নিয়ে', 'আমি', 'তুমি',
            'আপনি', 'সে', 'তারা', 'আমরা', 'কিন্তু', 'যদি', 'তাহলে', 'আর', 'না', 'হবে',
            'করতে', 'দিয়ে', 'পরে', 'আগে', 'মধ্যে', 'উপর', 'নিচে', 'কারণ', 'ফলে',
            'তো', 'কি', 'কে', 'যা', 'তা', 'এক', 'দুই', 'তিন', 'সব', 'আমার', 'তোমার',
            'কোনো', 'কিংবা', 'কারো', 'যায়', 'যাওয়া', 'বলা', 'হলো', 'মূলত', 'আবার',
            'দেওয়া', 'নেওয়া', 'রাখা', 'নিজের', 'অন্য', 'এরই', 'উভয়', 'সকল', 'প্রতি',
            'হচ্ছে', 'ছিল', 'হতে', 'দিন', 'সময়', 'পর্যন্ত', 'ভাবে', 'শুধু', 'মাত্র',
            'আজ', 'কাল', 'এখন', 'তখন', 'যখন', 'সেই', 'ঐ', 'ওই', 'নয়', 'হোক',
            # Bengali religious/common phrases to skip
            'বিসমিল্লাহির', 'রাহমানির', 'রাহিম', 'আলহামদুলিল্লাহ', 'ইনশাআল্লাহ',
            'মাশাআল্লাহ', 'সুবহানাল্লাহ', 'আল্লাহ', 'রাসূল',
        }

        english_stopwords = {
            'the', 'is', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'it', 'this', 'that', 'are', 'was', 'were', 'be',
            'you', 'your', 'can', 'should', 'then', 'them', 'not', 'done', 'way', 'once',
            'again', 'also', 'just', 'have', 'has', 'had', 'will', 'would', 'could',
        }

        if not text or len(text.strip()) < 20:
            return None

        # Extract Bengali words (3+ chars, not stopwords)
        bengali_words = re.findall(r'[\u0980-\u09FF]{3,}', text)
        meaningful_bengali = [word for word in bengali_words
                              if word not in bengali_stopwords and len(word) > 2]

        # Extract English words (3+ chars, not stopwords)
        english_words = re.findall(r'[a-zA-Z]{3,}', text)
        meaningful_english = [word.lower() for word in english_words
                              if word.lower() not in english_stopwords]

        # Count frequency — repeated words = theme
        frequency_counter = Counter(meaningful_bengali + meaningful_english)

        # Stem matching — group suffixed forms under their shortest stem
        # Bengali: অবিচার, অবিচারের, অবিচারে → all count toward অবিচার
        # Sort unique words by length (shortest first) so stems are processed before suffixed forms
        unique_words_sorted = sorted(set(meaningful_bengali + meaningful_english), key=len)
        stem_map = {}  # word → stem it belongs to
        for word in unique_words_sorted:
            matched_stem = None
            for existing_stem in stem_map.values():
                if word.startswith(existing_stem) and existing_stem != word:
                    matched_stem = existing_stem
                    break
            stem_map[word] = matched_stem if matched_stem else word

        # Aggregate counts by stem
        for word, count in list(frequency_counter.items()):
            stem = stem_map.get(word, word)
            if stem != word:
                frequency_counter[stem] = frequency_counter.get(stem, 0) + count
                del frequency_counter[word]

        # Sort by frequency (highest first), then by word length (longer = more specific)
        sorted_keywords = sorted(
            frequency_counter.items(),
            key=lambda item: (-item[1], -len(item[0]))
        )

        # Deduplicate: skip words that are substrings of already-selected keywords
        final_keywords = []
        seen_stems = set()
        for keyword, count in sorted_keywords:
            # Skip if this word is contained in an already-selected keyword
            if any(keyword in existing or existing in keyword for existing in seen_stems):
                continue
            seen_stems.add(keyword)
            final_keywords.append(keyword)
            if len(final_keywords) >= 5:
                break

        if final_keywords:
            return json.dumps(final_keywords, ensure_ascii=False)
    except Exception:
        logger.exception('Keyword extraction failed for text: %s...', text[:50] if text else '')
    return None


@require_POST
@login_required
def api_post_like_toggle(request, post_post_id):
    """Toggle like on a post."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    existing_like = PostLike.objects.filter(
        link_post_id=post_post_id,
        link_user_profile_id=user_profile.user_profile_id,
    ).first()

    if existing_like:
        existing_like.delete()
        Post.objects.filter(post_post_id=post_post_id, like_count__gt=0).update(
            like_count=F('like_count') - 1
        )
        liked = False
    else:
        PostLike.objects.create(
            link_post_id=post_post_id,
            link_user_profile_id=user_profile.user_profile_id,
        )
        Post.objects.filter(post_post_id=post_post_id).update(
            like_count=F('like_count') + 1
        )
        liked = True

    new_like_count = Post.objects.filter(
        post_post_id=post_post_id
    ).values_list('like_count', flat=True).first() or 0

    return JsonResponse({'success': True, 'liked': liked, 'like_count': new_like_count})


@require_POST
@login_required
def api_post_bookmark_toggle(request, post_post_id):
    """Toggle bookmark on a post."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    existing_bookmark = PostBookmark.objects.filter(
        link_post_id=post_post_id,
        link_user_profile_id=user_profile.user_profile_id,
    ).first()

    if existing_bookmark:
        existing_bookmark.delete()
        Post.objects.filter(post_post_id=post_post_id, bookmark_count__gt=0).update(
            bookmark_count=F('bookmark_count') - 1
        )
        bookmarked = False
    else:
        PostBookmark.objects.create(
            link_post_id=post_post_id,
            link_user_profile_id=user_profile.user_profile_id,
        )
        Post.objects.filter(post_post_id=post_post_id).update(
            bookmark_count=F('bookmark_count') + 1
        )
        bookmarked = True

    new_bookmark_count = Post.objects.filter(
        post_post_id=post_post_id
    ).values_list('bookmark_count', flat=True).first() or 0

    return JsonResponse({'success': True, 'bookmarked': bookmarked, 'bookmark_count': new_bookmark_count})


@require_POST
def api_post_view_increment(request, post_post_id):
    """Increment view count on a post. No login required."""
    Post.objects.filter(post_post_id=post_post_id).update(
        view_count=F('view_count') + 1
    )
    new_view_count = Post.objects.filter(
        post_post_id=post_post_id
    ).values_list('view_count', flat=True).first() or 0
    return JsonResponse({'success': True, 'view_count': new_view_count})


@require_POST
@login_required
def api_post_repost(request, post_post_id):
    """Toggle repost or quote repost — creates repost if not reposted, removes if already reposted."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    # Accept optional quote comment
    quote_comment_text = None
    try:
        data = json.loads(request.body)
        quote_comment_text = (data.get('quote_comment_text') or '').strip() or None
    except (json.JSONDecodeError, ValueError):
        pass

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    original_post = Post.objects.filter(post_post_id=post_post_id, is_active=True).first()
    if not original_post:
        return JsonResponse({'success': False, 'error': 'পোস্ট পাওয়া যায়নি'}, status=400)

    # Self-repost toggle — set to False to block reposting own posts in production
    ALLOW_SELF_REPOST = True
    if not ALLOW_SELF_REPOST and original_post.link_user_profile_id == user_profile.user_profile_id:
        return JsonResponse({'success': False, 'error': 'নিজের পোস্ট রিপোস্ট করা যায় না'}, status=400)

    # One repost per user per post — find the latest (by ID, most recent)
    existing_repost = Post.objects.filter(
        link_repost_of_post_id=post_post_id,
        link_user_profile_id=user_profile.user_profile_id,
        post_type_code='repost',
    ).order_by('-post_post_id').first()

    if existing_repost and existing_repost.is_active:
        # Undo repost — soft delete
        existing_repost.is_active = False
        existing_repost.save(update_fields=['is_active'])
        reposted = False
    elif existing_repost and not existing_repost.is_active:
        # Re-activate previously undone repost — reset counts to fresh
        existing_repost.is_active = True
        existing_repost.view_count = 0
        existing_repost.like_count = 0
        existing_repost.save(update_fields=['is_active', 'view_count', 'like_count'])
        reposted = True
    else:
        # First-time repost — create via raw SQL (UUID issue with ORM)
        repost_guid = str(uuid.uuid4())
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [post].[coll_post]
                    ([post_guid], [link_user_profile_id], [link_repost_of_post_id], [post_type_code],
                     [quote_comment_text], [is_published], [is_active])
                OUTPUT INSERTED.post_post_id
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, [repost_guid, user_profile.user_profile_id, post_post_id,
                  'quote_repost' if quote_comment_text else 'repost',
                  quote_comment_text, 1, 1])
            cursor.fetchone()
        reposted = True

    # Always recalculate from actual data — never increment/decrement
    from django.db.models import Q
    actual_repost_count = Post.objects.filter(
        link_repost_of_post_id=post_post_id,
        is_active=True,
    ).filter(Q(post_type_code='repost') | Q(post_type_code='quote_repost')).count()
    Post.objects.filter(post_post_id=post_post_id).update(repost_count=actual_repost_count)
    new_repost_count = actual_repost_count

    return JsonResponse({'success': True, 'reposted': reposted, 'repost_count': new_repost_count})


@require_POST
@login_required
def api_post_reply(request, post_post_id):
    """Reply to a post — creates a child post."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    reply_text_bn = (data.get('reply_text_bn') or '').strip()
    if not reply_text_bn:
        return JsonResponse({'success': False, 'error': 'মন্তব্য লিখুন'}, status=400)

    suggestion_type_code = (data.get('suggestion_type_code') or '').strip() or None
    VALID_SUGGESTION_TYPES = {'add_information', 'correct_information', 'add_source', 'clarify'}
    if suggestion_type_code and suggestion_type_code not in VALID_SUGGESTION_TYPES:
        suggestion_type_code = None

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    # Create reply via raw SQL
    reply_guid = str(uuid.uuid4())
    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [post].[coll_post]
                ([post_guid], [link_user_profile_id], [link_parent_post_id], [post_text], [post_type_code], [suggestion_type_code], [is_published], [is_active])
            OUTPUT INSERTED.post_post_id
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, [reply_guid, user_profile.user_profile_id, post_post_id, reply_text_bn, 'reply', suggestion_type_code, 1, 1])
        reply_post_id = cursor.fetchone()[0]

    # Increment reply count on parent
    Post.objects.filter(post_post_id=post_post_id).update(
        reply_count=F('reply_count') + 1
    )

    new_reply_count = Post.objects.filter(
        post_post_id=post_post_id
    ).values_list('reply_count', flat=True).first() or 0

    return JsonResponse({
        'success': True,
        'reply_post_id': reply_post_id,
        'reply_count': new_reply_count,
        'author_display_name': user_profile.display_name or 'ব্যবহারকারী',
    })


@require_POST
@login_required
def api_post_edit(request, post_post_id):
    """Edit post text. Only post owner can edit."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    post = Post.objects.filter(post_post_id=post_post_id, is_active=True).first()
    if not post:
        return JsonResponse({'success': False, 'error': 'পোস্ট পাওয়া যায়নি'}, status=404)

    if post.link_user_profile_id != user_profile.user_profile_id and not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'আপনার অনুমতি নেই'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    new_text = (data.get('post_text') or '').strip()
    if not new_text:
        return JsonResponse({'success': False, 'error': 'পোস্টে কিছু লিখুন'}, status=400)
    if len(new_text) > 1000:
        return JsonResponse({'success': False, 'error': 'পোস্ট ১০০০ অক্ষরের বেশি হতে পারবে না'}, status=400)

    # Save previous text to edit history before overwriting
    if post.post_text and post.post_text != new_text:
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO [post].[post_edit_history] ([link_post_id], [previous_post_text], [edited_by_user_profile_id]) VALUES (%s, %s, %s)",
                [post_post_id, post.post_text, user_profile.user_profile_id],
            )

    post.post_text = new_text
    post.is_edited = True
    post.edited_at = timezone.now()
    post.updated_at = timezone.now()
    post.save(update_fields=['post_text', 'is_edited', 'edited_at', 'updated_at'])

    # Re-extract keywords in background
    if len(new_text) >= 20:
        import threading
        def _background_keyword_update(background_post_id, background_text):
            try:
                keywords_json = _extract_keywords(background_text)
                if keywords_json:
                    with connection.cursor() as background_cursor:
                        background_cursor.execute(
                            "UPDATE [post].[coll_post] SET [post_keywords_json] = %s WHERE [post_post_id] = %s",
                            [keywords_json, background_post_id],
                        )
            except Exception:
                logger.exception('Background keyword update failed for post %s', background_post_id)
        threading.Thread(target=_background_keyword_update, args=(post_post_id, new_text), daemon=True).start()

    return JsonResponse({'success': True, 'post_text': new_text})


@require_POST
@login_required
def api_post_delete(request, post_post_id):
    """Soft-delete a post (set is_active = 0). Only post owner can delete."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    post = Post.objects.filter(post_post_id=post_post_id, is_active=True).first()
    if not post:
        return JsonResponse({'success': False, 'error': 'পোস্ট পাওয়া যায়নি'}, status=404)

    # Only post owner can delete — admins use moderation queue
    if post.link_user_profile_id != user_profile.user_profile_id:
        return JsonResponse({'success': False, 'error': 'শুধুমাত্র নিজের পোস্ট মুছতে পারবেন'}, status=403)

    post.is_active = False
    post.save(update_fields=['is_active'])

    # If this was a repost, recalculate the original post's repost count
    original_post_id = None
    if post.post_type_code == 'repost' and post.link_repost_of_post_id:
        original_post_id = post.link_repost_of_post_id
        actual_repost_count = Post.objects.filter(
            link_repost_of_post_id=original_post_id,
            post_type_code='repost',
            is_active=True,
        ).count()
        Post.objects.filter(post_post_id=original_post_id).update(repost_count=actual_repost_count)

    return JsonResponse({'success': True, 'was_repost': post.post_type_code == 'repost', 'original_post_id': original_post_id})


def api_post_replies(request, post_post_id):
    """Fetch replies for a post. GET request, no login required."""
    from amolnama_news.site_apps.user_account.models import UserProfile
    from amolnama_news.site_apps.post.views import _calculate_time_ago, _get_avatar_urls_bulk

    replies = Post.objects.filter(
        link_parent_post_id=post_post_id,
        is_active=True,
    ).order_by('created_at')[:50]

    if not replies:
        return JsonResponse({'success': True, 'replies': []})

    # Build profile map for reply authors
    reply_profile_ids = set(reply.link_user_profile_id for reply in replies)
    profile_map = {}
    for profile in UserProfile.objects.filter(user_profile_id__in=reply_profile_ids):
        profile_map[profile.user_profile_id] = profile

    avatar_url_map = _get_avatar_urls_bulk(profile_map)

    # Bulk-fetch vote state for current user
    reply_post_ids = [reply.post_post_id for reply in replies]
    user_voted_reply_ids = set()
    current_viewer_profile_id = None
    if request.user.is_authenticated:
        try:
            viewer_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
            current_viewer_profile_id = viewer_profile.user_profile_id
            user_voted_reply_ids = set(
                PostVote.objects.filter(
                    link_post_id__in=reply_post_ids,
                    link_user_profile_id=current_viewer_profile_id,
                    is_active=True,
                ).values_list('link_post_id', flat=True)
            )
        except UserProfile.DoesNotExist:
            pass

    reply_items = []
    for reply in replies:
        profile = profile_map.get(reply.link_user_profile_id)
        author_display_name = profile.display_name if profile and profile.display_name else 'ব্যবহারকারী'

        reply_items.append({
            'post_post_id': reply.post_post_id,
            'post_text': reply.post_text,
            'author_display_name': author_display_name,
            'author_avatar_url': avatar_url_map.get(reply.link_user_profile_id),
            'time_ago': _calculate_time_ago(reply.created_at),
            'created_at_formatted': reply.created_at.strftime('%d %b %Y, %I:%M %p') if reply.created_at else '',
            'vote_score_count': reply.vote_score_count or 0,
            'user_voted': reply.post_post_id in user_voted_reply_ids,
            'can_edit': current_viewer_profile_id and reply.link_user_profile_id == current_viewer_profile_id,
        })

    return JsonResponse({'success': True, 'replies': reply_items})


# =========================================================================
# UPVOTE
# =========================================================================

@require_POST
@login_required
def api_post_vote_toggle(request, post_post_id):
    """Toggle upvote on a post. Upvote only (no downvote)."""
    from amolnama_news.site_apps.user_account.models import UserProfile
    from django.utils import timezone

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    post = Post.objects.filter(post_post_id=post_post_id, is_active=True).first()
    if not post:
        return JsonResponse({'success': False, 'error': 'পোস্ট পাওয়া যায়নি'}, status=404)

    existing_vote = PostVote.objects.filter(
        link_post_id=post_post_id,
        link_user_profile_id=user_profile.user_profile_id,
    ).order_by('-post_post_vote_id').first()

    if existing_vote and existing_vote.is_active:
        existing_vote.is_active = False
        existing_vote.updated_at = timezone.now()
        existing_vote.save(update_fields=['is_active', 'updated_at'])
        voted = False
    elif existing_vote and not existing_vote.is_active:
        existing_vote.is_active = True
        existing_vote.updated_at = timezone.now()
        existing_vote.save(update_fields=['is_active', 'updated_at'])
        voted = True
    else:
        PostVote.objects.create(
            link_post_id=post_post_id,
            link_user_profile_id=user_profile.user_profile_id,
            vote_value=1,
            is_active=True,
        )
        voted = True

    # Recalculate from actual data
    actual_vote_count = PostVote.objects.filter(
        link_post_id=post_post_id, is_active=True,
    ).count()
    Post.objects.filter(post_post_id=post_post_id).update(vote_score_count=actual_vote_count)

    # Update post author's contribution score in background
    import threading
    threading.Thread(
        target=_update_contribution_score_background,
        args=(post.link_user_profile_id,),
        daemon=True,
    ).start()

    return JsonResponse({'success': True, 'voted': voted, 'vote_score_count': actual_vote_count})


# =========================================================================
# FOLLOW POST
# =========================================================================

@require_POST
@login_required
def api_post_follow_toggle(request, post_post_id):
    """Toggle follow/unfollow a post for notifications."""
    from amolnama_news.site_apps.user_account.models import UserProfile
    from django.utils import timezone

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    if not Post.objects.filter(post_post_id=post_post_id, is_active=True).exists():
        return JsonResponse({'success': False, 'error': 'পোস্ট পাওয়া যায়নি'}, status=404)

    existing_follow = PostFollow.objects.filter(
        link_post_id=post_post_id,
        link_user_profile_id=user_profile.user_profile_id,
    ).first()

    if existing_follow and existing_follow.is_active:
        existing_follow.is_active = False
        existing_follow.updated_at = timezone.now()
        existing_follow.save(update_fields=['is_active', 'updated_at'])
        following = False
    elif existing_follow and not existing_follow.is_active:
        existing_follow.is_active = True
        existing_follow.updated_at = timezone.now()
        existing_follow.save(update_fields=['is_active', 'updated_at'])
        following = True
    else:
        PostFollow.objects.create(
            link_post_id=post_post_id,
            link_user_profile_id=user_profile.user_profile_id,
            is_active=True,
        )
        following = True

    return JsonResponse({'success': True, 'following': following})


# =========================================================================
# FLAG POST
# =========================================================================

VALID_FLAG_REASONS = {'misinformation', 'spam', 'harassment', 'hate_speech', 'other'}


@require_POST
@login_required
def api_post_flag_create(request, post_post_id):
    """Flag a post for moderation. One-way — no toggle/undo."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    if not Post.objects.filter(post_post_id=post_post_id, is_active=True).exists():
        return JsonResponse({'success': False, 'error': 'পোস্ট পাওয়া যায়নি'}, status=404)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    flag_reason_code = (data.get('flag_reason_code') or '').strip()
    if flag_reason_code not in VALID_FLAG_REASONS:
        return JsonResponse({'success': False, 'error': 'কারণ নির্বাচন করুন'}, status=400)

    flag_description = (data.get('flag_description') or '').strip() or None

    # Check if already flagged by this user
    if PostFlag.objects.filter(
        link_post_id=post_post_id,
        link_user_profile_id=user_profile.user_profile_id,
        is_active=True,
    ).exists():
        return JsonResponse({'success': False, 'error': 'আপনি ইতিমধ্যে এই পোস্ট ফ্ল্যাগ করেছেন'}, status=400)

    PostFlag.objects.create(
        link_post_id=post_post_id,
        link_user_profile_id=user_profile.user_profile_id,
        flag_reason_code=flag_reason_code,
        flag_description=flag_description,
        flag_status_code='pending',
        is_active=True,
    )

    return JsonResponse({'success': True, 'flagged': True})


# =========================================================================
# CONTRIBUTION SCORE (background)
# =========================================================================

def _update_contribution_score_background(author_user_profile_id):
    """Recalculate contribution score for a user. Runs in background thread."""
    try:
        total_votes_received = PostVote.objects.filter(
            link_post_id__in=Post.objects.filter(
                link_user_profile_id=author_user_profile_id, is_active=True,
            ).values_list('post_post_id', flat=True),
            is_active=True,
        ).count()

        contribution_score = total_votes_received * 10

        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE [account].[user_profile] SET [contribution_score_count] = %s WHERE [user_profile_id] = %s",
                [contribution_score, author_user_profile_id],
            )
    except Exception:
        logger.exception('Contribution score update failed for profile %s', author_user_profile_id)


# =========================================================
# POLL VOTE
# =========================================================

@require_POST
@login_required
def api_poll_vote(request, post_post_id):
    """Vote on a poll option. One vote per user per poll."""
    from amolnama_news.site_apps.user_account.models import UserProfile
    from .models import PostPoll, PostPollVote

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    poll_id = data.get('poll_id')
    selected_option_number = data.get('selected_option_number')

    if not poll_id or not selected_option_number or selected_option_number not in (1, 2, 3, 4):
        return JsonResponse({'success': False, 'error': 'Invalid poll option'}, status=400)

    poll = PostPoll.objects.filter(post_post_poll_id=poll_id, link_post_id=post_post_id, is_active=True).first()
    if not poll:
        return JsonResponse({'success': False, 'error': 'পোল পাওয়া যায়নি'}, status=404)

    # Check if already voted
    existing_vote = PostPollVote.objects.filter(
        link_poll_id=poll_id, link_user_profile_id=user_profile.user_profile_id, is_active=True,
    ).first()
    if existing_vote:
        return JsonResponse({'success': False, 'error': 'আপনি ইতিমধ্যে ভোট দিয়েছেন'}, status=400)

    # Insert vote
    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [post].[post_poll_vote] ([link_poll_id], [link_user_profile_id], [selected_option_number])
            VALUES (%s, %s, %s)
        """, [poll_id, user_profile.user_profile_id, selected_option_number])

    # Update cached counts
    vote_count_column = f'poll_option_{selected_option_number}_vote_count'
    with connection.cursor() as cursor:
        cursor.execute(f"""
            UPDATE [post].[post_poll]
            SET [{vote_count_column}] = [{vote_count_column}] + 1, [total_vote_count] = [total_vote_count] + 1
            WHERE [post_post_poll_id] = %s
        """, [poll_id])

    # Return updated results
    poll.refresh_from_db()
    options = []
    for option_number in range(1, 5):
        option_text = getattr(poll, f'poll_option_{option_number}', None)
        if option_text:
            vote_count = getattr(poll, f'poll_option_{option_number}_vote_count', 0)
            percentage = round(vote_count / max(poll.total_vote_count, 1) * 100)
            options.append({'option_number': option_number, 'text': option_text, 'vote_count': vote_count, 'percentage': percentage})

    return JsonResponse({
        'success': True,
        'total_vote_count': poll.total_vote_count,
        'options': options,
        'selected_option_number': selected_option_number,
    })


# =========================================================
# PIN POST
# =========================================================

@require_POST
@login_required
def api_post_pin_toggle(request, post_post_id):
    """Toggle pin/unpin a post. Only ONE pinned post per user."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    post = Post.objects.filter(post_post_id=post_post_id, is_active=True).first()
    if not post:
        return JsonResponse({'success': False, 'error': 'পোস্ট পাওয়া যায়নি'}, status=404)

    if post.link_user_profile_id != user_profile.user_profile_id:
        return JsonResponse({'success': False, 'error': 'আপনার অনুমতি নেই'}, status=403)

    if post.is_pinned:
        # Unpin
        post.is_pinned = False
        post.save(update_fields=['is_pinned'])
        return JsonResponse({'success': True, 'is_pinned': False})
    else:
        # Unpin any existing pinned post by this user first
        Post.objects.filter(
            link_user_profile_id=user_profile.user_profile_id, is_pinned=True,
        ).update(is_pinned=False)
        # Pin this one
        post.is_pinned = True
        post.save(update_fields=['is_pinned'])
        return JsonResponse({'success': True, 'is_pinned': True})


# =========================================================
# @MENTION AUTOCOMPLETE
# =========================================================

def api_mention_autocomplete(request):
    """GET ?q=partial_handle — returns matching user profiles for @mention autocomplete."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    query = (request.GET.get('q') or '').strip().lower()
    if len(query) < 1:
        return JsonResponse({'success': True, 'users': []})

    profiles = UserProfile.objects.filter(
        username_handle__istartswith=query,
    ).exclude(username_handle__isnull=True).order_by('username_handle')[:8]

    users = []
    for profile in profiles:
        avatar_url = None
        if profile.link_avatar_asset_id:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT '/media/' + [file_storage_path] FROM [media].[asset] WHERE [asset_id] = %s AND [is_active] = 1",
                    [profile.link_avatar_asset_id],
                )
                row = cursor.fetchone()
                if row:
                    avatar_url = row[0]
        users.append({
            'handle': profile.username_handle,
            'display_name': profile.display_name or '',
            'avatar_url': avatar_url,
        })

    return JsonResponse({'success': True, 'users': users})


# =========================================================
# EDIT HISTORY
# =========================================================

def api_post_edit_history(request, post_post_id):
    """GET — returns edit history for a post (list of previous versions)."""
    from .models import PostEditHistory

    history = PostEditHistory.objects.filter(
        link_post_id=post_post_id,
    ).order_by('-created_at')[:20]

    items = [{
        'previous_text': entry.previous_post_text or '',
        'edited_at': entry.created_at.strftime('%d %b %Y, %I:%M %p') if entry.created_at else '',
    } for entry in history]

    return JsonResponse({'success': True, 'history': items})
