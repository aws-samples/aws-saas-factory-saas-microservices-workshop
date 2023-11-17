#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

kubectl delete pods -l app=product-app
kubectl delete serviceaccounts product-service-account
kubectl delete deployment product-app
kubectl delete service product-service
kubectl delete virtualservice product-vs
