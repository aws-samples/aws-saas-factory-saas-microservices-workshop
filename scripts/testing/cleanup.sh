#!/bin/bash

cd ~/environment/aws-saas-factory-saas-microservices-workshop
./destroy.sh

cd ~/environment/aws-saas-factory-saas-microservices-workshop/standalone-eks-stack
./destroy-cluster.sh

