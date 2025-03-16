import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const dynamoDb = new DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get path parameters
    const userId = event.pathParameters?.userId;
    const itemId = event.pathParameters?.itemId;
    
    // Validate path parameters
    if (!userId || !itemId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Missing required path parameters: userId and itemId' })
      };
    }

    // Validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Missing request body' })
      };
    }

    const updateData = JSON.parse(event.body);
    
    // Create update expression and attribute values dynamically
    const updateExpressionParts: string[] = [];
    const expressionAttributeNames: { [key: string]: string } = {};
    const expressionAttributeValues: { [key: string]: any } = {};
    
    // Add timestamp for update tracking
    updateData.updatedAt = new Date().toISOString();
    
    // Process each field to update, excluding primary keys
    Object.entries(updateData).forEach(([key, value]) => {
      // Skip primary key fields
      if (key !== 'userId' && key !== 'itemId') {
        const attributeName = `#${key}`;
        const attributeValue = `:${key}`;
        
        updateExpressionParts.push(`${attributeName} = ${attributeValue}`);
        expressionAttributeNames[attributeName] = key;
        expressionAttributeValues[attributeValue] = value;
      }
    });
    
    // If no valid fields to update
    if (updateExpressionParts.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'No valid fields to update' })
      };
    }
    
    // Build the full update expression
    const updateExpression = `SET ${updateExpressionParts.join(', ')}`;
    
    // Update the item in DynamoDB
    const params = {
      TableName: TABLE_NAME,
      Key: {
        userId,
        itemId
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
      ConditionExpression: 'attribute_exists(userId) AND attribute_exists(itemId)'
    };
    
    const result = await dynamoDb.update(params).promise();
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Item updated successfully',
        item: result.Attributes
      })
    };
  } catch (error) {
    console.error('Error updating item:', error);
    
    // Check if item doesn't exist
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Item not found' })
      };
    }
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
