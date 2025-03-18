import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB, Translate } from 'aws-sdk';

/**
 * AWS SDK clients for interacting with AWS services
 */
const dynamoDb = new DynamoDB.DocumentClient();
const translate = new Translate();
const TABLE_NAME = process.env.TABLE_NAME || '';

/**
 * Interface for the database item
 */
interface ItemData {
  userId: string;
  itemId: string;
  name?: string;
  description: string;
  category?: string;
  price?: number;
  itemStatus?: string;
  translations?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

/**
 * Interface for translate parameters
 */
interface TranslateParams {
  Text: string;
  SourceLanguageCode: string;
  TargetLanguageCode: string;
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
 * Lambda handler to translate an item's description to a specified language
 * @param event API Gateway event
 * @returns APIGatewayProxyResult with translated item or error
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('TranslateItem event:', JSON.stringify(event, null, 2));
  
  try {
    // Get and validate path parameters
    const userId = event.pathParameters?.userId;
    const itemId = event.pathParameters?.itemId;
    
    if (!userId || !itemId) {
      return createErrorResponse(400, 'Missing required path parameters: userId and itemId');
    }

    // Get the target language, default to English if not specified
    const targetLanguage = event.queryStringParameters?.language || 'en';
    
    // Validate the target language parameter
    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(targetLanguage)) {
      return createErrorResponse(400, 'Invalid language code. Please use format "en" or "en-US"');
    }
    
    // Fetch the item from DynamoDB
    try {
      // Get the item from DynamoDB
      const getItemParams: DynamoDB.DocumentClient.GetItemInput = {
        TableName: TABLE_NAME,
        Key: {
          userId,
          itemId
        }
      };
      
      const { Item: item } = await dynamoDb.get(getItemParams).promise();
      
      if (!item) {
        return createErrorResponse(404, 'Item not found');
      }
      
      // Check if the item has a description to translate
      if (!item.description) {
        return createErrorResponse(400, 'Item has no description to translate');
      }
      
      const typedItem = item as ItemData;
      
      // Check if translation already exists in cache
      const translations = typedItem.translations || {};
      if (translations[targetLanguage]) {
        // Return cached translation
        return createSuccessResponse(200, {
          ...typedItem,
          translatedDescription: translations[targetLanguage],
          translated: true,
          fromCache: true
        });
      }
      
      // If no cached translation, use Amazon Translate service
      const translatedText = await translateText(typedItem.description, targetLanguage);
      
      // Update the item in DynamoDB to cache the translation
      const updatedItem = await cacheTranslation(userId, itemId, targetLanguage, translatedText);
      
      // Return the translated item
      return createSuccessResponse(200, {
        ...updatedItem.Attributes,
        translatedDescription: translatedText,
        translated: true,
        fromCache: false
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      if (dbError instanceof Error) {
        if (dbError.name === 'ResourceNotFoundException') {
          return createErrorResponse(404, 'The specified table does not exist');
        }
        throw dbError;
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error translating item:', error);
    
    // Handle different types of errors
    if (error instanceof Error) {
      // AWS Translate specific errors
      if (error.name === 'UnsupportedLanguagePairException') {
        return createErrorResponse(400, 'Unsupported language pair for translation');
      }
      
      if (error.name === 'TextSizeLimitExceededException') {
        return createErrorResponse(400, 'Description text is too large to translate');
      }
      
      if (error.name === 'ServiceUnavailableException') {
        return createErrorResponse(503, 'Translation service is currently unavailable');
      }
      
      if (error.name === 'ThrottlingException' || error.name === 'ProvisionedThroughputExceededException') {
        return createErrorResponse(429, 'Too many requests to the translation service');
      }
      
      return createErrorResponse(500, `Service error: ${error.message}`);
    }
    
    return createErrorResponse(500, 'Internal server error');
  }
};

/**
 * Translates text using Amazon Translate
 * @param text Text to translate
 * @param targetLanguage Target language code
 * @returns Translated text
 */
async function translateText(text: string, targetLanguage: string): Promise<string> {
  const translateParams: TranslateParams = {
    Text: text,
    SourceLanguageCode: 'auto', // Automatically detect source language
    TargetLanguageCode: targetLanguage
  };
  
  const translationResult = await translate.translateText(translateParams).promise();
  return translationResult.TranslatedText;
}

/**
 * Caches a translation in DynamoDB
 * @param userId User ID
 * @param itemId Item ID
 * @param targetLanguage Target language code
 * @param translatedText Translated text
 * @returns DynamoDB update result
 */
async function cacheTranslation(
  userId: string, 
  itemId: string, 
  targetLanguage: string, 
  translatedText: string
): Promise<DynamoDB.DocumentClient.UpdateItemOutput> {
  const updateParams: DynamoDB.DocumentClient.UpdateItemInput = {
    TableName: TABLE_NAME,
    Key: {
      userId,
      itemId
    },
    UpdateExpression: 'SET translations.#language = :translatedText',
    ExpressionAttributeNames: {
      '#language': targetLanguage
    },
    ExpressionAttributeValues: {
      ':translatedText': translatedText
    },
    ReturnValues: 'ALL_NEW'
  };
  
  return dynamoDb.update(updateParams).promise();
}
