#!/usr/bin/env bash
# Memastikan Data API Supabase tidak mengembalikan data apa pun dengan kunci
# publik (PRD bagian 7 dan 13, D-12). Dipakai oleh .github/workflows/security.yml;
# bisa juga dijalankan manual:
#   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<kunci publik> ./scripts/check-rls.sh
# Kunci anon/publishable memang publik, tapi tetap jangan ditempel ke chat atau commit.
set -euo pipefail

: "${SUPABASE_URL:?SUPABASE_URL belum diatur}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY belum diatur}"

TABLES=(users sessions wallets categories transactions budgets category_rules user_category_settings goose_db_version)
fail=0

for t in "${TABLES[@]}"; do
  body=$(mktemp)
  code=$(curl -sS -o "$body" -w '%{http_code}' --max-time 20 \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    "${SUPABASE_URL%/}/rest/v1/${t}?select=*&limit=1")
  content=$(tr -d '[:space:]' < "$body")
  rm -f "$body"
  # Aman bila ditolak (401/403/404) atau berhasil tapi kosong ([]).
  if [[ "$code" =~ ^(401|403|404)$ ]] || [[ "$code" == "200" && "$content" == "[]" ]]; then
    echo "aman   $t (HTTP $code)"
  else
    echo "BOCOR  $t (HTTP $code): ${content:0:120}"
    fail=1
  fi
done

if [[ $fail -ne 0 ]]; then
  echo "::error::Ada tabel yang bisa dibaca lewat Data API dengan kunci publik."
  exit 1
fi
echo "Semua tabel tertutup untuk Data API."
