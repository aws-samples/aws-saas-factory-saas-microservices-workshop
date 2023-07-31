import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { FulfillmentMicroserviceAdvancedTierStackProps } from "../../interface/fulfillment-microservice-advanced-tier-props";

export class FulfillmentAdvancedTierStack extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: FulfillmentMicroserviceAdvancedTierStackProps
  ) {
    super(scope, id);

    if (props?.cluster == undefined) {
      throw new Error("props.clusterInfo must be defined!");
    }

    const cluster = props.cluster;
    const fulfillmentDockerImageAsset = props.fulfillmentDockerImageAsset;

    const tier = props.tier;
    const tenantId = props.tenantId;
    const namespace = props.namespace; // from the ApplicationStack
    const multiTenantLabels = {
      tier: tier,
      ...(tenantId && { tenantId: tenantId }),
    };

    const queue = new sqs.Queue(this, "Queue", {
      queueName: `SaaS-Microservices-Orders-Fulfilled-${namespace}`,
      retentionPeriod: cdk.Duration.days(1),
    });

    const fulfillmentServiceAccount = cluster.addServiceAccount(
      "FulfillmentAdvServiceAccount",
      {
        name: "fulfillment-service-account",
        namespace: namespace,
      }
    );

    fulfillmentServiceAccount.role.attachInlinePolicy(
      new iam.Policy(this, "FulfillmentAccessPolicy", {
        statements: [
          new iam.PolicyStatement({
            actions: ["sqs:SendMessage"],
            resources: [queue.queueArn],
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
              tier: tier,
              tenantId: tenantId,
            },
          },
          replicas: 1,
          template: {
            metadata: {
              labels: {
                app: "fulfillment-app",
                tier: tier,
                tenantId: tenantId,
              },
            },
            spec: {
              serviceAccountName: fulfillmentServiceAccount.serviceAccountName,
              containers: [
                {
                  name: "fulfillment-app",
                  image: fulfillmentDockerImageAsset.imageUri,
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
                    "x-app-tier": {
                      regex: tier,
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
