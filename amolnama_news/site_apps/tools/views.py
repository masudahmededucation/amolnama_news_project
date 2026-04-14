import logging

from django.http import JsonResponse
from django.shortcuts import render

logger = logging.getLogger(__name__)

from amolnama_news.site_apps.multimedia.models import RefFileConversionMap


def _tools_breadcrumbs(name, url):
    """Helper to build standard tools breadcrumbs."""
    return [
        {"name": "হোম", "url": "/"},
        {"name": "টুলস", "url": "/tools/"},
        {"name": name, "url": url},
    ]


def _tool_json_ld(request, name_bn, name_en, description_bn, description_en, url_path):
    """Build SoftwareApplication JSON-LD schema for a tool page."""
    return {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": f"{name_bn} | {name_en}",
        "description": f"{description_bn} {description_en}",
        "url": request.build_absolute_uri(url_path),
        "applicationCategory": "BrowserApplication",
        "operatingSystem": "Any (Browser-based)",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "BDT",
        },
        "provider": {
            "@type": "Organization",
            "name": "আমলনামা নিউজ",
            "url": request.build_absolute_uri("/"),
        },
    }


def tools(request):
    tools_list_json_ld = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "ফ্রি অনলাইন টুলস | Free Online Tools",
        "description": "ফ্রি অনলাইন সফটওয়্যার টুলস — ফাইল কম্প্রেশন, রূপান্তর, ব্যাকগ্রাউন্ড রিমুভার। Free online software tools.",
        "url": request.build_absolute_uri("/tools/"),
        "provider": {"@type": "Organization", "name": "আমলনামা নিউজ"},
    }
    context = {
        "seo": {
            "title": "ফ্রি অনলাইন টুলস — আমলনামা নিউজ | Free Online Tools",
            "description": (
                "ফ্রি অনলাইন টুলস — ফাইল কম্প্রেশন, ফরম্যাট রূপান্তর, ব্যাকগ্রাউন্ড রিমুভার, "
                "ফটো অ্যালবাম মেকার, পাসপোর্ট ফটো রিসাইজার এবং আরও অনেক কিছু। সম্পূর্ণ বিনামূল্যে। "
                "Free online tools: file compression, format conversion, background remover, photo album maker."
            ),
            "og_type": "website",
            "json_ld": tools_list_json_ld,
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "টুলস", "url": "/tools/"},
            ],
        },
    }
    return render(request, "tools/tools.html", context)


def tools_reduce_file_size(request):
    context = {
        "seo": {
            "title": "ফাইলের সাইজ কমান — ছবি, PDF কম্প্রেস করুন বিনামূল্যে | Reduce File Size",
            "description": (
                "ছবির সাইজ কমান, PDF ছোট করুন, ডকুমেন্ট কম্প্রেস করুন — সম্পূর্ণ বিনামূল্যে, ব্রাউজারেই। "
                "কোনো আপলোড নেই, সব কাজ আপনার ডিভাইসে। "
                "Reduce image, PDF, and document file sizes online for free. No upload required."
            ),
            "og_type": "website",
            "json_ld": _tool_json_ld(request, "ফাইল কম্প্রেশন", "Reduce File Size", "ছবি, PDF ও ডকুমেন্টের ফাইল সাইজ কমান।", "Reduce image, PDF, and document file sizes online for free.", "/tools/reduce-file-size/"),
            "breadcrumbs": _tools_breadcrumbs("ফাইল কম্প্রেশন", "/tools/reduce-file-size/"),
        },
    }
    return render(request, "tools/tools-reduce-file-size.html", context)


