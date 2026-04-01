"""Management command — runs the folder watcher for text extraction.

Usage: python manage.py run_textextractor
"""

import logging
import os
import threading
import time

from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Start the Text Extractor folder watcher — monitors input folders for new files.'

    def handle(self, *args, **options):
        from amolnama_news.site_apps.textextractor.models import ConfigFolderWatcher
        from amolnama_news.site_apps.textextractor.processor import (
            create_job_from_file, process_extraction_job, wait_for_file_copy,
        )
        from amolnama_news.site_apps.textextractor.engines import get_engine_code_for_extension

        # Get active watchers from config table
        watchers = ConfigFolderWatcher.objects.filter(is_active=True)

        if not watchers:
            self.stdout.write(self.style.WARNING('No active folder watchers configured.'))
            return

        self.stdout.write(self.style.SUCCESS(f'Text Extractor: Starting {len(watchers)} watcher(s)...'))

        try:
            from watchdog.observers import Observer
            from watchdog.events import FileSystemEventHandler
        except ImportError:
            self.stdout.write(self.style.ERROR('watchdog not installed. Run: pip install watchdog'))
            return

        class ExtractionFileHandler(FileSystemEventHandler):
            def __init__(self, watcher_config):
                self.watcher_id = watcher_config.textextractor_config_folder_watcher_id
                self.supported_extensions = [
                    extension.strip().lower()
                    for extension in watcher_config.supported_extensions.split(',')
                    if extension.strip()
                ]

            def on_created(self, event):
                if event.is_directory:
                    return
                file_path = event.src_path
                file_extension = os.path.splitext(file_path)[1].lower()

                if file_extension not in self.supported_extensions:
                    return

                if not get_engine_code_for_extension(file_extension):
                    return

                logger.info('Detected new file: %s', file_path)

                # Wait for file copy to complete
                if not wait_for_file_copy(file_path):
                    logger.warning('File copy timeout: %s', file_path)
                    return

                # Create job and process in background
                job_id = create_job_from_file(
                    file_path, folder_watcher_id=self.watcher_id,
                )
                threading.Thread(
                    target=process_extraction_job,
                    args=(job_id,),
                    daemon=True,
                ).start()

                logger.info('Job %s created for %s', job_id, os.path.basename(file_path))

        observer = Observer()

        for watcher in watchers:
            input_path = watcher.input_folder_path
            os.makedirs(input_path, exist_ok=True)
            os.makedirs(watcher.output_folder_path, exist_ok=True)

            handler = ExtractionFileHandler(watcher)
            observer.schedule(handler, input_path, recursive=False)
            self.stdout.write(f'  Watching: {input_path}')

        observer.start()
        self.stdout.write(self.style.SUCCESS('Text Extractor: Active & Listening...'))

        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            observer.stop()
            self.stdout.write(self.style.WARNING('Text Extractor: Stopped.'))

        observer.join()
