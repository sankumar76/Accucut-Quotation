#!/usr/bin/env bash
# CI stage 12a: the system packages and the browser for the E2E tests (DEF-015, AQP-206; AQP-216; test strategy 10.6).
#
# `playwright install --with-deps` ran apt-get against the runner's Ubuntu mirror on every run, with no bound, and a
# slow mirror stretched the required job by up to ten minutes. This script instead:
#
#   - on a cache HIT, installs the cached .deb files with `dpkg -i` and uses no network;
#   - on a MISS, or when the cached install fails, reads the package list from Playwright's dry run
#     (scripts/ci/playwright-deps-packages.sh) and DOWNLOADS the packages under `timeout`, then installs them offline and
#     copies the .deb files into the cache directory, which the cache action saves when the job succeeds. A bad cache
#     therefore costs time and never fails the run.
#
# The bound is on the download, not on the connection: `Acquire::http::Timeout` stops a dead connection but not a slow
# stream that is still alive. Each of up to three tries runs `apt-get update` (45 s) and then
# `apt-get install --download-only` (90 s) under `timeout`. A download-only run changes no installed package, so it is
# safe to stop, and a part-done download resumes. If the update fails or hits its limit, the try ends at once and the
# download is not attempted from a mirror that has just failed. After three failed tries the step fails and names the
# mirrors. The step itself has `timeout-minutes: 8` as the last bound (three tries take about 6.75 minutes at worst).
#
# One apt VIEW per try (QLT-95). The view is a temporary copy of the image's ubuntu.sources that names only the mirror of
# this try (the runner's own on try 1, archive.ubuntu.com on tries 2 and 3; apt still checks the signed Release files, as
# `Signed-By` is kept) and a package-list directory of its own. All three apt commands of the try (update, download-only,
# offline install) take the same view through `-o Dir::Etc::SourceList=/dev/null -o Dir::Etc::SourceParts=... -o
# Dir::State::Lists=...`. `apt-get update --error-on=any` then fails exactly when this mirror cannot be reached: without
# the flag a dead mirror is only a warning and exit status 0 (seen on the runner), and with the runner's full source list a
# transient failure of a third-party source would fail the try. The runner's own sources and package lists are never
# touched. The downloaded .deb files still land in /var/cache/apt/archives and are cached as before.
#
# If the dry run holds no install command and no report, or the image has no ubuntu.sources, the script warns and takes the
# bounded AQP-206 path instead (`playwright install-deps chromium` with a 20 s stall timeout); it does not fail.
#
# A cache key is immutable and a hit is never saved again, so a bad entry is not replaced by a later run. The fallback
# warning therefore names the key and the command that deletes it; see README, "Playwright install cache".
#
# Then it installs the browser itself, which has its own cache and needs no system packages.
#
# Usage:   PLAYWRIGHT_DEBS_CACHE_HIT=true|false PLAYWRIGHT_DEBS_CACHE_KEY=<key> \
#            bash scripts/ci/playwright-system-deps.sh <cache-directory>
# Testable settings (tests/unit/playwright-system-deps.test.ts); the defaults are the runner's real values:
#   APT_BOUNDS_FILE         where the apt settings are written    (/etc/apt/apt.conf.d/99-ci-bounds)
#   APT_ARCHIVES_DIR        where apt keeps downloaded packages    (/var/cache/apt/archives)
#   APT_SOURCES_DIR         where apt keeps its sources, read only (/etc/apt)
#   APT_UPDATE_TIMEOUT      seconds allowed for `apt-get update`   (45)
#   APT_DOWNLOAD_TIMEOUT    seconds allowed for the download       (90)
set -euo pipefail

