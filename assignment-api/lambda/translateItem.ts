import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB, Translate } from 'aws-sdk';

/**
 * AWS SDK clients for interacting with AWS services
 * 
 * Note: This implementation explicitly sets English as the source language
 * for translations instead of using Amazon Translate's auto-detection feature.
 * This removes the dependency on Amazon Comprehend's DetectDominantLanguage API
 * and eliminates the need for additional IAM permissions.
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
    console.log(`Translation request from English to ${targetLanguage} for item ${itemId}`);
    
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
        // Return cached translation from the translations map
        return createSuccessResponse(200, {
          ...typedItem,
          translatedDescription: translations[targetLanguage],
          translated: true,
          fromCache: true
        });
      }
      
      // Also check for the emergency fallback attribute pattern
      const fallbackAttributeName = 'translatedText_' + targetLanguage;
      if (typedItem[fallbackAttributeName]) {
        // Return cached translation from the fallback attribute
        return createSuccessResponse(200, {
          ...typedItem,
          translatedDescription: typedItem[fallbackAttributeName],
          translated: true,
          fromCache: true,
          fallbackCache: true
        });
      }
      
      // If no cached translation, use Amazon Translate service
      const translatedText = await translateText(typedItem.description, targetLanguage);
      
      // Update the item in DynamoDB to cache the translation
      try {
        const updatedItem = await cacheTranslation(userId, itemId, targetLanguage, translatedText);
        
        // Return the translated item
        return createSuccessResponse(200, {
          ...updatedItem.Attributes,
          translatedDescription: translatedText,
          translated: true,
          fromCache: false
        });
      } catch (cacheError) {
        console.error('Error caching translation:', cacheError);
        
        // Even if caching fails, we can still return the translation to the user
        return createSuccessResponse(200, {
          ...typedItem,
          translatedDescription: translatedText,
          translated: true,
          fromCache: false,
          cachingError: "Translation was successful but could not be cached for future use"
        });
      }
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
  // Explicitly set source language to English to avoid relying on Comprehend's language detection
  // This prevents the need for comprehend:DetectDominantLanguage permission
  const translateParams: TranslateParams = {
    Text: text,
    SourceLanguageCode: 'en', // Set to English explicitly instead of 'auto'
    TargetLanguageCode: targetLanguage
  };
  
  try {
    console.log('Calling Amazon Translate with params:', JSON.stringify(translateParams, null, 2));
    const translationResult = await translate.translateText(translateParams).promise();
    console.log('Translation successful:', JSON.stringify(translationResult, null, 2));
    return translationResult.TranslatedText;
  } catch (error) {
    console.error('Amazon Translate API error:', error);
    
    // If there's an error, add more detailed diagnostics
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
      // Check if the error is related to unsupported language
      if (error.name === 'UnsupportedLanguagePairException') {
        console.error(`Unsupported language pair: English to ${targetLanguage}`);
      }
    }
    
    // Re-throw the error to be handled by the caller
    throw error;
  }
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
  try {
    // First, get the current item to access its current state
    const getItemParams: DynamoDB.DocumentClient.GetItemInput = {
      TableName: TABLE_NAME,
      Key: {
        userId,
        itemId
      }
    };
    
    console.log('Getting current item state:', JSON.stringify(getItemParams, null, 2));
    const { Item: currentItem } = await dynamoDb.get(getItemParams).promise();
    
    if (!currentItem) {
      throw new Error('Item not found when attempting to cache translation');
    }
    
    // Create a new translations object based on the current state
    const currentTranslations = (currentItem as ItemData).translations || {};
    const updatedTranslations = {
      ...currentTranslations,
      [targetLanguage]: translatedText
    };
    
    // Update the entire translations object at once
    const updateParams: DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: TABLE_NAME,
      Key: {
        userId,
        itemId
      },
      UpdateExpression: 'SET translations = :translations',
      ExpressionAttributeValues: {
        ':translations': updatedTranslations
      },
      ReturnValues: 'ALL_NEW'
    };
    
    console.log('Updating with simple approach:', JSON.stringify(updateParams, null, 2));
    return dynamoDb.update(updateParams).promise();
  } catch (error) {
    console.error('Error in cacheTranslation:', error);
    
    // In case of any error, try with a very basic approach as last resort
    const basicParams: DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: TABLE_NAME,
      Key: {
        userId,
        itemId
      },
      // Just store the single translation as a top-level attribute
      // This completely avoids nested paths and map operations
      UpdateExpression: 'SET translatedText_' + targetLanguage + ' = :translatedText',
      ExpressionAttributeValues: {
        ':translatedText': translatedText
      },
      ReturnValues: 'ALL_NEW'
    };
    
    console.log('Trying emergency fallback approach:', JSON.stringify(basicParams, null, 2));
    return dynamoDb.update(basicParams).promise();
  }
}
