import * as cdk from "aws-cdk-lib";
import * as aws_events from "aws-cdk-lib/aws-events";
import * as aws_events_targets from "aws-cdk-lib/aws-events-targets";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { EksCluster } from "../../lib/eks/eks-blueprint-stack";
import { CognitoResources } from "../../lib/cognito/cognito-stack";
import { IstioResources } from "../../lib/eks/istio-stack";
import { CloudwatchAgentAddOnStack } from "../eks/cloudwatch-agent";
import { TenantTier } from "../enums/tenant-tier";

export interface BaseStackProps extends cdk.StackProps {
  tlsCertIstio: string;
  tlsKeyIstio: string;
  workshopSSMPrefix: string;
}

export class BaseStack extends cdk.Stack {
  public readonly eksCluster: EksCluster;
  public readonly cognitoResources: CognitoResources;
  public readonly istioResources: IstioResources;  
  public readonly cloudwatchAgentAddOnStack: CloudwatchAgentAddOnStack;
  public readonly advancedTierEventBus: aws_events.EventBus;

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props);

    const tlsCertIstio = props.tlsCertIstio;
    const tlsKeyIstio = props.tlsKeyIstio;
    const workshopSSMPrefix = props.workshopSSMPrefix;
    
    const cognitoResources = new CognitoResources(this, "CognitoResources");

    const eksCluster = new EksCluster(this, "EksCluster", {
      workshopSSMPrefix: workshopSSMPrefix,
    });

    this.advancedTierEventBus = new aws_events.EventBus(
      this,
      "advanced-tier-event-bus"
    );

    // EVENT WATCHER START
    // This rule allows us to read ALL events sent to the advancedTierEventBus
    const eventBusWatcherRule = new aws_events.Rule(
      this,
      "EventBusWatcherRule",
      {
        eventBus: this.advancedTierEventBus,
        enabled: true,
        eventPattern: {
          account: [cdk.Stack.of(this).account],
        },
      }
    );
    eventBusWatcherRule.addTarget(
      new aws_events_targets.CloudWatchLogGroup(
        new logs.LogGroup(this, "watcher-log-group", {
          logGroupName: `${workshopSSMPrefix}/${TenantTier.Advanced}-event-bus-logs`,
          retention: logs.RetentionDays.ONE_WEEK,
        })
      )
    );
    // EVENT WATCHER END

    const istioResources = new IstioResources(this, "IstioResources", {
      cluster: eksCluster.cluster,
      issuer: cognitoResources.issuer,
      jwksUri: cognitoResources.jwksUri,
      tlsCert: tlsCertIstio,
      tlsKey: tlsKeyIstio,
    });

    const cloudwatchAgentAddOnStack = new CloudwatchAgentAddOnStack(
      this,
      "CloudwatchAgentStack",
      {
        cluster: eksCluster.cluster,
        workshopSSMPrefix: workshopSSMPrefix,
      }
    );

    this.eksCluster = eksCluster;
    this.cognitoResources = cognitoResources;
    this.istioResources = istioResources;
    this.cloudwatchAgentAddOnStack = cloudwatchAgentAddOnStack;

    new cdk.CfnOutput(this, "CognitoUserPoolId", {
      value: cognitoResources.userPool.userPoolId,
    });
    new cdk.CfnOutput(this, "CognitoAppClientId", {
      value: cognitoResources.userPoolClient.userPoolClientId,
    });
  }
}