cache_dir="${1:?usage: playwright-system-deps.sh <cache-directory>}"
cache_hit="${PLAYWRIGHT_DEBS_CACHE_HIT:-false}"
cache_key="${PLAYWRIGHT_DEBS_CACHE_KEY:-unknown}"
bounds_file="${APT_BOUNDS_FILE:-/etc/apt/apt.conf.d/99-ci-bounds}"
archives_dir="${APT_ARCHIVES_DIR:-/var/cache/apt/archives}"
sources_dir="${APT_SOURCES_DIR:-/etc/apt}"
update_timeout="${APT_UPDATE_TIMEOUT:-60}"
download_timeout="${APT_DOWNLOAD_TIMEOUT:-90}"
fallback_mirror="archive.ubuntu.com"
max_tries=3
sources_file="${sources_dir}/sources.list.d/ubuntu.sources"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The list of packages present before the install, and the apt view of the current try. Both are removed on every exit,
# including a failed install (STD-04). apt runs as root and writes root-owned files into the view (lists/auxfiles), so the
# view is removed with sudo; a cleanup problem must never turn a good install into a failed step.
before=""
view=""
apt_view=()
trap 'rm -f -- "${before}"; sudo rm -rf -- "${view}" || true' EXIT

mkdir -p "${cache_dir}"

