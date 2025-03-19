import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

/**
 * Custom construct for database resources
 */
export class Database extends Construct {
  // 公开表实例，以便其他构造可以访问和使用它
  public readonly itemsTable: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // 创建 DynamoDB 表
    this.itemsTable = new dynamodb.Table(this, 'ItemsTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'itemId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 仅用于开发环境
      pointInTimeRecovery: true // 启用时间点恢复以保护数据
    });
  }
} 