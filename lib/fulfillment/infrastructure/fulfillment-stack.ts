import * as cdk from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";
import { MicroserviceStackProps } from "../../interface/microservice-props";

var path = require("path");
export class FulfillmentStack extends Construct {
  public readonly fulfillmentServiceDNS: string;
  public readonly fulfillmentServicePort: number;

  public readonly fulfillmentDockerImageAsset: DockerImageAsset;
  constructor(scope: Construct, id: string, props?: MicroserviceStackProps) {
    super(scope, id);

    if (props?.cluster == undefined) {
      throw new Error("props.clusterInfo must be defined!");
    }

    const cluster = props.cluster;
    const tier = props.tier;
    const xrayServiceDNSAndPort = props.xrayServiceDNSAndPort;
    const cloudwatchAgentLogEndpoint = props.cloudwatchAgentLogEndpoint;
    const cloudwatchAgentLogGroupName = props.cloudwatchAgentLogGroupName;
    const tenantId = props.tenantId;
    const namespace = props.namespace; // from the ApplicationStack
    const multiTenantLabels = {
      tier: tier,
      ...(tenantId && { tenantId: tenantId }),
    };

    if (props.applicationImageAsset) {
      this.fulfillmentDockerImageAsset = props.applicationImageAsset;
    } else {
      const image = new DockerImageAsset(
        this,
        "saas-microservices-fulfillment-image",
        {
          directory: path.join(__dirname, "../app"),
        }
      );
      new cdk.CfnOutput(this, "image", {
        value: image.imageUri,
      });
      this.fulfillmentDockerImageAsset = image;
    }

    const queue = new sqs.Queue(this, "Queue", {
      queueName: `SaaS-Microservices-Orders-Fulfilled-${namespace}`,
      retentionPeriod: cdk.Duration.days(1),
    });

    const fulfillmentServiceAccount = cluster.addServiceAccount(
      "FulfillmentServiceAccount",
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
      new iam.Policy(this, "FulfillmentServiceAccessPolicy", {
        statements: [
          new iam.PolicyStatement({
            actions: ["sqs:SendMessage"],
            resources: [queue.queueArn],
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
                env: [
                  {
                    name: "QUEUE_URL",
                    value: queue.queueUrl,
                  },
                  {
                    name: "AWS_DEFAULT_REGION",
                    value: cdk.Stack.of(this).region,
                  },
                  {
                    name: "AWS_XRAY_DAEMON_ADDRESS",
                    value: xrayServiceDNSAndPort,
                  },
                  {
                    name: "AWS_EMF_AGENT_ENDPOINT",
                    value: cloudwatchAgentLogEndpoint,
                  },
                  {
                    name: "AWS_EMF_LOG_GROUP_NAME",
                    value: cloudwatchAgentLogGroupName,
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
                  {
                    name: "AWS_XRAY_SERVICE_NAME",
                    value: "FulfillmentService",
                  },
                ],
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
                    "x-app-tier": {
                      regex: tier,
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
