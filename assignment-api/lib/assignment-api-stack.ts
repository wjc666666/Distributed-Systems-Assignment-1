import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class AssignmentApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========== DynamoDB Table ==========
    const itemsTable = new dynamodb.Table(this, 'ItemsTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'itemId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
      pointInTimeRecovery: true // Enable point-in-time recovery for data protection
    });

    // ========== Lambda Functions ==========
    // Common Lambda function configuration
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_16_X,
      environment: {
        TABLE_NAME: itemsTable.tableName
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 256, // Set a reasonable memory size
      tracing: lambda.Tracing.ACTIVE // Enable X-Ray tracing
    };

    // Create Lambda functions for CRUD operations
    const postItemFunction = new lambda.Function(this, 'PostItemFunction', {
      ...commonLambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      handler: 'postItem.handler',
      description: 'Creates a new item in the DynamoDB table'
    });

    const getItemsFunction = new lambda.Function(this, 'GetItemsFunction', {
      ...commonLambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      handler: 'getItems.handler',
      description: 'Retrieves items from the DynamoDB table with optional filtering'
    });

    const putItemFunction = new lambda.Function(this, 'PutItemFunction', {
      ...commonLambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      handler: 'putItem.handler',
      description: 'Updates an existing item in the DynamoDB table'
    });

    const translateItemFunction = new lambda.Function(this, 'TranslateItemFunction', {
      ...commonLambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      handler: 'translateItem.handler',
      description: 'Translates an item description to a specified language'
    });

    // ========== IAM Permissions ==========
    // Grant DynamoDB permissions to Lambda functions
    itemsTable.grantReadWriteData(postItemFunction);
    itemsTable.grantReadData(getItemsFunction);
    itemsTable.grantReadWriteData(putItemFunction);
    itemsTable.grantReadWriteData(translateItemFunction);
    
    // Grant Translate permissions to translateItem function
    translateItemFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['translate:TranslateText'],
      resources: ['*'],
      effect: iam.Effect.ALLOW
    }));

    // ========== API Gateway ==========
    // Create API Gateway with CORS support
    const api = new apigateway.RestApi(this, 'ItemsApi', {
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

    // ========== API Key Configuration ==========
    // Create API Key for protected endpoints (POST and PUT)
    const apiKey = api.addApiKey('ApiKey', {
      apiKeyName: 'ItemsServiceApiKey',
      description: 'API Key for Items Service'
    });
    
    const plan = api.addUsagePlan('UsagePlan', {
      name: 'Standard',
      description: 'Standard usage plan for Items Service',
      apiStages: [
        {
          api,
          stage: api.deploymentStage
        }
      ],
      // Add rate limiting for additional security
      throttle: {
        rateLimit: 10,
        burstLimit: 20
      }
    });
    
    // Add the API key to the usage plan
    plan.addApiKey(apiKey);

    // ========== API Resources and Methods ==========
    // Define API resources
    const items = api.root.addResource('things');
    
    // POST /things - Create a new item
    items.addMethod('POST', new apigateway.LambdaIntegration(postItemFunction), {
      apiKeyRequired: true,  // Requires API key
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
    userItems.addMethod('GET', new apigateway.LambdaIntegration(getItemsFunction), {
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
    singleItem.addMethod('PUT', new apigateway.LambdaIntegration(putItemFunction), {
      apiKeyRequired: true,  // Requires API key
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
    translation.addMethod('GET', new apigateway.LambdaIntegration(translateItemFunction), {
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

    // ========== CloudFormation Outputs ==========
    // Output the API endpoint URL and API key ID
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Endpoint URL',
      exportName: 'ApiEndpointUrl'
    });
    
    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'API Key ID (use this to retrieve the API key value after deployment)',
      exportName: 'ApiKeyId'
    });
  }
}
