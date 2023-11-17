#!/bin/bash -x
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

HOSTNAME=$(kubectl get svc/istio-ingress -n istio-ingress -o=jsonpath="{.status.loadBalancer.ingress[0].hostname}")

echo "https://${HOSTNAME}"
