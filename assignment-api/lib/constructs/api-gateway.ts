import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';

/**
 * Properties for API Gateway construct
 */
export interface ApiGatewayProps {
  /**
   * Lambda functions for API integration
   */
  readonly postItemFunction: lambda.Function;
  readonly getItemsFunction: lambda.Function;
  readonly putItemFunction: lambda.Function;
  readonly translateItemFunction: lambda.Function;
}

/**
 * Custom construct for API Gateway
 */
export class ApiGateway extends Construct {
  // 公开 API 实例和 API 密钥，以便其他构造可以访问它们
  public readonly api: apigateway.RestApi;
  public readonly apiKey: apigateway.ApiKey;
  public readonly usagePlan: apigateway.UsagePlan;

  constructor(scope: Construct, id: string, props: ApiGatewayProps) {
    super(scope, id);

    // 创建带有 CORS 支持的 API Gateway
    this.api = new apigateway.RestApi(this, 'ItemsApi', {
      restApiName: 'Items Service',
      description: 'This service manages items with translation capabilities',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key']
      },
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true
      }
    });

    // 创建 API 密钥，用于保护敏感端点（POST 和 PUT）
    this.apiKey = this.api.addApiKey('ApiKey', {
      apiKeyName: 'ItemsServiceApiKey',
      description: 'API Key for Items Service'
    });

    // 创建使用计划
    this.usagePlan = this.api.addUsagePlan('UsagePlan', {
      name: 'Standard',
      description: 'Standard usage plan for Items Service',
      apiStages: [
        {
          api: this.api,
          stage: this.api.deploymentStage
        }
      ],
      // 添加速率限制以提高安全性
      throttle: {
        rateLimit: 10,
        burstLimit: 20
      }
    });

    // 将 API 密钥添加到使用计划
    this.usagePlan.addApiKey(this.apiKey);

    // 定义 API 资源
    const items = this.api.root.addResource('things');

    // POST /things - 创建新项目
    items.addMethod('POST', new apigateway.LambdaIntegration(props.postItemFunction), {
      apiKeyRequired: true, // 需要 API 密钥
      methodResponses: [
        {
          statusCode: '201',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL
          }
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': apigateway.Model.ERROR_MODEL
          }
        },
        {
          statusCode: '500',
          responseModels: {
            'application/json': apigateway.Model.ERROR_MODEL
          }
        }
      ]
    });

    // GET /things/{userId} - 获取用户的所有项目，支持可选过滤
    const userItems = items.addResource('{userId}');
    userItems.addMethod('GET', new apigateway.LambdaIntegration(props.getItemsFunction), {
      requestParameters: {
        'method.request.querystring.category': false,
        'method.request.querystring.status': false,
        'method.request.querystring.minPrice': false,
        'method.request.querystring.maxPrice': false
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL
          }
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': apigateway.Model.ERROR_MODEL
          }
        },
        {
          statusCode: '500',
          responseModels: {
            'application/json': apigateway.Model.ERROR_MODEL
          }
        }
      ]
    });

    // PUT /things/{userId}/{itemId} - 更新现有项目
    const singleItem = userItems.addResource('{itemId}');
    singleItem.addMethod('PUT', new apigateway.LambdaIntegration(props.putItemFunction), {
      apiKeyRequired: true, // 需要 API 密钥
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL
          }
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': apigateway.Model.ERROR_MODEL
          }
        },
        {
          statusCode: '404',
          responseModels: {
            'application/json': apigateway.Model.ERROR_MODEL
          }
        },
        {
          statusCode: '500',
          responseModels: {
            'application/json': apigateway.Model.ERROR_MODEL
          }
        }
      ]
    });

    // GET /things/{userId}/{itemId}/translation - 获取翻译后的描述
    const translation = singleItem.addResource('translation');
    translation.addMethod('GET', new apigateway.LambdaIntegration(props.translateItemFunction), {
      requestParameters: {
        'method.request.querystring.language': false
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL
          }
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': apigateway.Model.ERROR_MODEL
          }
        },
        {
          statusCode: '404',
          responseModels: {
            'application/json': apigateway.Model.ERROR_MODEL
          }
        },
        {
          statusCode: '500',
          responseModels: {
            'application/json': apigateway.Model.ERROR_MODEL
          }
        }
      ]
    });

    // 输出 API 终端节点 URL 和 API 密钥 ID
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'API Endpoint URL',
      exportName: 'ApiEndpointUrl'
    });

    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: this.apiKey.keyId,
      description: 'API Key ID',
      exportName: 'ApiKeyId'
    });
  }
} 