def tools_file_conversion(request):
    context = {
        "seo": {
            "title": "ফাইল রূপান্তর — ফরম্যাট কনভার্ট করুন | File Conversion — Free Online Tool",
            "description": (
                "ফাইল ফরম্যাট রূপান্তর করুন — ছবি, ডকুমেন্ট, অডিও, ভিডিও। সম্পূর্ণ বিনামূল্যে। "
                "Convert between file formats — images, documents, audio, video. Free, client-side."
            ),
            "og_type": "website",
            "json_ld": _tool_json_ld(request, "ফাইল রূপান্তর", "File Conversion", "ফাইল ফরম্যাট রূপান্তর করুন — ছবি, ডকুমেন্ট, অডিও, ভিডিও।", "Convert between file formats — images, documents, audio, video.", "/tools/file-conversion/"),
            "breadcrumbs": _tools_breadcrumbs("ফাইল রূপান্তর", "/tools/file-conversion/"),
        },
    }
    return render(request, "tools/tools-file-conversion.html", context)


def tools_zip_creator(request):
    context = {
        "seo": {
            "title": "জিপ ক্রিয়েটর — ফাইল জিপ করুন | ZIP Creator — Free Online Tool",
            "description": (
                "একাধিক ফাইল একটি ZIP আর্কাইভে বান্ডেল করুন — সম্পূর্ণ বিনামূল্যে। "
                "Bundle multiple files into a ZIP archive online for free."
            ),
            "og_type": "website",
            "json_ld": _tool_json_ld(request, "জিপ ক্রিয়েটর", "ZIP Creator", "একাধিক ফাইল একটি ZIP আর্কাইভে বান্ডেল করুন।", "Bundle multiple files into a ZIP archive online for free.", "/tools/zip-creator/"),
            "breadcrumbs": _tools_breadcrumbs("জিপ ক্রিয়েটর", "/tools/zip-creator/"),
        },
    }
    return render(request, "tools/tools-zip-creator.html", context)


def tools_passport_photo_resizer(request):
    """Passport photo & signature resizer tool page."""
    context = {
        "seo": {
            "title": "পাসপোর্ট ফটো রিসাইজার — পাসপোর্ট সাইজ ছবি ও স্বাক্ষর | Passport Photo Resizer",
            "description": (
                "পাসপোর্ট সাইজ ছবি, ভিসা ফটো, NID ছবি, সরকারি ফর্মের ছবি ও স্বাক্ষর রিসাইজ করুন। "
                "300x300, 600x600 পিক্সেল। সম্পূর্ণ বিনামূল্যে, ব্রাউজারেই। "
                "Resize photos for passport, visa, NID, government forms. Free online tool."
            ),
            "og_type": "website",
            "json_ld": _tool_json_ld(request, "পাসপোর্ট ফটো রিসাইজার", "Passport Photo Resizer", "পাসপোর্ট, ভিসা ও সরকারি ফর্মের জন্য ছবির সাইজ পরিবর্তন করুন।", "Resize photos for passport, visa, and government forms.", "/tools/passport-photo-resizer/"),
            "breadcrumbs": _tools_breadcrumbs("পাসপোর্ট ফটো", "/tools/passport-photo-resizer/"),
        },
    }
    return render(request, "tools/tools-passport-photo-resizer.html", context)


def tools_background_remover(request):
    """AI background remover tool page."""
    context = {
        "seo": {
            "title": "ছবির ব্যাকগ্রাউন্ড রিমুভ — AI দিয়ে ব্যাকগ্রাউন্ড মুছুন বিনামূল্যে | Background Remover",
            "description": (
                "AI দিয়ে ছবির ব্যাকগ্রাউন্ড সরান — পাসপোর্ট ছবি, প্রোডাক্ট ফটো, প্রোফাইল পিকচার। "
                "সম্পূর্ণ বিনামূল্যে, ব্রাউজারেই, কোনো আপলোড নেই। "
                "Remove image backgrounds with AI — passport photos, product images, profile pictures. Free."
            ),
            "og_type": "website",
            "json_ld": _tool_json_ld(request, "ব্যাকগ্রাউন্ড রিমুভার", "Background Remover", "AI দিয়ে ছবির ব্যাকগ্রাউন্ড সরান।", "Remove image backgrounds with AI — free, runs entirely in your browser.", "/tools/background-remover/"),
            "breadcrumbs": _tools_breadcrumbs("ব্যাকগ্রাউন্ড রিমুভার", "/tools/background-remover/"),
        },
    }
    return render(request, "tools/tools-bg-remover.html", context)


