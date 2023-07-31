#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
CWD=$(pwd)

echo "Installing kubectl"
sudo curl --silent --no-progress-meter --location -o /usr/local/bin/kubectl \
  https://s3.us-west-2.amazonaws.com/amazon-eks/1.23.7/2022-06-29/bin/linux/amd64/kubectl

sudo chmod +x /usr/local/bin/kubectl
kubectl version --short --client

export NVM_DIR=$HOME/.nvm
source $NVM_DIR/nvm.sh

echo "Installing Node and CDK"
nvm install 16 2
nvm use 16
nvm alias default 16
npm install -g yarn --force

echo "Updating python3"
python3 -m pip install --user --upgrade pip

echo "Uninstalling AWS CLI 1.x"
sudo pip3 uninstall awscli -y

echo "Installing AWS CLI 2.x"
curl --no-progress-meter "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -qq awscliv2.zip
sudo ./aws/install --update
PATH=/usr/local/bin:$PATH
/usr/local/bin/aws --version
rm -rf aws awscliv2.zip

echo "Installing helper tools"
sudo yum -y install jq gettext bash-completion moreutils

export ACCOUNT_ID=$(aws sts get-caller-identity --output text --query Account)
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 10")
export AWS_REGION=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.region')
export AWS_DEFAULT_REGION=$AWS_REGION
test -n "$AWS_REGION" && echo AWS_REGION is "$AWS_REGION" || echo AWS_REGION is not set
echo "export ACCOUNT_ID=${ACCOUNT_ID}" | tee -a ~/.bash_profile
echo "export AWS_REGION=${AWS_REGION}" | tee -a ~/.bash_profile
echo "export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION}" | tee -a ~/.bash_profile
aws configure set default.region ${AWS_REGION}
aws configure get default.region
aws configure set cli_pager ""

echo "Resizing Cloud9 instance EBS Volume"
sh ./scripts/resize-cloud9-ebs-vol.sh 40

for command in kubectl jq envsubst aws; do
  which $command &>/dev/null && echo "$command in path" || echo "$command NOT FOUND"
done

kubectl completion bash >>~/.bash_completion
. /etc/profile.d/bash_completion.sh
. ~/.bash_completion

cd $CWD

aws sts get-caller-identity --query Arn | grep saas-factory-microservices-workshop-admin -q && echo "IAM role valid. Proceed." || echo "IAM role NOT valid. Do not proceed with creating the EKS Cluster or you won't be able to authenticate. Ensure you assigned the role to your EC2 instance as detailed in the workshop instructions"
