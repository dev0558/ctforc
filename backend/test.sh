#!/bin/bash
# CTF Orchestrator - End-to-End Pipeline Test
# Usage: bash test.sh [base_url]

BASE_URL="${1:-http://localhost:3001}"
PASS=0
FAIL=0

green() { echo -e "\033[32m$1\033[0m"; }
red() { echo -e "\033[31m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }
bold() { echo -e "\033[1m$1\033[0m"; }

check() {
  if [ $1 -eq 0 ]; then
    green "  PASS: $2"
    PASS=$((PASS + 1))
  else
    red "  FAIL: $2"
    FAIL=$((FAIL + 1))
  fi
}

bold "========================================="
bold "  CTF Orchestrator Pipeline Test"
bold "========================================="
echo ""

# 1. Health check
bold "[1/8] Health Check"
HEALTH=$(curl -s "$BASE_URL/api/health")
echo "$HEALTH" | grep -q '"status":"ok"'
check $? "GET /api/health returns ok"
echo ""

# 2. Submit CVE batch
bold "[2/8] Submit CVE Batch"
SUBMIT=$(curl -s -X POST "$BASE_URL/api/implement" \
  -H "Content-Type: application/json" \
  -d '{"mode":"cve","items":["CVE-2023-22527","CVE-2024-50379","CVE-2023-44487"]}')
echo "$SUBMIT" | grep -q '"batch_id"'
check $? "POST /api/implement returns batch_id"

BATCH_ID=$(echo "$SUBMIT" | grep -o '"batch_id":"[^"]*"' | cut -d'"' -f4)
JOB1=$(echo "$SUBMIT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
JOB2=$(echo "$SUBMIT" | grep -o '"id":"[^"]*"' | head -2 | tail -1 | cut -d'"' -f4)
JOB3=$(echo "$SUBMIT" | grep -o '"id":"[^"]*"' | head -3 | tail -1 | cut -d'"' -f4)

yellow "  Batch: $BATCH_ID"
yellow "  Jobs: $JOB1, $JOB2, $JOB3"
echo ""

# 3. Wait for research to complete
bold "[3/8] Waiting for Research Workers (max 15s)..."
for i in $(seq 1 15); do
  JOBS=$(curl -s "$BASE_URL/api/jobs?batchId=$BATCH_ID")
  PENDING=$(echo "$JOBS" | grep -o '"pending_spec_review"' | wc -l)
  if [ "$PENDING" -ge 3 ]; then
    break
  fi
  sleep 1
  echo -n "."
done
echo ""

JOBS=$(curl -s "$BASE_URL/api/jobs?batchId=$BATCH_ID")
PENDING=$(echo "$JOBS" | grep -o '"pending_spec_review"' | wc -l)
[ "$PENDING" -ge 3 ]
check $? "All 3 jobs reached pending_spec_review (found $PENDING)"
echo ""

# 4. Get and review specs
bold "[4/8] Review Specs"
SPEC=$(curl -s "$BASE_URL/api/specs/$JOB1")
echo "$SPEC" | grep -q '"spec_json"'
check $? "GET /api/specs/$JOB1 returns spec"

# Approve first job
REVIEW1=$(curl -s -X POST "$BASE_URL/api/specs/$JOB1/review" \
  -H "Content-Type: application/json" \
  -d '{"action":"approve","notes":"Looks good"}')
echo "$REVIEW1" | grep -q '"spec_approved"'
check $? "POST spec review approve -> spec_approved"

# Reject second job
REVIEW2=$(curl -s -X POST "$BASE_URL/api/specs/$JOB2/review" \
  -H "Content-Type: application/json" \
  -d '{"action":"reject","notes":"Needs more detail"}')
echo "$REVIEW2" | grep -q '"rejected"'
check $? "POST spec review reject -> rejected"

# Approve third job
REVIEW3=$(curl -s -X POST "$BASE_URL/api/specs/$JOB3/review" \
  -H "Content-Type: application/json" \
  -d '{"action":"approve"}')
echo "$REVIEW3" | grep -q '"spec_approved"'
check $? "POST spec review approve (job3) -> spec_approved"
echo ""

# 5. Wait for builds
bold "[5/8] Waiting for Build Workers (max 20s)..."
for i in $(seq 1 20); do
  JOB1_DATA=$(curl -s "$BASE_URL/api/jobs/$JOB1")
  STATUS=$(echo "$JOB1_DATA" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ "$STATUS" = "pending_build_review" ]; then
    break
  fi
  sleep 1
  echo -n "."
done
echo ""

JOB1_DATA=$(curl -s "$BASE_URL/api/jobs/$JOB1")
echo "$JOB1_DATA" | grep -q '"pending_build_review"'
check $? "Job 1 reached pending_build_review"
echo ""

# 6. Review builds
bold "[6/8] Review Builds"
CHALLENGE=$(curl -s "$BASE_URL/api/challenges/$JOB1")
echo "$CHALLENGE" | grep -q '"file_manifest"'
check $? "GET /api/challenges/$JOB1 returns challenge"

BUILD_REVIEW=$(curl -s -X POST "$BASE_URL/api/challenges/$JOB1/review" \
  -H "Content-Type: application/json" \
  -d '{"action":"approve","notes":"Challenge looks great"}')
echo "$BUILD_REVIEW" | grep -q '"ready"'
check $? "POST build review approve -> ready"
echo ""

# 7. Verify final state
bold "[7/8] Verify Final States"
JOB1_FINAL=$(curl -s "$BASE_URL/api/jobs/$JOB1")
echo "$JOB1_FINAL" | grep -q '"status":"ready"'
check $? "Job 1 final status is ready"

JOB2_FINAL=$(curl -s "$BASE_URL/api/jobs/$JOB2")
echo "$JOB2_FINAL" | grep -q '"status":"rejected"'
check $? "Job 2 final status is rejected"

# Check job detail has reviews
echo "$JOB1_FINAL" | grep -q '"reviews"'
check $? "Job detail includes reviews"
echo ""

# 8. Stats
bold "[8/8] Dashboard Stats"
STATS=$(curl -s "$BASE_URL/api/stats")
echo "$STATS" | grep -q '"totalJobs"'
check $? "GET /api/stats returns stats"
yellow "  Stats: $STATS"
echo ""

# Summary
bold "========================================="
bold "  Results: $PASS passed, $FAIL failed"
bold "========================================="

if [ $FAIL -gt 0 ]; then
  red "Some tests failed!"
  exit 1
else
  green "All tests passed!"
  exit 0
fi
