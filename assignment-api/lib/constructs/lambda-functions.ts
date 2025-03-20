import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';

/**
 * Properties for Lambda Functions construct
 */
export interface LambdaFunctionsProps {
  /**
   * The DynamoDB table to grant permissions to
   */
  readonly itemsTable: dynamodb.Table;
}

/**
 * Custom construct for Lambda functions
 */
export class LambdaFunctions extends Construct {
  // Expose all Lambda functions for other constructs to access
  public readonly postItemFunction: lambda.Function;
  public readonly getItemsFunction: lambda.Function;
  public readonly putItemFunction: lambda.Function;
  public readonly translateItemFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaFunctionsProps) {
    super(scope, id);

    // Define common configuration for all Lambda functions
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_16_X,
      environment: {
        TABLE_NAME: props.itemsTable.tableName
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE // Enable X-Ray tracing
    };

    // Create Lambda functions for CRUD operations
    this.postItemFunction = new lambda.Function(this, 'PostItemFunction', {
      ...commonLambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      handler: 'postItem.handler',
      description: 'Creates a new item in the DynamoDB table'
    });

    this.getItemsFunction = new lambda.Function(this, 'GetItemsFunction', {
      ...commonLambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      handler: 'getItems.handler',
      description: 'Retrieves items from the DynamoDB table with optional filtering'
    });

    this.putItemFunction = new lambda.Function(this, 'PutItemFunction', {
      ...commonLambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      handler: 'putItem.handler',
      description: 'Updates an existing item in the DynamoDB table'
    });

    this.translateItemFunction = new lambda.Function(this, 'TranslateItemFunction', {
      ...commonLambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      handler: 'translateItem.handler',
      description: 'Translates an item description to a specified language'
    });

    // Set up IAM permissions
    // Grant DynamoDB permissions to Lambda functions
    props.itemsTable.grantReadWriteData(this.postItemFunction);
    props.itemsTable.grantReadData(this.getItemsFunction);
    props.itemsTable.grantReadWriteData(this.putItemFunction);
    props.itemsTable.grantReadWriteData(this.translateItemFunction);
    
    // Grant Translate permissions to translateItem function
    this.translateItemFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['translate:TranslateText'],
      resources: ['*'],
      effect: iam.Effect.ALLOW
    }));
  }
} 