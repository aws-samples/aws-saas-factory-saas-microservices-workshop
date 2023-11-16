#!/bin/bash -x

STACK_OPERATION="$1"

for i in {1..3}; do
    echo "iteration number: $i"
    if bash -e _manage-workshop-stack.sh "$STACK_OPERATION" "$REPO_URL" "$REPO_BRANCH_NAME"; then
        break
    else
        sleep "$((15*i))"
    fi
done
