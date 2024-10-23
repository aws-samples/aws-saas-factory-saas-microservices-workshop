#!/bin/bash -xe
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
CWD=$(pwd)

MISE_VERSION="v2024.10.2" # https://mise.jdx.dev/getting-started.html#alternate-installation-methods
curl https://mise.run | sh
echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc
source ~/.bashrc
mise install

eval "$(mise activate bash --shims)" # use shims to initialize shell for script

echo "Installing kubectl"
sudo curl --silent --no-progress-meter --location -o /usr/local/bin/kubectl \
  https://s3.us-west-2.amazonaws.com/amazon-eks/1.31.0/2024-09-12/bin/linux/amd64/kubectl

sudo chmod +x /usr/local/bin/kubectl
kubectl version --client

echo "Installing AWS CLI 2.x"
curl --no-progress-meter "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -qq awscliv2.zip
sudo ./aws/install --update
PATH=/usr/local/bin:$PATH
/usr/local/bin/aws --version
rm -rf aws awscliv2.zip

echo "Installing helper tools"
sudo apt-get update
sudo apt-get install -y jq gettext bash-completion moreutils

export ACCOUNT_ID=$(aws sts get-caller-identity --output text --query Account)
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 10")
export AWS_REGION=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.region')
export AWS_DEFAULT_REGION=$AWS_REGION
test -n "$AWS_REGION" && echo AWS_REGION is "$AWS_REGION" || echo AWS_REGION is not set
echo "export ACCOUNT_ID=${ACCOUNT_ID}"  >> ~/.bashrc
echo "export AWS_REGION=${AWS_REGION}"  >> ~/.bashrc
echo "export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION}"  >> ~/.bashrc
echo "export CDK_DISABLE_VERSION_CHECK=true"  >> ~/.bashrc
aws configure set default.region ${AWS_REGION}
aws configure get default.region
aws configure set cli_pager ""

echo "Resizing Cloud9 instance EBS Volume"
bash ./scripts/resize-cloud9-ebs-vol.sh 40

for command in kubectl jq envsubst aws; do
  which $command &>/dev/null && echo "$command in path" || echo "$command NOT FOUND"
done

kubectl completion bash >>~/.bash_completion
. /etc/profile.d/bash_completion.sh
. ~/.bash_completion

cd $CWD

# overwrite any existing cdk versions
CDK_VERSION="2.147.3"
sudo npm install --force --global aws-cdk@$CDK_VERSION

INSTANCE_ROLE_NAME=$(aws ssm get-parameter --name "/workshop/cloud9InstanceRoleName" --region "$AWS_REGION" --query 'Parameter.Value' --output text)
aws sts get-caller-identity --query Arn | grep "$INSTANCE_ROLE_NAME" -q &&
  echo "IAM role valid. Proceed." ||
  echo "IAM role NOT valid. Do not proceed with creating the EKS Cluster or you won't be able to authenticate. Ensure you assigned the role to your EC2 instance as detailed in the workshop instructions"
