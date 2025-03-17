import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

/**
 * DynamoDB document client for interacting with the database
 */
const dynamoDb = new DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || '';

/**
 * Interface for query string parameters
 */
interface QueryStringParams {
  category?: string;
  status?: string;
  minPrice?: string;
  maxPrice?: string;
  limit?: string;
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
 * Lambda handler to get items for a specific user, with optional filtering
 * @param event API Gateway event
 * @returns APIGatewayProxyResult with items or error
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('GetItems event:', JSON.stringify(event, null, 2));
  
  try {
    // Get the userId from path parameters
    const userId = event.pathParameters?.userId;
    
    if (!userId) {
      return createErrorResponse(400, 'Missing userId path parameter');
    }

    // Base query parameters
    const params: DynamoDB.DocumentClient.QueryInput = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };
    
    // Apply pagination if limit is provided
    if (event.queryStringParameters?.limit) {
      const limit = parseInt(event.queryStringParameters.limit, 10);
      if (!isNaN(limit) && limit > 0) {
        params.Limit = limit;
      }
    }
    
    // Get the pagination token if provided
    if (event.queryStringParameters?.nextToken) {
      params.ExclusiveStartKey = JSON.parse(
        Buffer.from(event.queryStringParameters.nextToken, 'base64').toString()
      );
    }
    
    // Apply filters based on query string parameters
    await applyFilters(params, event.queryStringParameters as QueryStringParams);
    
    // Execute the query
    const result = await dynamoDb.query(params).promise();
    
    // Create pagination token if there are more results
    let nextToken = null;
    if (result.LastEvaluatedKey) {
      nextToken = Buffer.from(
        JSON.stringify(result.LastEvaluatedKey)
      ).toString('base64');
    }
    
    // Return the results
    return {
      statusCode: 200,
      headers: defaultHeaders,
      body: JSON.stringify({
        items: result.Items || [],
        count: result.Count || 0,
        scannedCount: result.ScannedCount || 0,
        nextToken
      })
    };
  } catch (error) {
    console.error('Error querying items:', error);
    
    // If it's a DynamoDB error, provide more specific message
    if (error instanceof Error) {
      const errorMessage = error.name === 'ValidationException' 
        ? 'Invalid query parameters' 
        : error.message;
      
      return createErrorResponse(500, `Database error: ${errorMessage}`);
    }
    
    return createErrorResponse(500, 'Internal server error');
  }
};

/**
 * Apply filters to the DynamoDB query based on provided query parameters
 * @param params DynamoDB query parameters
 * @param queryParams Query string parameters from the API request
 */
async function applyFilters(
  params: DynamoDB.DocumentClient.QueryInput, 
  queryParams?: QueryStringParams
): Promise<void> {
  if (!queryParams) return;
  
  const { category, status, minPrice, maxPrice } = queryParams;
  
  // Build filter expression dynamically based on provided query parameters
  const filterExpressions: string[] = [];
  const expressionAttributeValues: Record<string, any> = { 
    ...params.ExpressionAttributeValues 
  };
  
  if (category) {
    filterExpressions.push('category = :category');
    expressionAttributeValues[':category'] = category;
  }
  
  if (status) {
    filterExpressions.push('itemStatus = :status');
    expressionAttributeValues[':status'] = status;
  }
  
  if (minPrice) {
    const minPriceNumber = Number(minPrice);
    if (!isNaN(minPriceNumber)) {
      filterExpressions.push('price >= :minPrice');
      expressionAttributeValues[':minPrice'] = minPriceNumber;
    }
  }
  
  if (maxPrice) {
    const maxPriceNumber = Number(maxPrice);
    if (!isNaN(maxPriceNumber)) {
      filterExpressions.push('price <= :maxPrice');
      expressionAttributeValues[':maxPrice'] = maxPriceNumber;
    }
  }
  
  // If any filter expressions were added, update the query parameters
  if (filterExpressions.length > 0) {
    params.FilterExpression = filterExpressions.join(' AND ');
    params.ExpressionAttributeValues = expressionAttributeValues;
  }
}
