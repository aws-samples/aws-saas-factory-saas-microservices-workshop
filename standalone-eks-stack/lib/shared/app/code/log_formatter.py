import logging


class CustomFormatter(logging.Formatter):
    def __init__(self):
        super().__init__(
            fmt="[%(asctime)s] %(levelname)s in %(module)s: %(message)s")

    def format(self, record):
        format_orig = self._style._fmt

        if record.levelno == logging.INFO:
            self._style._fmt = "%(message)s"

        result = logging.Formatter.format(self, record)
        self._style._fmt = format_orig

        return result
