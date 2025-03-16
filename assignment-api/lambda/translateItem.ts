import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB, Translate } from 'aws-sdk';

const dynamoDb = new DynamoDB.DocumentClient();
const translate = new Translate();
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

    // Get the language to translate to
    const targetLanguage = event.queryStringParameters?.language || 'en';
    
    // Get the item from DynamoDB
    const getItemParams = {
      TableName: TABLE_NAME,
      Key: {
        userId,
        itemId
      }
    };
    
    const { Item: item } = await dynamoDb.get(getItemParams).promise();
    
    if (!item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Item not found' })
      };
    }
    
    // Check if the item has a description to translate
    if (!item.description) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Item has no description to translate' })
      };
    }
    
    // Check if translation already exists in cache
    const translations = item.translations || {};
    if (translations[targetLanguage]) {
      // Return cached translation
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          translatedDescription: translations[targetLanguage],
          translated: true,
          fromCache: true
        })
      };
    }
    
    // If no cached translation, use Amazon Translate service
    const translateParams = {
      Text: item.description,
      SourceLanguageCode: 'auto', // Automatically detect source language
      TargetLanguageCode: targetLanguage
    };
    
    const translationResult = await translate.translateText(translateParams).promise();
    const translatedText = translationResult.TranslatedText;
    
    // Update the item in DynamoDB to cache the translation
    const updateParams = {
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
    
    const updatedItem = await dynamoDb.update(updateParams).promise();
    
    // Return the translated item
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...updatedItem.Attributes,
        translatedDescription: translatedText,
        translated: true,
        fromCache: false
      })
    };
  } catch (error) {
    console.error('Error translating item:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
