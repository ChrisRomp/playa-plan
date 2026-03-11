#!/bin/bash

API_CI_ID="22809516200"
FRONTEND_CI_ID="22809516196"
POLL_INTERVAL=30
MAX_POLLS=120  # 1 hour timeout

echo "Starting CI run monitoring..."
echo "API CI Run ID: $API_CI_ID"
echo "Frontend CI Run ID: $FRONTEND_CI_ID"
echo ""

for i in $(seq 1 $MAX_POLLS); do
  echo "=== Poll #$i ($(date '+%H:%M:%S')) ==="
  
  echo "--- API CI Jobs ---"
  gh run view $API_CI_ID --json jobs --jq '.jobs[] | "\(.name) \(.status) \(.conclusion // "-")"' 2>/dev/null || echo "API CI data unavailable"
  
  echo ""
  echo "--- Frontend CI Jobs ---"
  gh run view $FRONTEND_CI_ID --json jobs --jq '.jobs[] | "\(.name) \(.status) \(.conclusion // "-")"' 2>/dev/null || echo "Frontend CI data unavailable"
  
  echo ""
  
  # Check if both are complete
  API_STATUS=$(gh run view $API_CI_ID --json status --jq '.status' 2>/dev/null)
  FRONTEND_STATUS=$(gh run view $FRONTEND_CI_ID --json status --jq '.status' 2>/dev/null)
  
  if [[ "$API_STATUS" != "in_progress" && "$FRONTEND_STATUS" != "in_progress" ]]; then
    echo "Both runs completed!"
    break
  fi
  
  if [[ $i -lt $MAX_POLLS ]]; then
    echo "Waiting ${POLL_INTERVAL}s before next poll..."
    sleep $POLL_INTERVAL
  fi
done

echo ""
echo "=== Final Status ==="
echo "API CI:"
gh run view $API_CI_ID --json status,conclusion --jq '{status, conclusion}'

echo ""
echo "Frontend CI:"
gh run view $FRONTEND_CI_ID --json status,conclusion --jq '{status, conclusion}'
