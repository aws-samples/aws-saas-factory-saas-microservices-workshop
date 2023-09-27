#!/bin/bash -xe

# screen -S s1 # new
# screen -x s1 # attach

# NOTE:
# remember to disable managed credentials for cloud9 before running!

# rm -vf ${HOME}/.aws/credentials

HOME_DIR="${HOME}/environment/aws-saas-factory-saas-microservices-workshop"

./run_lab1.sh $HOME_DIR

read -rp "Lab 1 complete. Press enter to continue..."

./run_lab2.sh $HOME_DIR

read -rp "Lab 2 complete. Press enter to continue..."

./run_lab3.sh $HOME_DIR

read -rp "Lab 3 complete. Press enter to continue..."

./run_lab4.sh $HOME_DIR

read -rp "Lab 4 complete. Press enter to continue..."

./run_lab5.sh $HOME_DIR

echo "All labs completed!"
