#!/bin/sh
chown -R node:node /app/data /app/data-home 2>/dev/null
exec su-exec node "$@"
