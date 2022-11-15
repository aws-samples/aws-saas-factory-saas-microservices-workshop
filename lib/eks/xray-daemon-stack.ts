import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import * as iam from "aws-cdk-lib/aws-iam";
import * as xray from "aws-cdk-lib/aws-xray";
import { Construct } from "constructs";
import { AddOnStackProps } from "../interface/addon-props";

export class XrayAddOnStack extends cdk.NestedStack {
  public readonly xrayServiceDNSAndPort: string;

  constructor(scope: Construct, id: string, props?: AddOnStackProps) {
    super(scope, id, props);

    if (props?.clusterInfo == undefined) {
      throw new Error("props.clusterInfo must be defined!");
    }
    const clusterInfo = props.clusterInfo;

    const xrayPort = 2000;
    const xrayNamespaceName = "xray-system";
    const xrayServiceName = "xray-service";
    this.xrayServiceDNSAndPort = `${xrayServiceName}.${xrayNamespaceName}:${xrayPort}`;

    new xray.CfnSamplingRule(this, "IgnoreHealthChecksRule", {
      samplingRule: {
        priority: 100,
        serviceName: "*",
        serviceType: "*",
        host: "*",
        resourceArn: "*",
        httpMethod: "*",
        urlPath: "*/health",
        reservoirSize: 0,
        fixedRate: 0,
        ruleName: "IgnoreHealthChecks",
        version: 1,
      },
    });

    const cluster = eks.Cluster.fromClusterAttributes(this, "ImportedCluster", {
      clusterName: clusterInfo.cluster.clusterName,
      clusterSecurityGroupId: clusterInfo.cluster.clusterSecurityGroupId,
      kubectlLambdaRole: clusterInfo.cluster.kubectlLambdaRole,
      kubectlEnvironment: clusterInfo.cluster.kubectlEnvironment,
      kubectlLayer: clusterInfo.cluster.kubectlLayer,
      awscliLayer: clusterInfo.cluster.awscliLayer,
      kubectlRoleArn: clusterInfo.cluster.kubectlRole?.roleArn,
      openIdConnectProvider: clusterInfo.cluster.openIdConnectProvider,
    });

    const xrayNamespace = cluster.addManifest("my-xray-namespace", {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: { name: xrayNamespaceName },
    });

    const serviceAccountName = "xray-svc-account";
    const sa = cluster.addServiceAccount("my-xray-svc-account", {
      name: serviceAccountName,
      namespace: xrayNamespaceName,
    });

    const xrayDaemonAccess = iam.ManagedPolicy.fromAwsManagedPolicyName(
      "AWSXRayDaemonWriteAccess"
    );
    sa.role.addManagedPolicy(xrayDaemonAccess);

    sa.node.addDependency(xrayNamespace);

    const xrayService = cluster.addManifest("my-xray-service", {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: xrayServiceName,
        namespace: xrayNamespaceName,
      },
      spec: {
        selector: {
          app: "xray-daemon",
        },
        clusterIP: "None",
        ports: [
          {
            name: "incoming",
            port: xrayPort,
            protocol: "UDP",
          },
        ],
      },
    });

    xrayService.node.addDependency(xrayNamespace);

    const xrayDaemon = cluster.addManifest("my-xray-daemon", {
      apiVersion: "apps/v1",
      kind: "DaemonSet",
      metadata: {
        name: "xray-daemon",
        namespace: xrayNamespaceName,
      },
      spec: {
        updateStrategy: {
          type: "RollingUpdate",
        },
        selector: {
          matchLabels: {
            app: "xray-daemon",
          },
        },
        template: {
          metadata: {
            labels: {
              app: "xray-daemon",
            },
          },
          spec: {
            serviceAccountName: serviceAccountName,
            containers: [
              {
                name: "xray-daemon",
                image: "public.ecr.aws/xray/aws-xray-daemon:3.3.4",
                command: ["/xray"],
                args: [
                  "--bind",
                  `0.0.0.0:${xrayPort}`,
                  "--bind-tcp",
                  `0.0.0.0:${xrayPort}`,
                ],
                imagePullPolicy: "Always",
                resources: {
                  limits: {
                    cpu: "100m",
                    memory: "256Mi",
                  },
                  requests: {
                    cpu: "50m",
                    memory: "50Mi",
                  },
                },
                ports: [
                  {
                    name: "xray-ingest",
                    containerPort: xrayPort,
                    hostPort: xrayPort,
                    protocol: "UDP",
                  },
                ],
              },
            ],
          },
        },
      },
    });

    xrayDaemon.node.addDependency(xrayNamespace);
    xrayDaemon.node.addDependency(xrayService);
  }
}
