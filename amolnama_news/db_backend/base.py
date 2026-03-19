"""Custom mssql database backend — fixes ntext/UTF-8 collation conflict.

ODBC Driver 17 sends long strings as SQL_WLONGVARCHAR which SQL Server maps
to ntext.  The ntext legacy LOB type does NOT support UTF-8 or _SC collations,
causing:

    ProgrammingError: Cannot convert to text/ntext or collate to
    'Latin1_General_100_CI_AS_SC_UTF8' ...

Fix: override the cursor wrapper to call setinputsizes() before execute,
forcing string parameters to SQL_WVARCHAR (→ nvarchar) instead of
SQL_WLONGVARCHAR (→ ntext).
"""

import pyodbc as Database
from mssql.base import DatabaseWrapper as MSSQLDatabaseWrapper
from mssql.base import CursorWrapper as MSSQLCursorWrapper


class CursorWrapper(MSSQLCursorWrapper):
    """Cursor that forces nvarchar binding for all string parameters."""

    def execute(self, sql, params=None):
        self.last_sql = sql
        if 'GROUP BY' in sql:
            sql, params = self.format_group_by_params(sql, params)
        sql = self.format_sql(sql, params)
        params = self.format_params(params)
        self.last_params = params

        # Force every string param to SQL_WVARCHAR so pyodbc never picks
        # SQL_WLONGVARCHAR (ntext), which breaks UTF-8 collations.
        if params:
            raw = params if isinstance(params, (list, tuple)) else [params]
            sizes = []
            needs = False
            for p in raw:
                if isinstance(p, str):
                    sizes.append((Database.SQL_WVARCHAR, max(len(p), 1), 0))
                    needs = True
                else:
                    sizes.append(0)
            if needs:
                self.cursor.setinputsizes(sizes)

        try:
            return self.cursor.execute(sql, params)
        except Database.Error as e:
            self.connection._on_error(e)
            raise


class DatabaseWrapper(MSSQLDatabaseWrapper):
    def create_cursor(self, name=None):
        return CursorWrapper(self.connection.cursor(), self)
