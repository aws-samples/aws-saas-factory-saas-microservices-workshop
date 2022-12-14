import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export class CognitoStack extends cdk.NestedStack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;
  public readonly issuer: string;
  public readonly jwksUri: string;

  constructor(scope: Construct, id: string, props?: cdk.NestedStackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "saas-microservices-workshop-user-pool",
      passwordPolicy: {
        minLength: 6,
        requireLowercase: false,
        requireDigits: false,
        requireUppercase: false,
        requireSymbols: false,
      },
      customAttributes: {
        tenant_id: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 15,
          mutable: false,
        }),
        tenant_tier: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 15,
          mutable: false,
        }),
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient("app-client", {
      userPoolClientName: "saas-workshop-client",
      readAttributes: new cognito.ClientAttributes()
        .withCustomAttributes("custom:tenant_tier", "custom:tenant_id")
        .withStandardAttributes({ email: true }),
      generateSecret: true,
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(24),
      idTokenValidity: cdk.Duration.hours(24),
      refreshTokenValidity: cdk.Duration.days(30),
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
      },
    });

    this.userPool = userPool;
    this.userPoolClient = userPoolClient;
    this.issuer = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`;
    this.jwksUri = `${this.issuer}/.well-known/jwks.json`;
  }
}
