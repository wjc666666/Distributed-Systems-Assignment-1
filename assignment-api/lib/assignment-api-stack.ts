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

    // Create DynamoDB table
    const itemsTable = new dynamodb.Table(this, 'ItemsTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'itemId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY // For development only
    });

    // Common Lambda function configuration
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_16_X,
      environment: {
        TABLE_NAME: itemsTable.tableName
      },
      timeout: cdk.Duration.seconds(10)
    };

    // Create Lambda functions
    const postItemFunction = new lambda.Function(this, 'PostItemFunction', {
      ...commonLambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      handler: 'postItem.handler',
    });

    const getItemsFunction = new lambda.Function(this, 'GetItemsFunction', {
      ...commonLambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      handler: 'getItems.handler',
    });

    const putItemFunction = new lambda.Function(this, 'PutItemFunction', {
      ...commonLambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      handler: 'putItem.handler',
    });

    const translateItemFunction = new lambda.Function(this, 'TranslateItemFunction', {
      ...commonLambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      handler: 'translateItem.handler',
    });

    // Grant DynamoDB permissions to Lambda functions
    itemsTable.grantReadWriteData(postItemFunction);
    itemsTable.grantReadData(getItemsFunction);
    itemsTable.grantReadWriteData(putItemFunction);
    itemsTable.grantReadWriteData(translateItemFunction);
    
    // Grant Translate permissions to translateItem function
    translateItemFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['translate:TranslateText'],
      resources: ['*']
    }));

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'ItemsApi', {
      restApiName: 'Items Service',
      description: 'This service manages items.',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });

    // Create API Key for protected endpoints (POST and PUT)
    const apiKey = api.addApiKey('ApiKey');
    const plan = api.addUsagePlan('UsagePlan', {
      name: 'Standard'
    });
    
    // Add the API key to the usage plan
    plan.addApiKey(apiKey);
    
    plan.addApiStage({
      stage: api.deploymentStage
    });

    // Create API resources and methods
    const items = api.root.addResource('things');
    
    // POST /things
    items.addMethod('POST', new apigateway.LambdaIntegration(postItemFunction), {
      apiKeyRequired: true  // Requires API key
    });
    
    // GET /things/{userId}
    const userItems = items.addResource('{userId}');
    userItems.addMethod('GET', new apigateway.LambdaIntegration(getItemsFunction));
    
    // PUT /things/{userId}/{itemId}
    const singleItem = userItems.addResource('{itemId}');
    singleItem.addMethod('PUT', new apigateway.LambdaIntegration(putItemFunction), {
      apiKeyRequired: true  // Requires API key
    });
    
    // GET /things/{userId}/{itemId}/translation
    const translation = singleItem.addResource('translation');
    translation.addMethod('GET', new apigateway.LambdaIntegration(translateItemFunction));

    // Output the API endpoint URL and API key
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Endpoint URL'
    });
    
    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'API Key ID (use this to retrieve the API key value after deployment)'
    });
  }
}
