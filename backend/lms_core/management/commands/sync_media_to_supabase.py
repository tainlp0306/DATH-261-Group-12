from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Copy existing local media files to the configured storage without deleting local copies.'

    def handle(self, *args, **options):
        if not settings.SUPABASE_STORAGE_ENABLED:
            raise CommandError('Enable Supabase Storage before syncing existing media.')

        media_root = Path(settings.MEDIA_ROOT)
        if not media_root.is_dir():
            raise CommandError(f'Media directory does not exist: {media_root}')

        uploaded = 0
        skipped = 0
        for source_path in sorted(media_root.rglob('*')):
            if not source_path.is_file():
                continue

            storage_name = source_path.relative_to(media_root).as_posix()
            if default_storage.exists(storage_name):
                skipped += 1
                continue

            with source_path.open('rb') as source_file:
                default_storage.save(
                    storage_name,
                    File(source_file, name=storage_name),
                )
            uploaded += 1
            self.stdout.write(f'Uploaded {storage_name}')

        self.stdout.write(
            self.style.SUCCESS(
                f'Media sync complete: {uploaded} uploaded, {skipped} already present.'
            )
        )
