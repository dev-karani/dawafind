#!/usr/bin/env bash
# Local development PostgreSQL cluster living inside the project (.pgdata).
# Usage: bash scripts/db.sh start|stop|status|reset
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGDATA="$ROOT/.pgdata"
PORT="${DAWAFIND_DB_PORT:-5433}"
SOCK="$ROOT/.pgsock"

case "${1:-start}" in
  start)
    mkdir -p "$SOCK"
    if [ ! -d "$PGDATA" ]; then
      initdb -D "$PGDATA" -U dawafind --auth=trust --encoding=UTF8 >/dev/null
    fi
    if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
      pg_ctl -D "$PGDATA" -o "-p $PORT -k $SOCK -c listen_addresses=127.0.0.1" -l "$ROOT/.pgdata.log" -w start
    fi
    psql -h 127.0.0.1 -p "$PORT" -U dawafind -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='dawafind'" | grep -q 1 \
      || psql -h 127.0.0.1 -p "$PORT" -U dawafind -d postgres -c "CREATE DATABASE dawafind" >/dev/null
    echo "PostgreSQL ready: postgresql://dawafind@127.0.0.1:$PORT/dawafind"
    ;;
  reset)
    # Drops and recreates the LOCAL development database (never run against anything else).
    psql -h 127.0.0.1 -p "$PORT" -U dawafind -d postgres -c "DROP DATABASE IF EXISTS dawafind WITH (FORCE)" >/dev/null
    psql -h 127.0.0.1 -p "$PORT" -U dawafind -d postgres -c "CREATE DATABASE dawafind" >/dev/null
    echo "Local development database recreated."
    ;;
  stop)
    pg_ctl -D "$PGDATA" stop -m fast
    ;;
  status)
    pg_ctl -D "$PGDATA" status
    ;;
esac
