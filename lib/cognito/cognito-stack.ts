// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export class CognitoResources extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;
  public readonly issuer: string;
  public readonly jwksUri: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

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
        role: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 15,
          mutable: true,
        }),
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient("app-client", {
      userPoolClientName: "saas-workshop-client",
      readAttributes: new cognito.ClientAttributes()
        .withCustomAttributes("custom:tenant_tier", "custom:tenant_id", "custom:role")        
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
    this.issuer = `https://cognito-idp.${
      cdk.Stack.of(this).region
    }.amazonaws.com/${this.userPool.userPoolId}`;
    this.jwksUri = `${this.issuer}/.well-known/jwks.json`;
  }
}