def tools_merge_documents(request):
    """Merge multiple PDFs and images into a single PDF — client-side."""
    context = {
        "seo": {
            "title": "ডকুমেন্ট মার্জ — PDF ও ছবি একত্রিত করুন | Merge Documents — Free Tool",
            "description": (
                "একাধিক PDF ও ছবি একটি PDF-এ একত্রিত করুন — সম্পূর্ণ বিনামূল্যে। "
                "Merge multiple PDFs and images into one PDF. Free, client-side."
            ),
            "og_type": "website",
            "json_ld": _tool_json_ld(request, "ডকুমেন্ট মার্জ", "Merge Documents", "একাধিক PDF ও ছবি একটি PDF-এ একত্রিত করুন।", "Merge multiple PDFs and images into one PDF.", "/tools/merge-documents/"),
            "breadcrumbs": _tools_breadcrumbs("ডকুমেন্ট মার্জ", "/tools/merge-documents/"),
        },
    }
    return render(request, "tools/tools-merge-documents.html", context)


def tools_photo_album(request):
    """Photo album maker tool page."""
    context = {
        "seo": {
            "title": "ফটো অ্যালবাম মেকার — প্রিন্ট-রেডি অ্যালবাম পেজ তৈরি করুন | Photo Album Maker",
            "description": (
                "ফটো অ্যালবাম পেজ তৈরি করুন — NID কার্ড, পাসপোর্ট ফটো শীট, পারিবারিক অ্যালবাম। "
                "Create printable photo album pages — NID cards, passport sheets, family albums. Free tool."
            ),
            "og_type": "website",
            "json_ld": _tool_json_ld(request, "ফটো অ্যালবাম মেকার", "Photo Album Maker", "ফটো অ্যালবাম পেজ তৈরি করুন — NID কার্ড, পাসপোর্ট ফটো শীট।", "Create printable photo album pages — NID cards, passport sheets, family albums.", "/tools/photo-album/"),
            "breadcrumbs": _tools_breadcrumbs("ফটো অ্যালবাম", "/tools/photo-album/"),
        },
    }
    return render(request, "tools/tools-photo-album.html", context)


def tools_split_pdf(request):
    """PDF splitter tool page."""
    context = {
        "seo": {
            "title": "পিডিএফ স্প্লিট — পিডিএফ থেকে পাতা আলাদা করুন | Split PDF — Free Online Tool",
            "description": (
                "বড় পিডিএফ ফাইল থেকে নির্দিষ্ট পাতা আলাদা করুন — সম্পূর্ণ বিনামূল্যে, ব্রাউজারেই। "
                "Extract specific pages from a PDF file. Free, client-side, no upload required."
            ),
            "og_type": "website",
            "json_ld": _tool_json_ld(request, "পিডিএফ স্প্লিট", "Split PDF", "পিডিএফ থেকে নির্দিষ্ট পাতা আলাদা করুন।", "Extract specific pages from a PDF file.", "/tools/split-pdf/"),
            "breadcrumbs": _tools_breadcrumbs("পিডিএফ স্প্লিট", "/tools/split-pdf/"),
        },
    }
    return render(request, "tools/tools-split-pdf.html", context)


def tools_gpa_calculator(request):
    """GPA/CGPA Calculator tool page."""
    context = {
        "seo": {
            "title": "জিপিএ ক্যালকুলেটর — এসএসসি এইচএসসি জিপিএ ও সিজিপিএ হিসাব | GPA Calculator",
            "description": (
                "এসএসসি জিপিএ, এইচএসসি জিপিএ, বিশ্ববিদ্যালয় সিজিপিএ হিসাব করুন। "
                "গ্রেড পয়েন্ট গণনা, টার্গেট সিজিপিএ প্ল্যানার, সেমিস্টার ভিত্তিক ফলাফল। "
                "Calculate SSC/HSC GPA, University CGPA with target planner. Bangladesh grading system."
            ),
            "og_type": "website",
            "json_ld": _tool_json_ld(request, "জিপিএ/সিজিপিএ ক্যালকুলেটর", "GPA/CGPA Calculator", "এসএসসি/এইচএসসি জিপিএ এবং বিশ্ববিদ্যালয় সিজিপিএ হিসাব করুন।", "Calculate SSC/HSC GPA and University CGPA with target planner.", "/tools/gpa-calculator/"),
            "breadcrumbs": _tools_breadcrumbs("জিপিএ ক্যালকুলেটর", "/tools/gpa-calculator/"),
        },
    }
    return render(request, "tools/tools-gpa-calculator.html", context)


