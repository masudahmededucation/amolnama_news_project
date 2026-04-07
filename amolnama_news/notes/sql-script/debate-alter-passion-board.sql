/* ================================================================
   ALTER: [blog_debate].[coll_topic]
   Add Passion Board columns — per-side aggregated stats
   Run AFTER the main debate-db-script.sql
   ================================================================ */

USE [news_magazine];
GO

/* Blue side stats */
ALTER TABLE [blog_debate].[coll_topic] ADD [blue_post_count]          INT NOT NULL CONSTRAINT [DF_debate_coll_topic_blue_post_count] DEFAULT ((0));
GO
ALTER TABLE [blog_debate].[coll_topic] ADD [blue_upvote_count]        INT NOT NULL CONSTRAINT [DF_debate_coll_topic_blue_upvote_count] DEFAULT ((0));
GO
ALTER TABLE [blog_debate].[coll_topic] ADD [blue_sentence_count]      INT NOT NULL CONSTRAINT [DF_debate_coll_topic_blue_sentence_count] DEFAULT ((0));
GO
ALTER TABLE [blog_debate].[coll_topic] ADD [blue_character_count]     INT NOT NULL CONSTRAINT [DF_debate_coll_topic_blue_character_count] DEFAULT ((0));
GO

/* Red side stats */
ALTER TABLE [blog_debate].[coll_topic] ADD [red_post_count]           INT NOT NULL CONSTRAINT [DF_debate_coll_topic_red_post_count] DEFAULT ((0));
GO
ALTER TABLE [blog_debate].[coll_topic] ADD [red_upvote_count]         INT NOT NULL CONSTRAINT [DF_debate_coll_topic_red_upvote_count] DEFAULT ((0));
GO
ALTER TABLE [blog_debate].[coll_topic] ADD [red_sentence_count]       INT NOT NULL CONSTRAINT [DF_debate_coll_topic_red_sentence_count] DEFAULT ((0));
GO
ALTER TABLE [blog_debate].[coll_topic] ADD [red_character_count]      INT NOT NULL CONSTRAINT [DF_debate_coll_topic_red_character_count] DEFAULT ((0));
GO

/* CHECK constraints */
ALTER TABLE [blog_debate].[coll_topic] ADD CONSTRAINT [CK_debate_coll_topic_blue_post_count] CHECK ([blue_post_count] >= 0);
GO
ALTER TABLE [blog_debate].[coll_topic] ADD CONSTRAINT [CK_debate_coll_topic_blue_upvote_count] CHECK ([blue_upvote_count] >= 0);
GO
ALTER TABLE [blog_debate].[coll_topic] ADD CONSTRAINT [CK_debate_coll_topic_blue_sentence_count] CHECK ([blue_sentence_count] >= 0);
GO
ALTER TABLE [blog_debate].[coll_topic] ADD CONSTRAINT [CK_debate_coll_topic_blue_character_count] CHECK ([blue_character_count] >= 0);
GO
ALTER TABLE [blog_debate].[coll_topic] ADD CONSTRAINT [CK_debate_coll_topic_red_post_count] CHECK ([red_post_count] >= 0);
GO
ALTER TABLE [blog_debate].[coll_topic] ADD CONSTRAINT [CK_debate_coll_topic_red_upvote_count] CHECK ([red_upvote_count] >= 0);
GO
ALTER TABLE [blog_debate].[coll_topic] ADD CONSTRAINT [CK_debate_coll_topic_red_sentence_count] CHECK ([red_sentence_count] >= 0);
GO
ALTER TABLE [blog_debate].[coll_topic] ADD CONSTRAINT [CK_debate_coll_topic_red_character_count] CHECK ([red_character_count] >= 0);
GO

/* ================================================================
   Passion Board columns per side:
   - blue/red_post_count       = total arguments + rebuttals per side
   - blue/red_upvote_count     = total upvotes across all posts per side ("Crowd Roar")
   - blue/red_sentence_count   = total sentences written per side ("Firepower")
   - blue/red_character_count  = total characters written per side ("Effort")

   These are cached aggregates — updated on every post/vote action.
   No expensive COUNT queries needed at render time.
   ================================================================ */
