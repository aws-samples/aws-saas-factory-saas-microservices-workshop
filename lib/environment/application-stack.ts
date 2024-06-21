// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as cdk from "aws-cdk-lib";
import * as aws_events from "aws-cdk-lib/aws-events";
import * as aws_events_targets from "aws-cdk-lib/aws-events-targets";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as verifiedpermissions from 'aws-cdk-lib/aws-verifiedpermissions';
import { Construct } from "constructs";
import { ProductStack } from "../product/infrastructure/product-stack";
import { FulfillmentStack } from "../fulfillment/infrastructure/fulfillment-stack";
import { ApplicationStackProps } from "../interface/application-props";
import { OrderStack } from "../order/infrastructure/order-stack";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { TenantTier } from "../enums/tenant-tier";
import { EksCluster } from "../eks/eks-blueprint-stack";
import { InvoiceStack } from "../invoice/infrastructure/invoice-stack";


export class ApplicationStack extends cdk.Stack {
  public readonly fulfillmentServiceDNS: string;
  public readonly fulfillmentServicePort: number;
  public readonly orderServiceDNS: string;
  public readonly orderServicePort: number;
  public readonly productServiceDNS: string;
  public readonly productServicePort: number;
  public readonly fulfillmentDockerImageAsset: DockerImageAsset;
  public readonly productDockerImageAsset: DockerImageAsset;
  public readonly orderDockerImageAsset: DockerImageAsset;
  public readonly invoiceImageAsset: DockerImageAsset;
  public readonly namespace: string;

  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    if (props.baseStack == undefined) {
      throw new Error("Missing definition for baseStack!");
    }

    const deploymentMode = props.deploymentMode;
    const workshopSSMPrefix = props.workshopSSMPrefix;
    const baseImageUri = props.helperLibraryBaseImageUri

    const eksCluster = new EksCluster(this, "EksCluster", {
      workshopSSMPrefix: workshopSSMPrefix,
    });
    const cluster = eksCluster.cluster;
    const cloudwatchAgentLogEndpoint = props.baseStack.cloudwatchAgentAddOnStack.cloudwatchAgentLogEndpoint;
    const cloudwatchAgentLogGroupName = props.baseStack.cloudwatchAgentAddOnStack.cloudwatchAgentLogGroup.logGroupName;
    const istioIngressGateway = props.baseStack.istioResources.istioIngressGateway;

    const tenantTier = props.tenantTier;
    const tenantId = props.tenantId;
    const sideCarImageAsset = props.sideCarImageAsset;

    if (tenantTier != TenantTier.Basic && tenantTier != TenantTier.Premium) {
      throw new Error(`TenantTier: "${tenantTier}" not supported!`);
    }

    // Application environment kubernetes namespace
    this.namespace = tenantId ? `${tenantId}` : `${tenantTier}-pool`;

    const eventBus = new aws_events.EventBus(
      this,
      `${this.namespace}-event-bus`
    );

    // EVENT WATCHER START
    // This rule allows us to read ALL events sent to the advancedTierEventBus
    const eventBusWatcherRule = new aws_events.Rule(
      this,
      "EventBusWatcherRule",
      {
        eventBus: eventBus,
        enabled: true,
        eventPattern: {
          account: [cdk.Stack.of(this).account],
        },
      }
    );
    eventBusWatcherRule.addTarget(
      new aws_events_targets.CloudWatchLogGroup(
        new logs.LogGroup(this, "watcher-log-group", {
          logGroupName: `${workshopSSMPrefix}/${this.namespace}-event-bus-logs`,
          retention: logs.RetentionDays.ONE_WEEK,
        })
      )
    );
    // EVENT WATCHER END

    
    // PASTE: LAB6 (Policy store)


    // PASTE: LAB6 (Policies)