def tools_age_calculator(request):
    """Age Calculator — 100% client-side."""
    context = {
        "seo": {
            "title": "বয়স ক্যালকুলেটর — আপনার রাশি জেনে নিন, বয়স হিসাব ও মজার তথ্য | Age Calculator",
            "description": (
                "জন্মতারিখ দিন, বয়স জানুন — বছর, মাস, দিন, পরবর্তী জন্মদিন, জন্মের দিন, "
                "রাশি (Zodiac), চীনা রাশি, হৃদপিণ্ডের স্পন্দন, শ্বাসের সংখ্যা, ঘুমের সময় ও মজার তথ্য। "
                "Calculate exact age, zodiac sign, Chinese zodiac, heartbeats, breaths since birth. Free tool."
            ),
            "og_type": "website",
            "json_ld": _tool_json_ld(request, "বয়স ক্যালকুলেটর", "Age Calculator", "জন্মতারিখ থেকে বয়স, রাশি, চীনা রাশি, হৃদপিণ্ডের স্পন্দন, শ্বাসের সংখ্যা ও মজার তথ্য জানুন।", "Calculate exact age, zodiac sign, heartbeats, breaths, moon orbits since birth.", "/tools/age-calculator/"),
            "breadcrumbs": _tools_breadcrumbs("বয়স ক্যালকুলেটর", "/tools/age-calculator/"),
        },
    }
    return render(request, "tools/tools-age-calculator.html", context)


def api_transliterate(request):
    """Proxy to Google's transliteration API — returns Bengali suggestions for English input."""
    import urllib.request
    import urllib.parse
    text = request.GET.get("text", "").strip()
    if not text or len(text) > 100:
        return JsonResponse({"suggestions": []})
    try:
        url = (
            "https://inputtools.google.com/request?"
            "text=" + urllib.parse.quote(text) +
            "&itc=bn-t-i0-und&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8"
        )
        http_request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        http_response = urllib.request.urlopen(http_request, timeout=3)
        import json
        data = json.loads(http_response.read().decode())
        if data[0] == "SUCCESS" and len(data[1]) > 0:
            return JsonResponse({"suggestions": data[1][0][1]})
    except Exception as spell_check_error:
        logger.warning('Spell check API failed for query — %s', spell_check_error)
    return JsonResponse({"suggestions": []})


def api_file_conversion_map(request):
    """Return the conversion map as JSON: { ext: [targets], ... }"""
    rows = RefFileConversionMap.objects.all().values(
        "source_format", "allowed_destinations"
    )
    conversion_map = {}
    for row in rows:
        ext = row["source_format"].strip().lower().lstrip(".")
        destinations = [
            d.strip().lower().lstrip(".")
            for d in row["allowed_destinations"].split(",")
            if d.strip()
        ]
        conversion_map[ext] = destinations
    return JsonResponse(conversion_map)


def tools_watermark_remover(request):
    """Watermark remover tool page — user draws mask, server inpaints."""
    context = {
        "seo": {
            "title": "ওয়াটারমার্ক রিমুভার — ছবি থেকে ওয়াটারমার্ক মুছুন বিনামূল্যে | Watermark Remover",
            "description": (
                "ছবি থেকে ওয়াটারমার্ক, লোগো বা টেক্সট মুছুন — AI ইনপেইন্টিং দিয়ে মূল ছবি অক্ষত রেখে। "
                "সম্পূর্ণ বিনামূল্যে। "
                "Remove watermarks, logos or text from images — AI inpainting keeps the original intact. Free."
            ),
            "og_type": "website",
            "json_ld": _tool_json_ld(
                request,
                "ওয়াটারমার্ক রিমুভার", "Watermark Remover",
                "ছবি থেকে ওয়াটারমার্ক মুছুন।",
                "Remove watermarks from images using AI inpainting.",
                "/tools/watermark-remover/",
            ),
            "breadcrumbs": _tools_breadcrumbs("ওয়াটারমার্ক রিমুভার", "/tools/watermark-remover/"),
        },
    }
    return render(request, "tools/tools-watermark-remover.html", context)


