import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CdkStack } from '../lib/cdk-stack';

describe('SAP Frontend CDK Stack Tests', () => {
  let app: cdk.App;
  let stack: CdkStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new CdkStack(app, 'TestSapFrontendStack', {
      env: {
        account: '123456789012',
        region: 'ap-northeast-1'
      }
    });
    template = Template.fromStack(stack);
  });

  test('S3 Bucket Created', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      WebsiteConfiguration: {
        IndexDocument: 'index.html',
        ErrorDocument: 'index.html'
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      },
      VersioningConfiguration: {
        Status: 'Enabled'
      }
    });
  });

  test('CloudFront Distribution Created', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Comment: 'SAP Strategic AI Platform Distribution',
        Enabled: true,
        PriceClass: 'PriceClass_100',
        HttpVersion: 'http2',
        ViewerCertificate: {
          CloudFrontDefaultCertificate: true
        }
      }
    });
  });

  test('API Gateway Created', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'SAP Frontend API',
      Description: 'API for SAP Strategic AI Platform'
    });
  });

  test('Lambda Functions Created', () => {
    // Sentry-LINE Webhook Lambda
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'sap-sentry-line-webhook',
      Runtime: 'nodejs18.x',
      Handler: 'index.handler',
      Timeout: 30,
      MemorySize: 256,
      Description: 'Sentry to LINE Notify webhook handler'
    });

    // Data Analysis Lambda
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'sap-data-analysis',
      Runtime: 'nodejs18.x',
      Handler: 'index.handler',
      Timeout: 300,
      MemorySize: 1024,
      Description: 'SAP data analysis and AI processing'
    });
  });

  test('CodeBuild Project Created', () => {
    template.hasResourceProperties('AWS::CodeBuild::Project', {
      Name: 'sap-frontend-build',
      ServiceRole: Match.anyValue(),
      Artifacts: {
        Type: 'GITHUB'
      },
      Environment: {
        Type: 'LINUX_CONTAINER',
        ComputeType: 'BUILD_GENERAL1_SMALL',
        Image: 'aws/codebuild/standard:7.0'
      }
    });
  });

  test('SNS Topic for Notifications Created', () => {
    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'sap-pipeline-notifications',
      DisplayName: 'SAP Pipeline Notifications'
    });
  });

  test('CloudWatch Dashboard Created', () => {
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'SAP-Frontend-Monitoring'
    });
  });

  test('CloudWatch Alarm Created', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'SAP-Frontend-High-Error-Rate',
      AlarmDescription: 'High error rate detected in Lambda functions',
      Threshold: 5,
      EvaluationPeriods: 2,
      ComparisonOperator: 'GreaterThanThreshold'
    });
  });

  test('API Gateway Resources and Methods', () => {
    // Webhook resource
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'webhook'
    });

    // Sentry resource
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'sentry'
    });

    // Analysis resource
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'analysis'
    });

    // POST methods
    template.resourceCountIs('AWS::ApiGateway::Method', 2);
  });

  test('Lambda Permissions for API Gateway', () => {
    template.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com'
    });
  });

  test('IAM Roles Created', () => {
    // Lambda execution roles
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [{
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'lambda.amazonaws.com'
          }
        }]
      }
    });

    // CodeBuild service role
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [{
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'codebuild.amazonaws.com'
          }
        }]
      }
    });
  });

  test('Stack Outputs', () => {
    // Test that important outputs are defined
    const stackOutputs = template.findOutputs('WebsiteURL');
    expect(Object.keys(stackOutputs)).toContain('WebsiteURL');

    const apiOutputs = template.findOutputs('ApiUrl');
    expect(Object.keys(apiOutputs)).toContain('ApiUrl');

    const webhookOutputs = template.findOutputs('SentryWebhookUrl');
    expect(Object.keys(webhookOutputs)).toContain('SentryWebhookUrl');

    const bucketOutputs = template.findOutputs('S3BucketName');
    expect(Object.keys(bucketOutputs)).toContain('S3BucketName');
  });

  test('Security Best Practices', () => {
    // S3 bucket should block public access
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      }
    });

    // CloudFront should redirect HTTP to HTTPS
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultCacheBehavior: {
          ViewerProtocolPolicy: 'redirect-to-https'
        }
      }
    });

    // Lambda functions should have log retention set
    template.resourceCountIs('AWS::Logs::LogGroup', Match.anyValue());
  });

  test('Cost Optimization', () => {
    // CloudFront price class should be optimized
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        PriceClass: 'PriceClass_100'
      }
    });

    // CodeBuild should use small compute
    template.hasResourceProperties('AWS::CodeBuild::Project', {
      Environment: {
        ComputeType: 'BUILD_GENERAL1_SMALL'
      }
    });
  });
});