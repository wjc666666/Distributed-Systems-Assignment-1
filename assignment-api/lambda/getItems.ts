import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const dynamoDb = new DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get the userId from path parameters
    const userId = event.pathParameters?.userId;
    
    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Missing userId path parameter' })
      };
    }

    // Base query parameters
    const params: DynamoDB.DocumentClient.QueryInput = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };
    
    // Check if there are any query string parameters for filtering
    if (event.queryStringParameters) {
      const { category, status, minPrice, maxPrice } = event.queryStringParameters;
      
      // Build filter expression dynamically based on provided query parameters
      const filterExpressions: string[] = [];
      const expressionAttributeValues: any = { ...params.ExpressionAttributeValues };
      
      if (category) {
        filterExpressions.push('category = :category');
        expressionAttributeValues[':category'] = category;
      }
      
      if (status) {
        filterExpressions.push('itemStatus = :status');
        expressionAttributeValues[':status'] = status;
      }
      
      if (minPrice) {
        filterExpressions.push('price >= :minPrice');
        expressionAttributeValues[':minPrice'] = Number(minPrice);
      }
      
      if (maxPrice) {
        filterExpressions.push('price <= :maxPrice');
        expressionAttributeValues[':maxPrice'] = Number(maxPrice);
      }
      
      // If any filter expressions were added, update the query parameters
      if (filterExpressions.length > 0) {
        params.FilterExpression = filterExpressions.join(' AND ');
        params.ExpressionAttributeValues = expressionAttributeValues;
      }
    }
    
    // Execute the query
    const result = await dynamoDb.query(params).promise();
    
    // Return the results
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: result.Items || [],
        count: result.Count || 0,
        scannedCount: result.ScannedCount || 0
      })
    };
  } catch (error) {
    console.error('Error querying items:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
