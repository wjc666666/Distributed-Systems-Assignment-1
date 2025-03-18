import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

/**
 * DynamoDB document client for interacting with the database
 */
const dynamoDb = new DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || '';

/**
 * Interface for the update data
 */
interface UpdateData {
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  itemStatus?: string;
  updatedAt?: string;
  [key: string]: any; // Allow for additional fields
}

/**
 * Standard response headers for API responses
 */
const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*', // Enable CORS for all origins
  'Access-Control-Allow-Credentials': true
};

/**
 * Creates an error response with the given status code and message
 * @param statusCode HTTP status code
 * @param message Error message
 * @returns APIGatewayProxyResult with error details
 */
const createErrorResponse = (statusCode: number, message: string): APIGatewayProxyResult => {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify({ 
      error: true,
      message 
    })
  };
};

/**
 * Creates a success response with the given status code and data
 * @param statusCode HTTP status code
 * @param data Response data
 * @returns APIGatewayProxyResult with success data
 */
const createSuccessResponse = (statusCode: number, data: Record<string, any>): APIGatewayProxyResult => {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(data)
  };
};

/**
 * Lambda handler to update an existing item in the database
 * @param event API Gateway event
 * @returns APIGatewayProxyResult with updated item or error
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('PutItem event:', JSON.stringify(event, null, 2));
  
  try {
    // Get and validate path parameters
    const userId = event.pathParameters?.userId;
    const itemId = event.pathParameters?.itemId;
    
    if (!userId || !itemId) {
      return createErrorResponse(400, 'Missing required path parameters: userId and itemId');
    }

    // Validate request body
    if (!event.body) {
      return createErrorResponse(400, 'Missing request body');
    }

    // Parse update data
    let updateData: UpdateData;
    try {
      updateData = JSON.parse(event.body);
    } catch (err) {
      return createErrorResponse(400, 'Invalid JSON in request body');
    }
    
    // Validate data types
    if (updateData.price !== undefined && (typeof updateData.price !== 'number' || isNaN(updateData.price))) {
      return createErrorResponse(400, 'Price must be a valid number');
    }
    
    // Add timestamp for update tracking
    updateData.updatedAt = new Date().toISOString();
    
    // Generate update expression components
    const { 
      updateExpression,
      expressionAttributeNames,
      expressionAttributeValues,
      hasUpdates
    } = buildUpdateExpression(updateData);
    
    // Ensure there are fields to update
    if (!hasUpdates) {
      return createErrorResponse(400, 'No valid fields to update');
    }
    
    // Update the item in DynamoDB
    try {
      const params: DynamoDB.DocumentClient.UpdateItemInput = {
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
      
      // Return success response with updated item
      return createSuccessResponse(200, {
        message: 'Item updated successfully',
        item: result.Attributes
      });
    } catch (dbError) {
      // Handle specific DynamoDB errors
      if (dbError instanceof Error) {
        if (dbError.name === 'ConditionalCheckFailedException') {
          return createErrorResponse(404, 'Item not found');
        }
        throw dbError; // Re-throw to be caught by the outer try/catch
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error updating item:', error);
    
    // Handle different types of errors
    if (error instanceof Error) {
      // Specific error handling for different AWS error types
      if (error.name === 'ValidationException') {
        return createErrorResponse(400, `Validation error: ${error.message}`);
      }
      
      if (error.name === 'ResourceNotFoundException') {
        return createErrorResponse(404, 'The specified table does not exist');
      }
      
      if (error.name === 'ProvisionedThroughputExceededException') {
        return createErrorResponse(429, 'Too many requests - throughput exceeded');
      }
      
      return createErrorResponse(500, `Database error: ${error.message}`);
    }
    
    return createErrorResponse(500, 'Internal server error');
  }
};

/**
 * Builds the DynamoDB update expression and related components
 * @param updateData Data containing fields to update
 * @returns Object with update expression, attribute names, values, and update status
 */
function buildUpdateExpression(updateData: UpdateData): {
  updateExpression: string;
  expressionAttributeNames: Record<string, string>;
  expressionAttributeValues: Record<string, any>;
  hasUpdates: boolean;
} {
  const updateExpressionParts: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};
  
  // Process each field to update, excluding primary keys
  Object.entries(updateData).forEach(([key, value]) => {
    // Skip primary key fields as they cannot be updated
    if (key !== 'userId' && key !== 'itemId') {
      const attributeName = `#${key}`;
      const attributeValue = `:${key}`;
      
      updateExpressionParts.push(`${attributeName} = ${attributeValue}`);
      expressionAttributeNames[attributeName] = key;
      expressionAttributeValues[attributeValue] = value;
    }
  });
  
  return {
    updateExpression: `SET ${updateExpressionParts.join(', ')}`,
    expressionAttributeNames,
    expressionAttributeValues,
    hasUpdates: updateExpressionParts.length > 0
  };
}
