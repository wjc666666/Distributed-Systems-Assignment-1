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
  // 公开所有 Lambda 函数，以便其他构造可以访问它们
  public readonly postItemFunction: lambda.Function;
  public readonly getItemsFunction: lambda.Function;
  public readonly putItemFunction: lambda.Function;
  public readonly translateItemFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaFunctionsProps) {
    super(scope, id);

    // 定义所有 Lambda 函数共同的配置
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_16_X,
      environment: {
        TABLE_NAME: props.itemsTable.tableName
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE // 启用 X-Ray 跟踪
    };

    // 创建 CRUD 操作的 Lambda 函数
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

    // 设置 IAM 权限
    // 为 Lambda 函数授予 DynamoDB 权限
    props.itemsTable.grantReadWriteData(this.postItemFunction);
    props.itemsTable.grantReadData(this.getItemsFunction);
    props.itemsTable.grantReadWriteData(this.putItemFunction);
    props.itemsTable.grantReadWriteData(this.translateItemFunction);
    
    // 为 translateItem 函数授予 Translate 权限
    this.translateItemFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['translate:TranslateText'],
      resources: ['*'],
      effect: iam.Effect.ALLOW
    }));
  }
} 