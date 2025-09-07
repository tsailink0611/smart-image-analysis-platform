import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwactions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';
import path from 'path';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ==================================================
    // 1. フロントエンドホスティング (S3 + CloudFront)
    // ==================================================
    
    // S3バケット（静的ウェブサイトホスティング用）
    const websiteBucket = new s3.Bucket(this, 'SapFrontendBucket', {
      bucketName: `sap-frontend-${this.account}-${cdk.Stack.of(this).region}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // SPAのため
      publicReadAccess: false, // CloudFront経由のみアクセス
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 開発環境用
      autoDeleteObjects: true,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
    });

    // Origin Access Control (OAC) - CloudFront用
    const originAccessControl = new cloudfront.S3OriginAccessControl(this, 'OAC', {
      description: 'SAP Frontend OAC for S3',
    });

    // API Gateway（CloudFrontより前に定義）
    const api = new apigateway.RestApi(this, 'SapFrontendApi', {
      restApiName: 'SAP Frontend API',
      description: 'API for SAP Strategic AI Platform',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      deployOptions: {
        stageName: 'prod',
        throttlingBurstLimit: 1000,
        throttlingRateLimit: 500,
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
        dataTraceEnabled: false,
        metricsEnabled: true,
      },
    });

    // CloudFrontディストリビューション
    const distribution = new cloudfront.Distribution(this, 'SapFrontendDistribution', {
      comment: 'SAP Strategic AI Platform Distribution',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket, {
          originAccessControl,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // SPAルーティング対応
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // 最も安価
      geoRestriction: cloudfront.GeoRestriction.allowlist('JP', 'US'), // 日本とアメリカのみ
    });

    // ==================================================
    // 2. Lambda API関数とAPI Gateway
    // ==================================================
    
    // Sentry-LINE連携Lambda関数
    const sentryLineLambda = new lambda.Function(this, 'SentryLineWebhook', {
      functionName: 'sap-sentry-line-webhook',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(this.getSentryLineLambdaCode()),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        LINE_NOTIFY_TOKEN: process.env.LINE_NOTIFY_TOKEN || '',
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'Sentry to LINE Notify webhook handler',
    });

    // データ分析Lambda関数
    const analysisLambda = new lambda.Function(this, 'DataAnalysisLambda', {
      functionName: 'sap-data-analysis',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(this.getAnalysisLambdaCode()),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        SENTRY_DSN: process.env.VITE_SENTRY_DSN || '',
        SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
        SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'SAP data analysis and AI processing',
    });

    // Lambda関数にBedrock権限を付与
    analysisLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:ListFoundationModels',
        'bedrock:GetFoundationModel'
      ],
      resources: ['*'], // 全Bedrockモデルへのアクセス許可
    }));

    // API Gateway リソースの設定（上記で定義済み）

    // API Gateway リソース
    const webhookResource = api.root.addResource('webhook');
    const sentryResource = webhookResource.addResource('sentry');
    sentryResource.addMethod('POST', new apigateway.LambdaIntegration(sentryLineLambda));

    const analysisResource = api.root.addResource('analysis');
    analysisResource.addMethod('POST', new apigateway.LambdaIntegration(analysisLambda));

    // ==================================================
    // 3. CI/CDパイプライン
    // ==================================================
    
    // アーティファクト用S3バケット
    const artifactsBucket = new s3.Bucket(this, 'PipelineArtifacts', {
      bucketName: `sap-pipeline-artifacts-${this.account}-${cdk.Stack.of(this).region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          id: 'DeleteArtifacts',
          enabled: true,
          expiration: cdk.Duration.days(30),
        },
      ],
    });

    // SNS通知トピック
    const notificationTopic = new sns.Topic(this, 'PipelineNotifications', {
      topicName: 'sap-pipeline-notifications',
      displayName: 'SAP Pipeline Notifications',
    });

    // CodeBuild プロジェクト
    const buildProject = new codebuild.Project(this, 'SapFrontendBuild', {
      projectName: 'sap-frontend-build',
      source: codebuild.Source.gitHub({
        owner: 'your-github-username', // 実際のGitHubユーザー名に変更
        repo: 'sap-project-frontend',
        webhook: true,
        webhookFilters: [
          codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH).andBranchIs('main'),
        ],
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'echo Build started on `date`',
              'npm ci',
            ],
          },
          build: {
            commands: [
              'echo Build started on `date`',
              'npm run build',
              'npm run test -- --coverage --watchAll=false',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed on `date`',
            ],
          },
        },
        artifacts: {
          files: [
            '**/*',
          ],
          'base-directory': 'dist',
        },
        cache: {
          paths: [
            '/root/.npm/**/*',
          ],
        },
      }),
      cache: codebuild.Cache.local(codebuild.LocalCacheMode.CUSTOM),
    });

    // ==================================================
    // 4. 監視・アラート
    // ==================================================
    
    // CloudWatch ダッシュボード
    const dashboard = new cloudwatch.Dashboard(this, 'SapFrontendDashboard', {
      dashboardName: 'SAP-Frontend-Monitoring',
    });

    // Lambda関数のメトリクス
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Function Metrics',
        left: [sentryLineLambda.metricInvocations(), analysisLambda.metricInvocations()],
        right: [sentryLineLambda.metricErrors(), analysisLambda.metricErrors()],
      })
    );

    // CloudFrontのメトリクス
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'CloudFront Metrics',
        left: [distribution.metricRequests()],
        right: [distribution.metric4xxErrorRate(), distribution.metric5xxErrorRate()],
      })
    );

    // アラーム設定
    const errorAlarm = new cloudwatch.Alarm(this, 'HighErrorRate', {
      alarmName: 'SAP-Frontend-High-Error-Rate',
      alarmDescription: 'High error rate detected in Lambda functions',
      metric: sentryLineLambda.metricErrors(),
      threshold: 5,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    errorAlarm.addAlarmAction(new cwactions.SnsAction(notificationTopic));

    // ==================================================
    // 5. 出力
    // ==================================================
    
    new cdk.CfnOutput(this, 'WebsiteURL', {
      description: 'Website URL',
      value: `https://${distribution.distributionDomainName}`,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      description: 'API Gateway URL',
      value: api.url,
    });

    new cdk.CfnOutput(this, 'SentryWebhookUrl', {
      description: 'Sentry Webhook URL',
      value: `${api.url}webhook/sentry`,
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      description: 'S3 Bucket Name',
      value: websiteBucket.bucketName,
    });
  }


  private getSentryLineLambdaCode(): string {
    return `
const https = require('https');

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const lineToken = process.env.LINE_NOTIFY_TOKEN;
        if (!lineToken) {
            throw new Error('LINE_NOTIFY_TOKEN not configured');
        }

        const sentryData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        
        const message = formatSentryMessage(sentryData);
        await sendLineNotify(message, lineToken);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Notification sent successfully' })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
        };
    }
};

function formatSentryMessage(sentryData) {
    const project = sentryData.project_name || 'SAP Frontend';
    const error = sentryData.event?.title || 'Unknown Error';
    const level = sentryData.level || 'error';
    const url = sentryData.url || '';
    const timestamp = sentryData.event?.timestamp || new Date().toISOString();
    
    const japanTime = new Date(timestamp).toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    const emoji = { 'fatal': '💀', 'error': '🚨', 'warning': '⚠️', 'info': 'ℹ️' }[level] || '🚨';

    return \`\${emoji} Sentry Alert

🎯 プロジェクト: \${project}
🐛 エラー: \${error}
📅 発生時刻: \${japanTime}
📊 レベル: \${level.toUpperCase()}

\${url ? \`🔗 詳細: \${url}\` : ''}

#SentryAlert\`;
}

function sendLineNotify(message, token) {
    return new Promise((resolve, reject) => {
        const postData = \`message=\${encodeURIComponent(message)}\`;
        
        const options = {
            hostname: 'notify-api.line.me',
            port: 443,
            path: '/api/notify',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'Authorization': \`Bearer \${token}\`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve({ success: true, data });
                } else {
                    reject(new Error(\`LINE API Error: \${res.statusCode} \${data}\`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}
`;
  }

  private getAnalysisLambdaCode(): string {
    return `
exports.handler = async (event) => {
    console.log('Analysis request:', JSON.stringify(event, null, 2));
    
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const requestBody = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        const { prompt, salesData, analysisType } = requestBody;
        
        // データ分析処理（実際のAI処理はここで実装）
        const analysisResult = {
            summary: \`\${analysisType}分析を実行しました\`,
            dataPoints: salesData?.length || 0,
            timestamp: new Date().toISOString(),
            analysis: {
                totalRecords: salesData?.length || 0,
                processing_time: '1.2s',
                model_version: 'v1.0.0'
            }
        };
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                response: analysisResult,
                message: 'Analysis completed successfully'
            })
        };

    } catch (error) {
        console.error('Analysis error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Analysis failed',
                details: error.message
            })
        };
    }
};
`;
  }
}