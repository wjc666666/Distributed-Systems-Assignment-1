import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

/**
 * DynamoDB document client for interacting with the database
 */
const dynamoDb = new DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || '';

/**
 * Interface for the item to be created
 */
interface ItemData {
  userId: string;
  itemId: string;
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  itemStatus?: string;
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
 * Lambda handler to create a new item in the database
 * @param event API Gateway event
 * @returns APIGatewayProxyResult with created item or error
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('PostItem event:', JSON.stringify(event, null, 2));
  
  try {
    // Validate request body
    if (!event.body) {
      return createErrorResponse(400, 'Missing request body');
    }

    // Parse and validate the item data
    let item: ItemData;
    try {
      item = JSON.parse(event.body);
    } catch (err) {
      return createErrorResponse(400, 'Invalid JSON in request body');
    }
    
    // Validate required fields
    if (!item.userId || !item.itemId) {
      return createErrorResponse(400, 'Missing required fields: userId and itemId are required');
    }

    // Validate data types
    if (item.price !== undefined && (typeof item.price !== 'number' || isNaN(item.price))) {
      return createErrorResponse(400, 'Price must be a valid number');
    }

    // Add metadata
    const timestamp = new Date().toISOString();
    const newItem: ItemData = {
      ...item,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Write to DynamoDB with condition to prevent overwriting existing items
    try {
      await dynamoDb.put({
        TableName: TABLE_NAME,
        Item: newItem,
        ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(itemId)'
      }).promise();
    } catch (dbError) {
      if (dbError instanceof Error && dbError.name === 'ConditionalCheckFailedException') {
        return createErrorResponse(409, 'Item already exists with the provided userId and itemId');
      }
      throw dbError; // Re-throw to be caught by the outer try/catch
    }

    // Return success response with the created item
    return createSuccessResponse(201, { 
      message: 'Item created successfully',
      item: newItem
    });
    
  } catch (error) {
    console.error('Error creating item:', error);
    
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