# Hit path. Fails (so the caller falls back) when the directory holds no package or dpkg refuses one.
install_from_cache() {
  compgen -G "${cache_dir}/*.deb" > /dev/null || return 1
  sudo dpkg -i "${cache_dir}"/*.deb
}

# The first source of the image, for the message that names the mirrors: the host name of an http(s) address, or the value
# as written (`mirror+file:/etc/apt/apt-mirrors.txt` on the runner image).
first_mirror() {
  local key value uri=""
  while read -r key value _; do
    if [ "${key}" = "URIs:" ]; then
      uri="${value}"
      break
    fi
  done < "${sources_file}"
  case "${uri}" in
    http://* | https://*) uri="${uri#*://}"; echo "${uri%%/*}" ;;
    '') echo "the mirror of the runner image" ;;
    *) echo "${uri}" ;;
  esac
}

# A new apt view for one try: 'image' keeps the image's own source (the runner's mirror), 'fallback' points every URIs line
# at archive.ubuntu.com. The directory is readable by the `_apt` download user; apt makes its own `partial` directory
# writable for it.
make_view() {
  sudo rm -rf -- "${view}"
  view="$(mktemp -d)"
  chmod 755 "${view}"
  mkdir -p "${view}/sources.list.d" "${view}/lists/partial"
  if [ "$1" = fallback ]; then
    sed -E "s#^URIs:.*#URIs: http://${fallback_mirror}/ubuntu/#" "${sources_file}" > "${view}/sources.list.d/ubuntu.sources"
  else
    cp -- "${sources_file}" "${view}/sources.list.d/ubuntu.sources"
  fi
  apt_view=(-o Dir::Etc::SourceList=/dev/null -o "Dir::Etc::SourceParts=${view}/sources.list.d" -o "Dir::State::Lists=${view}/lists")
}

# Runs the dry run and parses it. Prints the package names; fails when the output holds neither an install command nor a
# report. The dry run exits non-zero when packages are missing, so its status is not used.
list_packages() {
  local dry_run
  dry_run="$(npx playwright install-deps --dry-run chromium 2>&1 || true)"
  printf '%s\n' "${dry_run}" | bash "${script_dir}/playwright-deps-packages.sh"
}

# One try: update, then download, both in this try's apt view. Either step failing or reaching its limit ends the try; the
# download is not started after a failed update.
try_download() {
  local started="${SECONDS}" status=0 what
  sudo timeout "${update_timeout}" apt-get update "${apt_view[@]}" --error-on=any || status=$?
  if [ "${status}" -ne 0 ]; then
    what="failed with status ${status}"
    [ "${status}" -eq 124 ] && what="reached its ${update_timeout} s limit"
    echo "apt-get update ${what} after $((SECONDS - started)) s; ending this try."
    return 1
  fi
  echo "apt-get update took $((SECONDS - started)) s."
  started="${SECONDS}"
  sudo timeout "${download_timeout}" apt-get install --download-only -y --no-install-recommends "${apt_view[@]}" "$@" || status=$?
  if [ "${status}" -ne 0 ]; then
    what="failed with status ${status}"
    [ "${status}" -eq 124 ] && what="reached its ${download_timeout} s limit"
    echo "The download ${what} after $((SECONDS - started)) s; ending this try."
    return 1
  fi
  echo "The download took $((SECONDS - started)) s."
}

# Miss path, normal case: up to three bounded tries, then an offline install of what was downloaded, in the view of the
# try that downloaded it.
download_and_install() {
  local try kind=image mirror mirrors=""
  mirror="$(first_mirror)"
  for try in $(seq 1 "${max_tries}"); do
    if [ "${try}" -gt 1 ]; then
      mirror="${fallback_mirror}"
      kind=fallback
    fi
    make_view "${kind}"
    mirrors="${mirrors:+${mirrors}, }${mirror}"
    echo "Try ${try} of ${max_tries}, mirror ${mirror}."
    if try_download "$@"; then
      sudo apt-get install -y --no-download --no-install-recommends "${apt_view[@]}" "$@"
      return 0
    fi
  done
  echo "::error::The system packages could not be downloaded in ${max_tries} tries (mirrors tried: ${mirrors}). Nothing was installed. Re-run the job; if it fails again, check the status of those mirrors."
  return 1
}

# Miss path, fallback: the bounded install of AQP-206, used when the dry run cannot be read or the image has no
# ubuntu.sources to build the mirror views from.
bounded_install_deps() {
  npx playwright install-deps chromium
}

# Miss path: bound apt, install the packages, then keep what was downloaded.
install_and_cache() {
  local packages
  # A failed `dpkg -i` can leave packages half-installed; settle them before apt runs. Offline, and allowed to fail.
  sudo dpkg --configure -a || true
  printf 'Acquire::http::Timeout "20";\nAcquire::Retries "3";\n' | sudo tee "${bounds_file}" > /dev/null
  # apt stamps a package with the mirror's date, so "new" is decided by name, not by file time.
  before="$(mktemp)"
  find "${archives_dir}" -maxdepth 1 -name '*.deb' -printf '%f\n' | sort > "${before}"
  if packages="$(list_packages)"; then
    if [ -z "${packages}" ]; then
      echo "Playwright reports no missing system package; nothing to download."
    elif [ ! -f "${sources_file}" ]; then
      echo "::warning::${sources_file} does not exist on this image, so no mirror view can be built; taking the bounded install of the system packages instead."
      bounded_install_deps
    else
      local names=()
      mapfile -t names <<< "${packages}"
      echo "Missing system packages (${#names[@]}): ${names[*]}"
      download_and_install "${names[@]}"
    fi
  else
    echo "::warning::The output of 'playwright install-deps --dry-run' holds no install command and no dependency report; taking the bounded install of the system packages instead (the Playwright update may have changed the output)."
    bounded_install_deps
  fi
  # Only packages this run downloaded: the image may hold others in the apt cache.
  find "${archives_dir}" -maxdepth 1 -name '*.deb' -printf '%f\n' | sort | comm -13 "${before}" - |
    while IFS= read -r name; do cp -- "${archives_dir}/${name}" "${cache_dir}/"; done
  echo "Cached $(find "${cache_dir}" -maxdepth 1 -name '*.deb' | wc -l) system packages."
}

if [ "${cache_hit}" = "true" ]; then
  if install_from_cache; then
    echo "System packages installed from the cache, with no download."
  else
    echo "::warning::The cached system packages could not be installed (cache key ${cache_key}); falling back to the normal install. The entry stays until it is deleted: a maintainer runs 'gh cache delete ${cache_key}', or raises CACHE_EPOCH in ci.yml."
    rm -f "${cache_dir}"/*.deb
    install_and_cache
  fi
else
  install_and_cache
fi

npx playwright install chromium
