import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { EksBlueprintStack } from "../../lib/eks/eks-blueprint-stack";
import { CognitoStack } from "../../lib/cognito/cognito-stack";
import { XrayAddOnStack } from "../../lib/eks/xray-daemon-stack";
import { IstioStack } from "../../lib/eks/istio-stack";
import { OtelAddOnStack } from "../eks/otel-stack";

export class BaseStack extends cdk.Stack {
  public readonly eksStack: EksBlueprintStack;
  public readonly cognitoStack: CognitoStack;
  public readonly istioStack: IstioStack;
  public readonly xrayAddOnStack: XrayAddOnStack;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const account = props?.env?.account;
    const region = props?.env?.region;

    const eksStack = new EksBlueprintStack(this, "EKSStack", {
      env: { account, region },
    });

    const cognitoStack = new CognitoStack(this, "CognitoStack");

    const tlsCertParameterValue = new cdk.CfnParameter(this, "tlsCertIstio", {
      type: "String",
      minLength: 1,
    }).valueAsString;

    const tlsKeyParameterValue = new cdk.CfnParameter(this, "tlsKeyIstio", {
      type: "String",
      minLength: 1,
    }).valueAsString;

    const istioStack = new IstioStack(this, "IstioStack", {
      clusterInfo: eksStack.clusterInfo,
      issuer: cognitoStack.issuer,
      jwksUri: cognitoStack.jwksUri,
      tlsCert: tlsCertParameterValue,
      tlsKey: tlsKeyParameterValue,
    });

    const xrayAddOnStack = new XrayAddOnStack(this, "XrayStack", {
      clusterInfo: eksStack.clusterInfo,
    });

    xrayAddOnStack.addDependency(eksStack);
    istioStack.addDependency(eksStack);

    const otelAddonStack = new OtelAddOnStack(this, "OtelStack", {
      clusterInfo: eksStack.clusterInfo,
    });

    this.eksStack = eksStack;
    this.cognitoStack = cognitoStack;
    this.istioStack = istioStack;
    this.xrayAddOnStack = xrayAddOnStack;

    new cdk.CfnOutput(this, "CognitoUserPoolId", {
      value: cognitoStack.userPool.userPoolId,
    });
    new cdk.CfnOutput(this, "CognitoAppClientId", {
      value: cognitoStack.userPoolClient.userPoolClientId,
    });
  }
}
