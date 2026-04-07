"""Newsengine utilities — shared background processing helpers."""


def run_background_task(target_function, *args):
    """Run a function in a background daemon thread. Shared helper to avoid
    repeating 'import threading; threading.Thread(target=..., daemon=True).start()' everywhere."""
    import threading
    threading.Thread(target=target_function, args=args, daemon=True).start()
