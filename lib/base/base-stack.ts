import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { EksCluster } from "../../lib/eks/eks-blueprint-stack";
import { CognitoResources } from "../../lib/cognito/cognito-stack";
import { IstioResources } from "../../lib/eks/istio-stack";
import { XrayAddOnStack } from "../../lib/eks/xray-daemon-stack";

export interface BaseStackProps extends cdk.StackProps {
  tlsCertIstio: string;
  tlsKeyIstio: string;
}

export class BaseStack extends cdk.Stack {
  public readonly eksCluster: EksCluster;
  public readonly cognitoResources: CognitoResources;
  public readonly istioResources: IstioResources;
  public readonly xrayAddOnStack: XrayAddOnStack;

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props);

    const tlsCertIstio = props.tlsCertIstio;
    const tlsKeyIstio = props.tlsKeyIstio;

    const cognitoResources = new CognitoResources(this, "CognitoResources");

    const eksCluster = new EksCluster(this, "EksCluster");

    const istioResources = new IstioResources(this, "IstioResources", {
      cluster: eksCluster.cluster,
      issuer: cognitoResources.issuer,
      jwksUri: cognitoResources.jwksUri,
      tlsCert: tlsCertIstio,
      tlsKey: tlsKeyIstio,
    });

    const xrayAddOnStack = new XrayAddOnStack(this, "XrayStack", {
      cluster: eksCluster.cluster,
    });

    this.eksCluster = eksCluster;
    this.cognitoResources = cognitoResources;
    this.istioResources = istioResources;
    this.xrayAddOnStack = xrayAddOnStack;

    new cdk.CfnOutput(this, "CognitoUserPoolId", {
      value: cognitoResources.userPool.userPoolId,
    });
    new cdk.CfnOutput(this, "CognitoAppClientId", {
      value: cognitoResources.userPoolClient.userPoolClientId,
    });
  }
}
