import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Database } from './constructs/database';
import { LambdaFunctions } from './constructs/lambda-functions';
import { ApiGateway } from './constructs/api-gateway';

/**
 * Main stack that composes all custom constructs
 */
export class AssignmentApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the database construct (DynamoDB table)
    const database = new Database(this, 'Database');

    // Create the Lambda functions construct
    const lambdaFunctions = new LambdaFunctions(this, 'LambdaFunctions', {
      itemsTable: database.itemsTable
    });

    // Create the API Gateway construct
    const apiGateway = new ApiGateway(this, 'ApiGateway', {
      postItemFunction: lambdaFunctions.postItemFunction,
      getItemsFunction: lambdaFunctions.getItemsFunction,
      putItemFunction: lambdaFunctions.putItemFunction,
      translateItemFunction: lambdaFunctions.translateItemFunction
    });
  }
}
