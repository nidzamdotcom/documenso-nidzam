# NIDZAM.COM build of Documenso: the official image with logos, icons and
# product name replaced. No recompiling; patch-nidzam.mjs rewrites built files.
# Build with ./build.sh (it pins the base version and tags the result).
ARG BASE=documenso/documenso:v2.20.0
# Patched Node from the official image, on the same Alpine release as the
# Documenso base (3.23). Bump this when Node ships a security release before
# Documenso does; drop it once the base already has an equal or newer Node.
ARG NODE=node:24.22.1-alpine3.23
FROM ${NODE} AS node
FROM ${BASE}
ARG BASE

USER root
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN node -v
COPY assets/ /nidzam/
COPY patch-nidzam.mjs /nidzam/patch-nidzam.mjs

# Static branding files: browser/phone icons, link preview, web manifest, and
# static/logo.png (certificate, audit log and default email logo). Each goes
# over both copies: public/ (read by the PDF renderers) and build/client/ (served).
RUN set -e; cd /nidzam/branding; \
    for f in $(find . -type f | sed 's|^\./||'); do \
      cp "$f" "/app/apps/remix/public/$f"; \
      cp "$f" "/app/apps/remix/build/client/$f"; \
    done; \
    node /nidzam/patch-nidzam.mjs; \
    checked=0; \
    for f in $(find /app/apps/remix/build -type f \( -name '*.js' -o -name '*.mjs' \) -exec grep -l "NIDZAM.COM" {} +); do \
      node --check "$f" || { echo "syntax check failed: $f"; exit 1; }; \
      checked=$((checked + 1)); \
    done; \
    [ "$checked" -gt 50 ] || { echo "syntax check covered only $checked files"; exit 1; }; \
    echo "syntax-checked $checked files" >> /nidzam/patch-report.txt; \
    chown -R nodejs:nodejs /app/apps/remix/public /app/apps/remix/build

LABEL com.nidzam.documenso.base="${BASE}"
USER nodejs