def api_watermark_remove(request):
    """POST — accept image + mask, return inpainted image with watermark removed.

    User brushes over watermark area (mask = white on black). Server inpaints
    using OpenCV Telea algorithm with smoothing for natural-looking results.
    """
    import numpy as np
    import cv2
    from django.http import HttpResponse

    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'POST required'}, status=405)

    image_file = request.FILES.get('image_file')
    mask_file = request.FILES.get('mask_file')

    if not image_file or not mask_file:
        return JsonResponse({'success': False, 'error': 'image_file and mask_file required'}, status=400)

    if image_file.size > 10 * 1024 * 1024:
        return JsonResponse({'success': False, 'error': 'Image too large (max 10MB)'}, status=400)

    try:
        # Read image
        image_bytes = image_file.read()
        image_array = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        if image is None:
            return JsonResponse({'success': False, 'error': 'Invalid image file'}, status=400)

        # Cap image size at 2000px for fast processing
        max_dimension = 2000
        height, width = image.shape[:2]
        if max(height, width) > max_dimension:
            scale = max_dimension / max(height, width)
            image = cv2.resize(image, (int(width * scale), int(height * scale)))

        # Read mask (user-drawn: white = watermark area to remove)
        mask_bytes = mask_file.read()
        mask_array = np.frombuffer(mask_bytes, np.uint8)
        mask_raw = cv2.imdecode(mask_array, cv2.IMREAD_GRAYSCALE)
        if mask_raw is None:
            return JsonResponse({'success': False, 'error': 'Invalid mask file'}, status=400)

        if mask_raw.shape[:2] != image.shape[:2]:
            mask_raw = cv2.resize(mask_raw, (image.shape[1], image.shape[0]))
        _, mask_binary = cv2.threshold(mask_raw, 127, 255, cv2.THRESH_BINARY)

        if cv2.countNonZero(mask_binary) == 0:
            return JsonResponse({'success': False, 'error': 'ওয়াটারমার্কের উপর ব্রাশ করুন (Brush over the watermark first)'}, status=400)

        # Inpaint using Telea algorithm (larger radius = smoother blending)
        inpaint_radius = 10
        result = cv2.inpaint(image, mask_binary, inpaint_radius, cv2.INPAINT_TELEA)

        # Smooth the inpainted area to reduce "iron burn" artifacts
        # Blend the inpainted region with a slight Gaussian blur
        blurred = cv2.GaussianBlur(result, (5, 5), 0)
        # Only blend in the masked area — keep the rest sharp
        mask_3channel = cv2.merge([mask_binary, mask_binary, mask_binary])
        # Dilate mask slightly for smoother edge transition
        blend_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        blend_mask = cv2.dilate(mask_binary, blend_kernel, iterations=1)
        blend_mask_3ch = cv2.merge([blend_mask, blend_mask, blend_mask])
        # Feathered blend: 70% inpainted + 30% blurred in the masked area
        blend_mask_float = blend_mask_3ch.astype(float) / 255.0
        result = (result * (1 - blend_mask_float * 0.3) + blurred * blend_mask_float * 0.3).astype(np.uint8)

        # Encode result as JPEG
        _, result_buffer = cv2.imencode('.jpg', result, [cv2.IMWRITE_JPEG_QUALITY, 92])
        result_bytes = result_buffer.tobytes()

        return HttpResponse(result_bytes, content_type='image/jpeg')

    except Exception as inpaint_error:
        logger.error('Watermark removal failed — %s', inpaint_error)
        return JsonResponse({'success': False, 'error': 'Processing failed'}, status=500)
