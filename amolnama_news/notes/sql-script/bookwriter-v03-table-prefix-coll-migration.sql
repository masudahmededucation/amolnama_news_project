/* ============================================================
   bookwriter v03 — VOID. Created in error 2026-04-29; do NOT run.
   ============================================================
   The script that lived here proposed renaming 16 bookwriter
   tables to add a `coll_` prefix to every child entity (chapter
   -> coll_chapter, bible_entry -> coll_bible_entry,
   engagement_serial_subscriber -> coll_engagement_serial_subscriber,
   etc.). That was a misinterpretation of CLAUDE.md Gate 7.

   The CORRECT rule (clarified by user 2026-04-29):

     `coll_` prefix is ONLY for the PRIMARY / MAIN collection
     table per entity group. Child / sub-entity tables that
     semantically belong to the same group must use the group's
     entity name as the prefix (NOT another `coll_`).

   Applied to bookwriter, the existing schema IS compliant:

     * Book group:
         coll_book                 (primary collection — coll_)
         chapter                   (child of book)
         chapter_snapshot          (child of chapter)
         bible_entry               (child of book)
         plot_card                 (child of book)
         margin_note               (child of chapter)
         book_cover_design         (child of book)
     * Beta-workflow group:
         beta_share_link           (group prefix: beta_)
         beta_reader               (group prefix: beta_)
         beta_comment              (group prefix: beta_)
     * Engagement-serial group:
         engagement_serial_subscriber   (group prefix: engagement_serial_)
         engagement_serial_reaction     (group prefix)
         engagement_serial_comment      (group prefix)
         engagement_serial_view         (group prefix)
     * Session group:
         sprint_session            (group prefix: *_session)
         writing_session           (group prefix: *_session)
     * Serial publication group:
         serial_release            (group prefix: serial_)
     * Computed / derived:
         eng_user_streak           (eng_ prefix per Gate 7)
     * Reference (static):
         ref_*                     (14 tables, all correctly prefixed)

   The point of the prefix rule is data-lifecycle clarity at a
   glance, NOT exhaustive prefix labelling on every related table.
   Blanket-prefixing every child entity with `coll_` adds noise
   without clarifying anything (a reader still has to ask "child
   of what?" to make sense of `coll_chapter`).

   Action: NO MIGRATION NEEDED. Do not run this script.
   The bookwriter schema is compliant as currently shipped.

   See:
     - CLAUDE.md Gate 7 (the corrected rule wording).
     - notes/claude/memory-training/feedback_coll_prefix_main_table_only.md
       (the captured clarification, so this misinterpretation
       cannot recur).
   ============================================================ */
