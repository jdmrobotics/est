#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "EcoSurvey Field App at http://localhost:8080/index.html"
python3 -m http.server 8080
