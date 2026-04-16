/*
  Biography — Rename ref_biography_person → coll_biography_person.
  People are added from user blog posts, not static admin data.
*/

-- 1. Drop FK
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_biography_entry_ref_person')
    ALTER TABLE [blog_biography].[coll_biography_entry] DROP CONSTRAINT FK_biography_entry_ref_person;
GO

-- 2. Rename PK column
EXEC sp_rename '[blog_biography].[ref_biography_person].[blog_biography_ref_biography_person_id]', 'blog_biography_coll_biography_person_id', 'COLUMN';
GO

-- 3. Rename FK column
EXEC sp_rename '[blog_biography].[coll_biography_entry].[link_blog_biography_ref_biography_person_id]', 'link_blog_biography_coll_biography_person_id', 'COLUMN';
GO

-- 4. Rename table
EXEC sp_rename '[blog_biography].[ref_biography_person]', 'coll_biography_person';
GO

-- 5. Recreate FK
ALTER TABLE [blog_biography].[coll_biography_entry]
    ADD CONSTRAINT FK_biography_entry_person
    FOREIGN KEY (link_blog_biography_coll_biography_person_id)
    REFERENCES [blog_biography].[coll_biography_person](blog_biography_coll_biography_person_id);
GO

-- 6. Update dictionary
EXEC sp_updateextendedproperty 'MS_Description',
  'Biography person subjects — people that biography entries are written about. Staff or users add new persons when creating biography posts. Grows with content.',
  'SCHEMA', 'blog_biography', 'TABLE', 'coll_biography_person';
GO

-- 7. Verify
SELECT name FROM sys.tables WHERE schema_id = SCHEMA_ID('blog_biography') ORDER BY name;
SELECT OBJECT_NAME(c.object_id), c.name FROM sys.columns c
WHERE c.name LIKE '%biography_person%' AND OBJECT_SCHEMA_NAME(c.object_id) = 'blog_biography';
