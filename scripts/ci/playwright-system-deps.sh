#!/usr/bin/env bash
# CI stage 12a: the system packages and the browser for the E2E tests (DEF-015, AQP-206; test strategy 10.6).
#
# `playwright install --with-deps` ran apt-get against the runner's Ubuntu mirror on every run, with no bound, and a
# slow mirror stretched the required job by up to ten minutes. This script instead:
#
#   - on a cache HIT, installs the cached .deb files with `dpkg -i` and uses no network;
#   - on a MISS, or when the cached install fails, runs `playwright install-deps` with a bounded apt (a stalled package
#     is retried after 20 s, three times), then copies the .deb files that run downloaded into the cache directory,
#     which the cache action saves when the job succeeds. A bad cache therefore costs time and never fails the run.
#
# Then it installs the browser itself, which has its own cache and needs no system packages.
#
# Usage:   PLAYWRIGHT_DEBS_CACHE_HIT=true|false bash scripts/ci/playwright-system-deps.sh <cache-directory>
# Testable settings (tests/unit/playwright-system-deps.test.ts); the defaults are the runner's real paths:
#   APT_BOUNDS_FILE   where the apt settings are written   (/etc/apt/apt.conf.d/99-ci-bounds)
#   APT_ARCHIVES_DIR  where apt keeps downloaded packages   (/var/cache/apt/archives)
set -euo pipefail

cache_dir="${1:?usage: playwright-system-deps.sh <cache-directory>}"
cache_hit="${PLAYWRIGHT_DEBS_CACHE_HIT:-false}"
bounds_file="${APT_BOUNDS_FILE:-/etc/apt/apt.conf.d/99-ci-bounds}"
archives_dir="${APT_ARCHIVES_DIR:-/var/cache/apt/archives}"

mkdir -p "${cache_dir}"

# Hit path. Fails (so the caller falls back) when the directory holds no package or dpkg refuses one.
install_from_cache() {
  compgen -G "${cache_dir}/*.deb" > /dev/null || return 1
  sudo dpkg -i "${cache_dir}"/*.deb
}

# Miss path: a bounded apt, the normal Playwright install, then keep what it downloaded.
install_and_cache() {
  # A failed `dpkg -i` can leave packages half-installed; settle them before apt runs. Offline, and allowed to fail.
  sudo dpkg --configure -a || true
  printf 'Acquire::http::Timeout "20";\nAcquire::Retries "3";\n' | sudo tee "${bounds_file}" > /dev/null
  # apt stamps a package with the mirror's date, so "new" is decided by name, not by file time.
  local before
  before="$(mktemp)"
  find "${archives_dir}" -maxdepth 1 -name '*.deb' -printf '%f\n' | sort > "${before}"
  npx playwright install-deps chromium
  # Only packages this run downloaded: the image may hold others in the apt cache.
  find "${archives_dir}" -maxdepth 1 -name '*.deb' -printf '%f\n' | sort | comm -13 "${before}" - |
    while IFS= read -r name; do cp -- "${archives_dir}/${name}" "${cache_dir}/"; done
  rm -f "${before}"
  echo "Cached $(find "${cache_dir}" -maxdepth 1 -name '*.deb' | wc -l) system packages."
}

if [ "${cache_hit}" = "true" ]; then
  if install_from_cache; then
    echo "System packages installed from the cache, with no download."
  else
    echo "::warning::The cached system packages could not be installed; falling back to the normal install."
    rm -f "${cache_dir}"/*.deb
    install_and_cache
  fi
else
  install_and_cache
fi

npx playwright install chromium
