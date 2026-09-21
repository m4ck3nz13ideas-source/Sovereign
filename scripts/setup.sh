#!/usr/bin/env bash
#
# Sovereign — first-run setup.
#
#   ./scripts/setup.sh
#
# Installs dependencies, writes .env.local, and applies the migrations if you
# give it a database URL. Safe to run more than once: it never overwrites an
# existing .env.local without asking, and the migrations are written so that
# re-applying them fails loudly rather than half-succeeding.
#
# Two things this cannot do for you, and why:
#   - Create the Supabase project. It needs an account, and signing into one
#     on your behalf is not something a script should do.
#   - Add the redirect URL. It lives in the Supabase dashboard, and magic-link
#     sign-in fails silently without it — so the script checks at the end that
#     you have done it rather than letting you discover it later.

set -euo pipefail

cd "$(dirname "$0")/.."

bold=$'\033[1m'; dim=$'\033[2m'; gold=$'\033[33m'; red=$'\033[31m'; off=$'\033[0m'
say()  { printf '%s\n' "$*"; }
step() { printf '\n%s%s%s\n' "$bold" "$*" "$off"; }
warn() { printf '%s%s%s\n' "$red" "$*" "$off"; }
note() { printf '%s%s%s\n' "$dim" "$*" "$off"; }

say "${gold}Sovereign${off} — setup"

# ---------------------------------------------------------------- node
step "1. Checking Node"
if ! command -v node >/dev/null 2>&1; then
  warn "Node is not installed. Sovereign needs Node 20 or newer."
  say  "  macOS:  brew install node"
  exit 1
fi

node_major=$(node -p 'process.versions.node.split(".")[0]')
if [ "$node_major" -lt 20 ]; then
  warn "Node $(node -v) is too old. Sovereign needs 20 or newer."
  exit 1
fi
say "   Node $(node -v) on $(uname -s) $(uname -m)"

# -------------------------------------------------------- dependencies
step "2. Installing dependencies"
if [ -d node_modules ] && [ package-lock.json -ot node_modules ]; then
  say "   Already installed and up to date."
else
  # npm ci is reproducible and refuses to silently drift from the lockfile.
  npm ci
fi

# ------------------------------------------------------------ env file
step "3. Configuration"

if [ -f .env.local ]; then
  say "   .env.local already exists — leaving it alone."
  note "   Delete it and run this again if you want to start over."
else
  say "   Two values from your Supabase project. The Connect button at the top"
  say "   of the dashboard shows both, ready to paste; otherwise they are under"
  say "   Settings → API Keys."
  note "   If you have not made a project yet: supabase.com → New project."
  note "   Either key type works — a legacy 'anon' key or the newer"
  note "   sb_publishable_... one. Both are meant to be public; the row-level"
  note "   security policies are what protect the data, not the key."
  say ""

  read -r -p "   Project URL (https://xxxx.supabase.co): " supabase_url
  read -r -p "   Anon / publishable key: " supabase_key
  say ""
  note "   Optional. Without it, Sovereign runs an offline reviewer that walks"
  note "   the whole loop and labels every review it writes as unread by a model."
  read -r -p "   Anthropic API key (press enter to skip): " anthropic_key

  if [ -z "${supabase_url:-}" ] || [ -z "${supabase_key:-}" ]; then
    warn "Both Supabase values are required. Nothing written."
    exit 1
  fi

  # Strip a trailing slash so the SDK does not build double-slashed URLs.
  supabase_url="${supabase_url%/}"

  cat > .env.local <<EOF
# Written by scripts/setup.sh on $(date +%Y-%m-%d).
# Not committed — .gitignore covers .env*.

NEXT_PUBLIC_SUPABASE_URL=$supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=$supabase_key

ANTHROPIC_API_KEY=$anthropic_key
ANTHROPIC_MODEL=claude-sonnet-4-5

NEXT_PUBLIC_SITE_URL=http://localhost:3000
EOF

  chmod 600 .env.local
  say "   Written to .env.local"
  [ -z "${anthropic_key:-}" ] && note "   No model key — the offline reviewer will be used."
fi

# ---------------------------------------------------------- migrations
step "4. Database"

