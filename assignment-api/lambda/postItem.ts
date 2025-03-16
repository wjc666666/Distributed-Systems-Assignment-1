import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const dynamoDb = new DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Validate input
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Missing request body' })
      };
    }

    const item = JSON.parse(event.body);
    
    // Validate required fields
    if (!item.userId || !item.itemId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Missing required fields: userId and itemId are required' })
      };
    }

    // Add timestamp
    const timestamp = new Date().toISOString();
    const newItem = {
      ...item,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Write to DynamoDB
    await dynamoDb.put({
      TableName: TABLE_NAME,
      Item: newItem,
      // Ensure item doesn't already exist with same primary key
      ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(itemId)'
    }).promise();

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: 'Item created successfully',
        item: newItem
      })
    };
  } catch (error) {
    console.error('Error creating item:', error);
    
    // Check if error is a condition failure (item already exists)
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Item already exists' })
      };
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
