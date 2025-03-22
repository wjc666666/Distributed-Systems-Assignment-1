## Serverless REST Assignment - Distributed Systems.

__Name:__ Juncheng Wang

__Demo:__ ... link to your YouTube video demonstration ......

### Context.

Context: Item Management System

Table item attributes:
+ userId - string (Partition key)
+ itemId - string (Sort Key)
+ name - string
+ description - string
+ category - string
+ price - number
+ itemStatus - string
+ createdAt - string
+ updatedAt - string
+ translations - Map<string, string>

### App API endpoints.

+ POST /things - Create a new item.
+ GET /things/{userId} - Get all items for a specific user.
+ GET /things/{userId}?category=X&status=Y&minPrice=N&maxPrice=M - Get filtered items for a user.
+ PUT /things/{userId}/{itemId} - Update an existing item.
+ GET /things/{userId}/{itemId}/translation?language=fr - Get an item with translated description.

### Features.

#### Translation persistence (if completed)

The solution stores translations in the DynamoDB item itself using a Map attribute. When a translation is requested for the first time, the system calls Amazon Translate service, then caches the result in the translations map. Subsequent requests for the same language use the cached version, reducing costs and improving performance.

Table item with translations:
+ userId - string (Partition key)
+ itemId - string (Sort Key)
+ name - string
+ description - string
+ category - string
+ price - number
+ itemStatus - string
+ createdAt - string
+ updatedAt - string
+ translations - Map<string, string> (maps language codes to translated descriptions)

#### Custom L2 Construct (if completed)

[Not completed yet]

#### Multi-Stack app (if completed)

[Not completed yet]

#### Lambda Layers (if completed)

[Not completed yet]

#### API Keys. (if completed)

API key authentication is implemented to protect write operations (POST, PUT endpoints) in the API Gateway. This prevents unauthorized users from creating or modifying data while allowing public read access.

```ts
// In the CDK infrastructure stack
const api = new apigateway.RestApi(this, 'ItemsApi', {
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS
  }
});

// Create API key and usage plan
const apiKey = new apigateway.ApiKey(this, 'ApiKey');
const usagePlan = new apigateway.UsagePlan(this, 'UsagePlan', {
  name: 'Standard',
  apiStages: [
    {
      api,
      stage: api.deploymentStage
    }
  ]
});
usagePlan.addApiKey(apiKey);

// Set up endpoints with different auth methods
const items = api.root.addResource('things');
items.addMethod('POST', new apigateway.LambdaIntegration(createItemFunction), {
  apiKeyRequired: true // Requires API key
});

const userItems = items.addResource('{userId}');
userItems.addMethod('GET', new apigateway.LambdaIntegration(getItemsFunction), {
  apiKeyRequired: false // Public access
});
```

###  Extra (If relevant).

The implementation uses AWS SDK v3, which provides a modular approach to AWS service integration and improved TypeScript support compared to the older AWS SDK v2.

## Overview

This project implements a serverless RESTful API for managing user items with translation capabilities using AWS serverless technologies (Lambda, API Gateway, DynamoDB, and Amazon Translate).

## System Context

The Item Management System allows users to:

- Create new items with various attributes
- Retrieve items with optional filtering
- Update existing items
- Translate item descriptions to different languages
- Cache translations to reduce costs and improve performance

### Data Model

**DynamoDB Table Schema:**

| Attribute | Type | Description |
|-----------|------|-------------|
| userId | String | Partition key, identifies the user |
| itemId | String | Sort key, unique identifier for the item |
| name | String | Name of the item |
| description | String | Detailed description that can be translated |
| category | String | Category for filtering/grouping |
| price | Number | Price value |
| itemStatus | String | Status of the item (e.g., "available", "sold") |
| createdAt | String | ISO date when the item was created |
| updatedAt | String | ISO date when the item was last updated |
| translations | Map | Cached translations (language code → translated text) |

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|--------------|
| POST | /things | Create a new item | API Key |
| GET | /things/{userId} | Get all items for a specific user | No |
| GET | /things/{userId}?category=X&status=Y&minPrice=N&maxPrice=M | Get filtered items for a user | No |
| PUT | /things/{userId}/{itemId} | Update an existing item | API Key |
| GET | /things/{userId}/{itemId}/translation?language=fr | Get an item with translated description | No |

## Architecture

The application uses a serverless architecture with AWS cloud services:

![Architecture Diagram](images/architecture-diagram.txt)

### Components

1. **API Gateway**: Exposes REST endpoints with API key authentication
2. **Lambda Functions**: Handles item operations (create, retrieve, update, translate)
3. **DynamoDB**: Stores items and cached translations
4. **Amazon Translate**: Provides translation services

## Key Features

### Translation Caching

- Translations are cached in DynamoDB to avoid repeated costs
- First request to a language generates and stores the translation
- Subsequent requests use the cached version

### API Key Authentication

- Write operations (POST, PUT) require API keys
- Read operations are public

## Deployment

1. Navigate to the project directory
2. Install dependencies: `npm install`
3. Deploy using AWS CDK: `cdk deploy`

After deployment, the output will provide the API endpoint URL and API key ID for testing.


