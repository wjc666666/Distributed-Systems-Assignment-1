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
  // Expose API instance and API key for other constructs to access
  public readonly api: apigateway.RestApi;
  public readonly apiKey: apigateway.IApiKey;
  public readonly usagePlan: apigateway.UsagePlan;

  constructor(scope: Construct, id: string, props: ApiGatewayProps) {
    super(scope, id);

    // Create API Gateway with CORS support
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

    // Create API key for protected endpoints (POST and PUT)
    this.apiKey = this.api.addApiKey('ApiKey', {
      apiKeyName: 'ItemsServiceApiKey',
      description: 'API Key for Items Service'
    });

    // Create usage plan
    this.usagePlan = this.api.addUsagePlan('UsagePlan', {
      name: 'Standard',
      description: 'Standard usage plan for Items Service',
      apiStages: [
        {
          api: this.api,
          stage: this.api.deploymentStage
        }
      ],
      // Add rate limiting for additional security
      throttle: {
        rateLimit: 10,
        burstLimit: 20
      }
    });

    // Add API key to the usage plan
    this.usagePlan.addApiKey(this.apiKey);

    // Define API resources
    const items = this.api.root.addResource('things');

    // POST /things - Create a new item
    items.addMethod('POST', new apigateway.LambdaIntegration(props.postItemFunction), {
      apiKeyRequired: true, // Requires API key
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

    // GET /things/{userId} - Get all items for a user with optional filtering
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

    // PUT /things/{userId}/{itemId} - Update an existing item
    const singleItem = userItems.addResource('{itemId}');
    singleItem.addMethod('PUT', new apigateway.LambdaIntegration(props.putItemFunction), {
      apiKeyRequired: true, // Requires API key
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

    // GET /things/{userId}/{itemId}/translation - Get translated description
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

    // Output API endpoint URL and API key ID
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