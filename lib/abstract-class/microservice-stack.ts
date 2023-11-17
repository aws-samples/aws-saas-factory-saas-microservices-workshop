// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { MicroserviceStackProps } from "../interface/microservice-props";

type ContainerEnvs = (
  | {
      name: string;
      value: string;
    }
  | {
      name: string;
      valueFrom: { fieldRef: { fieldPath: string } };
    }
)[];

export abstract class MicroserviceStack extends Construct {
  public abstract serviceName: string;
  public readonly metricsNamespace: string = "workshop-metrics";
  private baseContainerEnvs: ContainerEnvs;

  combineWithBaseContainerEnvs(envs: ContainerEnvs): ContainerEnvs {
    return envs.concat(this.baseContainerEnvs, [
      {
        name: "SERVICE_NAME",
        value: this.serviceName,
      },
    ]);
  }

  constructor(scope: Construct, id: string, props: MicroserviceStackProps) {
    super(scope, id);

    this.baseContainerEnvs = [
      {
        name: "AWS_DEFAULT_REGION",
        value: cdk.Stack.of(this).region,
      },
      {
        name: "AWS_EMF_AGENT_ENDPOINT",
        value: props.cloudwatchAgentLogEndpoint,
      },
      {
        name: "AWS_EMF_NAMESPACE",
        value: this.metricsNamespace,
      },
      {
        name: "AWS_EMF_LOG_GROUP_NAME",
        value: props.cloudwatchAgentLogGroupName,
      },
      {
        name: "AWS_EMF_LOG_STREAM_NAME",
        valueFrom: {
          fieldRef: {
            fieldPath: "metadata.name",
          },
        },
      },
      {
        name: "POD_NAMESPACE",
        valueFrom: {
          fieldRef: {
            fieldPath: "metadata.namespace",
          },
        },
      },
    ];
  }
}
