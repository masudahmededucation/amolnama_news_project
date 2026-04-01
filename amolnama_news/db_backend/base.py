"""Custom mssql database backend.

Extends the mssql backend. Previously contained ntext/UTF-8 workarounds
that were removed because they corrupted Bengali Unicode data.

For large text fields, use CAST(? AS NVARCHAR(MAX)) in raw SQL instead.
"""

from mssql.base import DatabaseWrapper as MSSQLDatabaseWrapper


class DatabaseWrapper(MSSQLDatabaseWrapper):
    pass