    const stackNamespace = cluster.addManifest(`StackNamespaceManifest`, {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: this.namespace,
        labels: {
          "istio-injection": "enabled",
          tenantTier: tenantTier,
          ...(tenantId && {
            tenantId: tenantId,
          }),
        },
      },
    });

    //Namespace authorization envoy filters
    //Authorization resource: cluster proxy route so filter can call the sidecar on localhost:8081
    const localhostCluster = cluster.addManifest(`LocalhostClusterManifest`, {
      apiVersion: "networking.istio.io/v1alpha3",
      kind: "EnvoyFilter",
      metadata: {
        name: "sidecar-localhost", 
        namespace: this.namespace
      },
      spec: {        
        configPatches: [{
          applyTo: "CLUSTER",
          patch: {
            operation: "ADD",
            value: {
              name: "outbound|8081||localhost",
              connect_timeout: "1.00s",
              type: "STRICT_DNS",
              lb_policy: "ROUND_ROBIN",
              load_assignment: {
                cluster_name: "outbound|8081||localhost",
                endpoints: [{
                  lb_endpoints: [{
                    endpoint: {
                      address: {
                        socket_address: {
                          address: "127.0.0.1",
                          port_value: 8081
                        }
                      }
                    }
                  }]
                }]
              }
            }
          }
        }]
      }
    });
    localhostCluster.node.addDependency(stackNamespace);    

    //Authorization resources: filter that calls the sidecar to authorize requests
    const authFilter = cluster.addManifest(`AuthFilterManifest`, {
      apiVersion: "networking.istio.io/v1alpha3",
      kind: "EnvoyFilter",
      metadata: {
        name: "auth-filter",
        namespace: this.namespace
      },
      spec: {
        workloadSelector: {
          labels: {
            authorization: "enabled"
          }
        },
        configPatches: [{
          applyTo: "HTTP_FILTER",
          match: {
            context: "SIDECAR_INBOUND",
            listener: {
              filterChain: {
                filter: {
                  name: "envoy.filters.network.http_connection_manager",
                  subFilter: {
                    name: "envoy.filters.http.router"
                  }
                }
              }
            }
          },
          patch: {
            operation: "INSERT_FIRST",
            value: {
              name: "envoy.filters.http.ext_authz",
              typed_config: {
                "@type": "type.googleapis.com/envoy.extensions.filters.http.ext_authz.v3.ExtAuthz",
                http_service: {
                  server_uri: {
                    uri: "http://127.0.0.1:8081",
                    cluster: "outbound|8081||localhost",
                    timeout: "1.00s"
                  },
                  path_prefix: "/authorize",
                  authorization_request: {
                    headers_to_add: [{
                      key: "x-auth-request-path",
                      value: "%REQ(:path)%"
                    },
                    {
                      key: "x-auth-request-method",
                      value: "%REQ(:method)%"
                    }]
                  },
                  failure_mode_allow: false
                }
              }
            }
          }
        }]
      }
    });
    authFilter.node.addDependency(stackNamespace);

    const productStack = new ProductStack(this, `ProductStack`, {
      cluster: cluster,
      istioIngressGateway: istioIngressGateway,
      applicationImageAsset: props.basicStack?.productDockerImageAsset,
      sideCarImageAsset: sideCarImageAsset,
      namespace: this.namespace,
      tenantTier: tenantTier,
      tenantId: tenantId,
      cloudwatchAgentLogEndpoint: cloudwatchAgentLogEndpoint,
      cloudwatchAgentLogGroupName: cloudwatchAgentLogGroupName,
      namespaceConstruct: stackNamespace,
      // PASTE: LAB6 (Policy store reference for product stack)
      baseImage: baseImageUri
    });
    productStack.node.addDependency(stackNamespace);
    this.productServiceDNS = productStack.productServiceDNS;
    this.productServicePort = productStack.productServicePort;
    this.productDockerImageAsset = productStack.productImageAsset;

    if (deploymentMode == "all") {
      const fulfillmentStack = new FulfillmentStack(this, "fulfillmentStack", {
        cluster: cluster,
        istioIngressGateway: istioIngressGateway,
        applicationImageAsset: props.basicStack?.fulfillmentDockerImageAsset,
        sideCarImageAsset: sideCarImageAsset,
        namespace: this.namespace,
        tenantTier: tenantTier,
        tenantId: tenantId,
        cloudwatchAgentLogEndpoint: cloudwatchAgentLogEndpoint,
        cloudwatchAgentLogGroupName: cloudwatchAgentLogGroupName,
        namespaceConstruct: stackNamespace,
        eventBus: eventBus,
        baseImage: baseImageUri
      });
      fulfillmentStack.node.addDependency(stackNamespace);
      this.fulfillmentServicePort = fulfillmentStack.fulfillmentServicePort;
      this.fulfillmentDockerImageAsset =
        fulfillmentStack.fulfillmentDockerImageAsset;
      this.fulfillmentServiceDNS = fulfillmentStack.fulfillmentServiceDNS;

      const orderStack = new OrderStack(this, "orderStack", {
        cluster: cluster,
        istioIngressGateway: istioIngressGateway,
        namespace: this.namespace,
        fulfillmentServiceDNS: fulfillmentStack.fulfillmentServiceDNS,
        fulfillmentServicePort: fulfillmentStack.fulfillmentServicePort,
        applicationImageAsset: props.basicStack?.orderDockerImageAsset,
        sideCarImageAsset: sideCarImageAsset,
        tenantTier: tenantTier,
        tenantId: tenantId,
        cloudwatchAgentLogEndpoint: cloudwatchAgentLogEndpoint,
        cloudwatchAgentLogGroupName: cloudwatchAgentLogGroupName,
        namespaceConstruct: stackNamespace,
        // PASTE: LAB6 (Policy store reference for order stack)
        baseImage: baseImageUri
      });
      orderStack.node.addDependency(stackNamespace);
      orderStack.node.addDependency(fulfillmentStack);
      this.orderServiceDNS = orderStack.orderServiceDNS;
      this.orderServicePort = orderStack.orderServicePort;
      this.orderDockerImageAsset = orderStack.orderDockerImageAsset;

      const invoiceStack = new InvoiceStack(this, "invoiceStack", {
        cluster: cluster,
        istioIngressGateway: istioIngressGateway,
        namespace: this.namespace,
        productServiceDNS: productStack.productServiceDNS,
        applicationImageAsset: props.basicStack?.invoiceImageAsset,
        sideCarImageAsset: sideCarImageAsset,
        tenantTier: tenantTier,
        tenantId: tenantId,
        cloudwatchAgentLogEndpoint: cloudwatchAgentLogEndpoint,
        cloudwatchAgentLogGroupName: cloudwatchAgentLogGroupName,
        namespaceConstruct: stackNamespace,
        baseImage: baseImageUri,
        eventBus: eventBus,
        fulfillmentEventDetailType: fulfillmentStack.eventDetailType,
        fulfillmentEventSource: fulfillmentStack.eventSource,
      });
      invoiceStack.node.addDependency(stackNamespace);
      invoiceStack.node.addDependency(fulfillmentStack);
      this.invoiceImageAsset = invoiceStack.invoiceImageAsset;
    }
  }
}
