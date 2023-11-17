// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";
import { FulfillmentMicroserviceStackProps } from "../../interface/fulfillment-microservice-props";
import { MicroserviceStack } from "../../abstract-class/microservice-stack";

var path = require("path");
export class FulfillmentStack extends MicroserviceStack {
  public readonly fulfillmentServiceDNS: string;
  public readonly fulfillmentServicePort: number;
  public readonly eventSource: string;
  public readonly eventDetailType: string;
  public readonly serviceName: string = "fulfillment";

  public readonly fulfillmentDockerImageAsset: DockerImageAsset;
  constructor(
    scope: Construct,
    id: string,
    props: FulfillmentMicroserviceStackProps
  ) {
    super(scope, id, props);

    const cluster = props.cluster;
    const tenantTier = props.tenantTier;
    const eventBus = props.eventBus;
    const tenantId = props.tenantId;
    const baseImage = props.baseImage;
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
      "FulfillmentServiceAccount",
      {
        name: "fulfillment-service-account",
        namespace: namespace,
      }
    );

    fulfillmentServiceAccount.node.children.forEach((child) => {   // ensure that namespace is created before fulfillmentServiceAccount
      if (props.namespaceConstruct) {
        child.node.addDependency(props.namespaceConstruct);
      }
    });

    fulfillmentServiceAccount.role.attachInlinePolicy(
      new iam.Policy(this, "FulfillmentServiceAccessPolicy", {
        statements: [
          new iam.PolicyStatement({
            actions: ["events:PutEvents"],
            resources: [eventBus.eventBusArn],
          }),
        ],
      })
    );

    const fulfillmentDeployment = cluster.addManifest("FulfillmentDeployment", {
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
            ...multiTenantLabels,
          },
        },
        replicas: 1,
        template: {
          metadata: {
            labels: {
              app: "fulfillment-app",
              ...multiTenantLabels,
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
    });
    fulfillmentDeployment.node.addDependency(fulfillmentServiceAccount);

    const fulfillmentService = cluster.addManifest("FulfillmentService", {
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
    });
    fulfillmentService.node.addDependency(fulfillmentDeployment);

    this.fulfillmentServicePort = 80;
    this.fulfillmentServiceDNS = `fulfillment-service.${namespace}.svc.cluster.local`;

    const fulfillmentVirtualService = cluster.addManifest(
      "FulfillmentVirtualService",
      {
        apiVersion: "networking.istio.io/v1alpha3",
        kind: "VirtualService",
        metadata: {
          name: "fulfillment-vs",
          namespace: namespace,
          labels: {
            ...multiTenantLabels,
          },
        },
        spec: {
          hosts: [this.fulfillmentServiceDNS],
          http: [
            {
              name: namespace.substring(0, 14),
              match: [
                {
                  uri: {
                    prefix: "/fulfillments",
                  },
                  /* // LAB4: REMOVE THIS LINE (routing)
                  headers: {
                    "x-app-tenant-tier": {
                      regex: tenantTier,
                    },
                    ...(tenantId && {
                      "x-app-tenant-id": {
                        regex: tenantId,
                      },
                    }),
                  },
                  */ // LAB4: REMOVE THIS LINE (routing)
                },
              ],
              route: [
                {
                  destination: {
                    host: this.fulfillmentServiceDNS,
                    port: {
                      number: this.fulfillmentServicePort,
                    },
                  },
                },
              ],
            },
          ],
        },
      }
    );
    fulfillmentVirtualService.node.addDependency(fulfillmentService);
  }
}
