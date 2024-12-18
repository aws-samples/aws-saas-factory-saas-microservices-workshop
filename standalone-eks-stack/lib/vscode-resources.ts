import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { InstanceTarget } from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";

export interface CodeServerProps {
  readonly vpcCidr?: string;
  readonly instanceType?: ec2.InstanceType;
  readonly codeServerPort?: number;
  readonly codeServerVersion?: string;
}

export class CodeServerConstruct extends Construct {
  public readonly vpc: ec2.IVpc;
  public readonly instance: ec2.Instance;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly distribution: cloudfront.Distribution;
  public readonly codeServerPassword: string;

  constructor(scope: Construct, id: string, props: CodeServerProps = {}) {
    super(scope, id);

    const defaultProps = {
      vpcCidr: "10.0.0.0/16",
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      codeServerPort: 8080,
      codeServerVersion: "4.95.2",
    };

    this.codeServerPassword = this.node.addr;

    const config = { ...defaultProps, ...props, userName: "ec2-user" };

    // Create VPC
    this.vpc = new ec2.Vpc(this, "CodeServerVPC", {
      ipAddresses: ec2.IpAddresses.cidr(config.vpcCidr),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // Create Security Groups
    const albSg = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
      vpc: this.vpc,
      description: "Security group for ALB",
      allowAllOutbound: true,
    });

    const ec2Sg = new ec2.SecurityGroup(this, "Ec2SecurityGroup", {
      vpc: this.vpc,
      description: "Security group for Code Server EC2 instance",
      allowAllOutbound: true,
    });

    // Configure Security Group Rules
    ec2Sg.addIngressRule(
      ec2.Peer.securityGroupId(albSg.securityGroupId),
      ec2.Port.tcp(config.codeServerPort),
      "Allow inbound from ALB"
    );

    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Allow HTTPS inbound");

    // Create Wait Handle and Condition
    const waitHandle = new cdk.CfnWaitConditionHandle(this, "WaitHandle");

    const waitCondition = new cdk.CfnWaitCondition(this, "WaitCondition", {
      count: 1,
      handle: waitHandle.ref,
      timeout: "900", // 15 minutes
    });

    // Create EC2 Role
    const ec2Role = new iam.Role(this, "CodeServerInstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });

    // Create User Data Script
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      // Function to signal failure
      "function signal_error() {",
      "  local error_message=$1",
      `  curl -X PUT -H 'Content-Type:' --data-binary '{"Status" : "FAILURE","Reason" : "'"$error_message"'","UniqueId" : "INSTALLATION","Data" : "Installation failed"}' "${waitHandle.ref}"`,
      "  exit 1",
      "}",

      // Function to signal success
      "function signal_success() {",
      `  curl -X PUT -H 'Content-Type:' --data-binary '{"Status" : "SUCCESS","Reason" : "Configuration Complete","UniqueId" : "INSTALLATION","Data" : "Installation successful"}' "${waitHandle.ref}"`,
      "}",

      // Install code-server
      'echo "Installing code-server..."',
      `curl -fOL https://github.com/coder/code-server/releases/download/v${config.codeServerVersion}/code-server-${config.codeServerVersion}-amd64.rpm || signal_error "Failed to install code-server rpm package"`,
      `rpm -i code-server-${config.codeServerVersion}-amd64.rpm || signal_error "Failed to install code-server"`,

      // Configure code-server
      'echo "Configuring code-server..."',
      `mkdir -p /home/${config.userName}/.config/code-server || signal_error "Failed to create config directory"`,

      // Generate secure password
      `GENERATED_PASSWORD="${this.codeServerPassword}"`,

      // Create config file
      `cat << EOF > /home/${config.userName}/.config/code-server/config.yaml || signal_error "Failed to create config file"`,
      `bind-addr: 0.0.0.0:${config.codeServerPort}`,
      "auth: password",
      "password: $GENERATED_PASSWORD",
      "cert: false",
      "disable-file-uploads: true",
      "EOF",

      // grant ${config.userName} access to code-server config dir
      `chown -R ${config.userName}:${config.userName} /home/${config.userName}/.config/code-server`,
      `chmod -R 500 /home/${config.userName}/.config/code-server`,

      // Start code-server
      `systemctl enable --now code-server@${config.userName} || signal_error "Failed to enable code-server service"`,

      // Signal success if everything completed
      "signal_success"
    );

    // Create EC2 Instance
    this.instance = new ec2.Instance(this, "CodeServerInstance", {
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      instanceType: config.instanceType,
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      blockDevices: [{
        deviceName: '/dev/xvda', // or '/dev/sda1' depending on AMI
        volume: ec2.BlockDeviceVolume.ebs(50, {
          encrypted: true,
          deleteOnTermination: true,
          volumeType: ec2.EbsDeviceVolumeType.GP3,
        }),
      }],
      securityGroup: ec2Sg,
      role: ec2Role,
      userData,
      userDataCausesReplacement: true,
    });

    waitCondition.node.addDependency(this.instance);

    // Create ALB
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, "CodeServerALB", {
      vpc: this.vpc,
      internetFacing: true,
      securityGroup: albSg,
    });

    const targetGroup = new elbv2.ApplicationTargetGroup(this, "CodeServerTargetGroup", {
      vpc: this.vpc,
      port: config.codeServerPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        path: "/",
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5,
        timeout: cdk.Duration.seconds(10),
        interval: cdk.Duration.seconds(30),
        healthyHttpCodes: "200,302", // for redirects to /login page
      },
    });

    targetGroup.addTarget(new InstanceTarget(this.instance, config.codeServerPort));

    // Add HTTPS Listener
    this.loadBalancer.addListener("HttpListener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [targetGroup],
    });

    // Create CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, "CodeServerDistribution", {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(this.loadBalancer, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
      enableLogging: true,
    });

    // Store Instance ID in SSM Parameter
    new ssm.StringParameter(this, "CodeServerInstanceId", {
      parameterName: "/code-server/instance-id",
      stringValue: this.instance.instanceId,
      description: "Code Server Instance ID",
    });

    // Make sure resources depend on the wait condition
    this.loadBalancer.node.addDependency(waitCondition);
    targetGroup.node.addDependency(waitCondition);

    // Add outputs
    new cdk.CfnOutput(this, "CloudFrontDomain", {
      value: this.distribution.domainName,
      description: "CloudFront Distribution Domain Name",
    });

    new cdk.CfnOutput(this, "LoadBalancerDomain", {
      value: this.loadBalancer.loadBalancerDnsName,
      description: "Load Balancer DNS Name",
    });

    new cdk.CfnOutput(this, "CodeServerInstanceID", {
      value: this.instance.instanceId,
      description: "Code Server Instance ID",
    });

    new cdk.CfnOutput(this, "CodeServerPassword", {
      value: this.codeServerPassword,
      description: "Code Server Password",
    });
  }
}
