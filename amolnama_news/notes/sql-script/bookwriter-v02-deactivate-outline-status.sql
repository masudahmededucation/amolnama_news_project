/* ================================================================
   bookwriter v02 — deactivate the redundant `outline` chapter stage

   Reason: the Plot tab (corkboard) is the canonical place for
   outlining at the scene/structural level. Having `outline` as a
   per-chapter status created naming overlap with that mode and the
   chapter-stage picker. Set is_active = 0 so it stops appearing in
   /api/refs/chapter_status/ and the rail picker dropdown, but keep
   the row so any existing chapters that were tagged 'outline' don't
   lose data — they just won't be re-selectable.

   Safe to run multiple times (idempotent).
================================================================ */
USE [news_magazine];
GO

UPDATE [bookwriter].[ref_chapter_status]
SET    is_active = 0,
       updated_at = SYSDATETIME()
WHERE  chapter_status_code = 'outline'
   AND is_active = 1;

PRINT 'Rows updated: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));
GO

-- Verify: should now show 3 active rows (blank / draft / done)
SELECT chapter_status_code, chapter_status_name_en, is_active
FROM   [bookwriter].[ref_chapter_status]
ORDER  BY sort_order, bookwriter_ref_chapter_status_id;
GO