if command -v psql >/dev/null 2>&1; then
  say "   psql is available, so this can apply the migrations for you."
  note "   Settings → Database → Connection string, as a URI. It contains your"
  note "   database password, so it is used once here and never written to disk."
  say ""
  warn "   Use the DIRECT CONNECTION or SESSION POOLER string (port 5432)."
  note "   The transaction pooler on 6543 cannot run these migrations — it does"
  note "   not support the session-level features that create type, create"
  note "   function and the policy statements need. If you see errors about"
  note "   prepared statements or unsupported syntax, that is the wrong string."
  say ""
  read -r -p "   Database URL (press enter to do it by hand instead): " db_url || db_url=""

  # Anything that is not obviously a Postgres URL would otherwise be handed to
  # psql, which falls back to a local socket and produces a baffling error.
  case "${db_url:-}" in
    postgres://*|postgresql://*) ;;
    "") db_url="" ;;
    *)
      warn "   That does not look like a Postgres URL — it should start with"
      warn "   postgresql://. Skipping, so you can do this by hand."
      db_url=""
      ;;
  esac

  # Catching this here beats letting psql fail three statements into 0001 with
  # an error that does not name the real cause.
  case "${db_url:-}" in
    *:6543/*|*:6543\?*|*:6543)
      warn "   That is the transaction pooler (port 6543). It cannot run these"
      warn "   migrations. Go back to Settings → Database → Connection string"
      warn "   and take the direct connection or session pooler URI (port 5432)."
      say ""
      read -r -p "   Paste that one instead (or enter to skip): " db_url || db_url=""
      case "${db_url:-}" in
        postgres://*|postgresql://*) ;;
        *) db_url="" ;;
      esac
      ;;
  esac

  if [ -n "$db_url" ]; then
    applied=1
    for f in supabase/migrations/*.sql; do
      say "   Applying $(basename "$f")"
      # ON_ERROR_STOP so a half-applied migration is impossible. A failure here
      # must not abort the script: .env.local is already written, and the user
      # still needs the instructions below.
      if ! psql "$db_url" -v ON_ERROR_STOP=1 -q -f "$f"; then
        warn "   $(basename "$f") did not apply. Nothing after it was attempted."
        note "   A migration that has already been applied will fail this way —"
        note "   that is expected if you are re-running setup."
        applied=0
        break
      fi
    done

    if [ "$applied" = "1" ]; then
      say "   Migrations applied."

      say ""
      read -r -p "   Load the worked example too? [y/N] " seed || seed=""
      if [ "${seed:-}" = "y" ] || [ "${seed:-}" = "Y" ]; then
        note "   Sign in to Sovereign once first if you have not — the example"
        note "   attaches itself to the oldest profile in the database."
        if psql "$db_url" -v ON_ERROR_STOP=1 -q -f supabase/seed.sql; then
          say "   Example loaded. Remove it later with:"
          note "     delete from groups where slug = 'thursday-studio-example';"
          note "     delete from auth.users where email like '%@example.invalid';"
        else
          warn "   The example did not load. It needs at least one signed-in"
          warn "   account to attach itself to. Sign in, then run:"
          note "     psql \"\$DATABASE_URL\" -f supabase/seed.sql"
        fi
      fi
    else
      db_url=""
    fi
  fi
else
  note "   psql is not installed, so the migrations need doing by hand."
  db_url=""
fi

if [ -z "${db_url:-}" ]; then
  say "   In the Supabase SQL editor, paste and run these three, in order:"
  for f in supabase/migrations/*.sql; do
    say "     $f"
  done
fi

# ------------------------------------------------------------ redirect
step "5. One thing only you can do"
say "   In Supabase: Authentication → URL Configuration → Redirect URLs"
say "   Add:  ${bold}http://localhost:3000/auth/callback${off}"
say ""
warn "   Magic-link sign-in fails silently without this. It is the single"
warn "   most common reason a fresh Sovereign install seems broken."
say ""
read -r -p "   Added it? [y/N] " added
if [ "${added:-}" != "y" ] && [ "${added:-}" != "Y" ]; then
  note "   Fine — but sign-in will not work until you do."
fi

# ---------------------------------------------------------------- done
step "Ready"
say "   ${bold}npm run dev${off}   then open http://localhost:3000"
say ""
note "   npm run check   typecheck, lint, tests, build"
note "   docs/roadmap.md what this version is actually for"
