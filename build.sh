#!/bin/bash
# Builds the NIDZAM.COM Documenso image.
#   ./build.sh            -> documenso-nidzam:v2.20.0 from documenso/documenso:v2.20.0
#   ./build.sh v2.21.0    -> for an upgrade; the build fails if the patch no longer fits
set -euo pipefail
VERSION=${1:-v2.20.0}
cd "$(dirname "$0")"
docker pull "documenso/documenso:$VERSION"
docker build --pull=false --build-arg "BASE=documenso/documenso:$VERSION" -t "documenso-nidzam:$VERSION" .
docker run --rm --entrypoint cat "documenso-nidzam:$VERSION" /nidzam/patch-report.txt
echo "Built documenso-nidzam:$VERSION"
