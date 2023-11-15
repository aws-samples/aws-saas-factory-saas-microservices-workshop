#!/bin/bash -x

STACK_OPERATION="$1"

for i in {1..3}; do
    echo "iteration number: $i"
    bash -e _manage-workshop-stack-main.sh "$STACK_OPERATION" && break || sleep 15
done
