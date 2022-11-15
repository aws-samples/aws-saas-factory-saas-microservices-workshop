#!/bin/bash -x

HOSTNAME=$(kubectl get svc/istio-ingress -n istio-ingress -o=jsonpath="{.status.loadBalancer.ingress[0].hostname}")

echo "https://${HOSTNAME}"
