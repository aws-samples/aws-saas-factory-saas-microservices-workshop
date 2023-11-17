// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { FulfillmentMicroserviceAdvancedTierStackProps } from "../../interface/fulfillment-microservice-advanced-tier-props";
import { MicroserviceStack } from "../../abstract-class/microservice-stack";
var path = require("path");

export class FulfillmentAdvancedTierStack extends MicroserviceStack {
  public readonly eventSource: string;
  public readonly eventDetailType: string;
  public readonly fulfillmentDockerImageAsset: DockerImageAsset;
  public serviceName: string = "fulfillment";
  constructor(
    scope: Construct,
    id: string,
    props: FulfillmentMicroserviceAdvancedTierStackProps
  ) {
    super(scope, id, props);

    const cluster = props.cluster;
    const eventBus = props.eventBus;
    const baseImage = props.baseImage;

    const tenantTier = props.tenantTier;
    const tenantId = props.tenantId;
    const namespace = props.namespace; // from the ApplicationStack
    const multiTenantLabels = {
      tenantTier: tenantTier,
      ...(tenantId && { tenantId: tenantId }),
    };

    this.eventSource = "fulfillment-service";
    this.eventDetailType = "order-fulfilled";

    if (props.applicationImageAsset) {
      this.fulfillmentDockerImageAsset = props.applicationImageAsset;
    } else {
      const image = new DockerImageAsset(
        this,
        "saas-microservices-fulfillment-image",
        {
          directory: path.join(__dirname, "../app"),
          ...(baseImage && {
            buildArgs: {
              BASE_IMAGE: baseImage,
            },
          }),
        }
      );
      new cdk.CfnOutput(this, "image", {
        value: image.imageUri,
      });
      this.fulfillmentDockerImageAsset = image;
    }

    const fulfillmentServiceAccount = cluster.addServiceAccount(
      "FulfillmentAdvServiceAccount",
      {
        name: "fulfillment-service-account",
        namespace: namespace,
      }
    );

    // ensure that namespace is created before fulfillmentServiceAccount
    fulfillmentServiceAccount.node.children.forEach((child) => {
      if (props.namespaceConstruct) {
        child.node.addDependency(props.namespaceConstruct);
      }
    });

    fulfillmentServiceAccount.role.attachInlinePolicy(
      new iam.Policy(this, "FulfillmentAccessPolicy", {
        statements: [
          new iam.PolicyStatement({
            actions: ["events:PutEvents"],
            resources: [eventBus.eventBusArn],
          }),
        ],
      })
    );

    const fulfillmentDeploymentAdvanced = cluster.addManifest(
      "FulfillmentDeploymentAdv",
      {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: {
          name: "fulfillment-app",
          namespace: namespace,
          labels: {
            ...multiTenantLabels,
          },
        },
        spec: {
          selector: {
            matchLabels: {
              app: "fulfillment-app",
              tenantTier: tenantTier,
              tenantId: tenantId,
            },
          },
          replicas: 1,
          template: {
            metadata: {
              labels: {
                app: "fulfillment-app",
                tenantTier: tenantTier,
                tenantId: tenantId,
              },
            },
            spec: {
              serviceAccountName: fulfillmentServiceAccount.serviceAccountName,
              containers: [
                {
                  name: "fulfillment-app",
                  image: this.fulfillmentDockerImageAsset.imageUri,
                  resources: {
                    requests: {
                      cpu: "100m",
                      memory: "250Mi",
                    },
                    limits: {
                      cpu: "150m",
                      memory: "300Mi",
                    },
                  },
                  livenessProbe: {
                    httpGet: {
                      path: "/fulfillments/health",
                      port: 8088,
                    },
                    initialDelaySeconds: 5,
                    timeoutSeconds: 5,
                    successThreshold: 1,
                    failureThreshold: 3,
                    periodSeconds: 10,
                  },
                  readinessProbe: {
                    httpGet: {
                      path: "/fulfillments/health",
                      port: 8088,
                    },
                    initialDelaySeconds: 5,
                    timeoutSeconds: 2,
                    successThreshold: 1,
                    failureThreshold: 3,
                    periodSeconds: 10,
                  },
                  env: this.combineWithBaseContainerEnvs([
                    {
                      name: "EVENT_BUS_NAME",
                      value: eventBus.eventBusName,
                    },
                    { name: "EVENT_SOURCE", value: this.eventSource },
                    { name: "EVENT_DETAIL_TYPE", value: this.eventDetailType },
                  ]),
                  ports: [
                    {
                      containerPort: 8088,
                      name: "fulfillment-app",
                    },
                  ],
                },
              ],
            },
          },
        },
      }
    );
    fulfillmentDeploymentAdvanced.node.addDependency(fulfillmentServiceAccount);

    const fulfillmentServiceAdvanced = cluster.addManifest(
      "FulfillmentServiceAdv",
      {
        kind: "Service",
        apiVersion: "v1",
        metadata: {
          name: "fulfillment-service",
          namespace: namespace,
          labels: {
            ...multiTenantLabels,
          },
        },
        spec: {
          selector: {
            app: "fulfillment-app",
          },
          ports: [
            {
              port: 80,
              targetPort: 8088,
            },
          ],
        },
      }
    );
    fulfillmentServiceAdvanced.node.addDependency(
      fulfillmentDeploymentAdvanced
    );

    // Instead of creating a separate virtual service, we simply patch the existing one.
    // This is because of an Istio limitation described here: https://github.com/istio/istio/issues/22997
    const virtualServicePatch = new eks.KubernetesPatch(
      this,
      "virtual-svc-patch-adv",
      {
        cluster: cluster,
        resourceName: "VirtualService/fulfillment-vs",
        resourceNamespace: "basic-pool",
        applyPatch: [
          {
            op: "add",
            path: "/spec/http/-",
            value: {
              name: `${namespace}`.substring(0, 14),
              match: [
                {
                  uri: {
                    prefix: "/fulfillments",
                  },
                  headers: {
                    "x-app-tenant-tier": {
                      regex: tenantTier,
                    },
                    "x-app-tenant-id": {
                      regex: tenantId,
                    },
                  },
                },
              ],
              route: [
                {
                  destination: {
                    host: `fulfillment-service.${namespace}.svc.cluster.local`,
                    port: {
                      number: 80,
                    },
                  },
                },
              ],
            },
          },
        ],
        restorePatch: [
          // just a dummy test in order to avoid marshall-ing errors that occur when passing just '{}'
          {
            op: "test",
            path: "/kind",
            value: "VirtualService",
          },
        ],
        patchType: eks.PatchType.JSON,
      }
    );
    virtualServicePatch.node.addDependency(fulfillmentServiceAdvanced);
  }
}
