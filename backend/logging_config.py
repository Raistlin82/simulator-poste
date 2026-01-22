"""
Structured logging configuration for production-ready applications
Supports both JSON logging (production) and pretty logging (development)
"""

import logging
import sys
import os
from pythonjsonlogger import jsonlogger


def setup_logging(level=None):
    """
    Setup structured logging for the application

    Args:
        level: Logging level (defaults based on environment)

    Returns:
        Configured logger instance
    """
    # Determine log level based on environment
    if level is None:
        env = os.getenv("ENVIRONMENT", "development")
        level = logging.DEBUG if env == "development" else logging.INFO

    # Get root logger
    logger = logging.getLogger()
    logger.setLevel(level)

    # Remove existing handlers to avoid duplicates
    logger.handlers = []

    # Create handler
    handler = logging.StreamHandler(sys.stdout)

    # Choose formatter based on environment
    env = os.getenv("ENVIRONMENT", "development")

    if env == "production":
        # JSON formatter for production (structured logs)
        formatter = jsonlogger.JsonFormatter(
            '%(asctime)s %(name)s %(levelname)s %(message)s',
            timestamp=True
        )
    else:
        # Pretty formatter for development
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

    handler.setFormatter(formatter)
    logger.addHandler(handler)

    return logger


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance for a specific module

    Args:
        name: Module name (usually __name__)

    Returns:
        Logger instance
    """
    return logging.getLogger(name)
