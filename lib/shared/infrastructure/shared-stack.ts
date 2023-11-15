import * as cdk from "aws-cdk-lib";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";
var path = require("path");

export class HelperLibraryBaseImageStack extends cdk.Stack {  
  constructor(scope: Construct, id: string) {
    super(scope, id);
    const sharedImageAsset = new DockerImageAsset(
      this,
      "SharedImageAssetImage",
      {
        directory: path.join(__dirname, "../app"),
      }
    );
    new cdk.CfnOutput(this, "HelperLibraryBaseImageUri", {
      value: sharedImageAsset.imageUri,
      exportName: "HelperLibraryBaseImageUri",
    });
  }
}
