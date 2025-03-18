# Serverless REST API - Distributed Systems Assignment

__Name:__ Juncheng

__Demo:__ [Demo Link will be added later]

## Overview

This project implements a serverless RESTful API for managing user items with translation capabilities. Built on AWS serverless technologies (Lambda, API Gateway, DynamoDB, and Amazon Translate), the system allows users to create, retrieve, update items, and translate item descriptions into different languages.

The architecture is defined as Infrastructure as Code (IaC) using AWS Cloud Development Kit (CDK), making it easily deployable and scalable.

## System Context

The Item Management System allows users to organize their items (products, tasks, etc.) with the following features:

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

### Request/Response Examples

#### Create Item (POST /things)
```
// Request
POST /things
x-api-key: your-api-key
Content-Type: application/json

{
  "userId": "user123",
  "itemId": "item789",
  "name": "Gaming Laptop",
  "description": "High-performance gaming laptop with RTX graphics",
  "category": "electronics",
  "price": 1299.99,
  "itemStatus": "available"
}

// Response
{
  "message": "Item created successfully",
  "item": {
    "userId": "user123",
    "itemId": "item789",
    "name": "Gaming Laptop",
    "description": "High-performance gaming laptop with RTX graphics",
    "category": "electronics",
    "price": 1299.99,
    "itemStatus": "available",
    "createdAt": "2023-03-22T14:32:15.123Z",
    "updatedAt": "2023-03-22T14:32:15.123Z"
  }
}
```

#### Get Translated Item (GET /things/{userId}/{itemId}/translation?language=fr)
```
// Response
{
  "userId": "user123",
  "itemId": "item789",
  "name": "Gaming Laptop",
  "description": "High-performance gaming laptop with RTX graphics",
  "category": "electronics",
  "price": 1299.99,
  "itemStatus": "available",
  "createdAt": "2023-03-22T14:32:15.123Z",
  "updatedAt": "2023-03-22T14:32:15.123Z",
  "translations": {
    "fr": "Ordinateur portable de jeu haute performance avec graphiques RTX"
  },
  "translatedDescription": "Ordinateur portable de jeu haute performance avec graphiques RTX",
  "translated": true,
  "fromCache": false
}
```

## Architecture

The application uses a modern serverless architecture with AWS cloud services:

![Architecture Diagram](images/architecture-diagram.png)

### Components

1. **API Gateway**: 
   - Exposes REST endpoints
   - Implements API key authorization for protected endpoints
   - Handles CORS support for cross-origin requests
   - Includes rate limiting for security

2. **Lambda Functions**:
   - **postItem**: Creates new items with validation
   - **getItems**: Retrieves items with filtering and pagination
   - **putItem**: Updates existing items
   - **translateItem**: Translates descriptions and caches results

3. **DynamoDB**:
   - NoSQL database with composite primary key (userId + itemId)
   - Point-in-time recovery enabled for data protection
   - On-demand capacity for cost optimization

4. **Amazon Translate**:
   - Provides high-quality machine translation
   - Automatically detects source language

## Key Features

### Enhanced Translation System

The translation system implements an efficient caching mechanism to reduce costs and improve performance:

1. When a translation is requested, the system first checks if it exists in the cache
2. If found, it immediately returns the cached translation
3. If not found, it uses Amazon Translate to generate the translation
4. The new translation is automatically cached in the item's `translations` map
5. Subsequent requests for the same language will use the cached version

Example of an item with cached translations:
```json
{
  "userId": "user123",
  "itemId": "item456",
  "name": "Sample Item",
  "description": "This is a sample item description",
  "translations": {
    "fr": "C'est une description d'élément d'échantillon",
    "es": "Esta es una descripción de elemento de muestra",
    "de": "Dies ist eine Beispiel-Artikelbeschreibung"
  }
}
```

### Security Features

#### API Keys for Authentication

The system implements API key authentication to protect write operations:

- **Protected endpoints**: POST /things and PUT /things/{userId}/{itemId}
- **Implementation**: Uses API Gateway's built-in API key feature
- **Rate limiting**: Configured in the usage plan to prevent abuse

The CDK code excerpt that implements API key security:
```typescript
// Create API Key and usage plan with rate limiting
const apiKey = api.addApiKey('ApiKey', {
  apiKeyName: 'ItemsServiceApiKey',
  description: 'API Key for Items Service'
});

const plan = api.addUsagePlan('UsagePlan', {
  name: 'Standard',
  description: 'Standard usage plan for Items Service',
  throttle: {
    rateLimit: 10,
    burstLimit: 20
  }
});

// Apply API key requirement to methods
items.addMethod('POST', new apigateway.LambdaIntegration(postItemFunction), {
  apiKeyRequired: true
});
```

#### Additional Security Measures

- CORS headers properly configured for frontend integration
- Input validation on all endpoints
- Error handling that doesn't expose internal details
- X-Ray tracing enabled for monitoring and debugging

## Error Handling

The API implements comprehensive error handling:

- **4xx Errors**: Client errors with descriptive messages
  - 400: Bad Request (validation errors)
  - 404: Not Found (item doesn't exist)
  - 409: Conflict (item already exists)
  - 429: Too Many Requests (rate limiting)

- **5xx Errors**: Server errors with appropriate logging
  - 500: Internal Server Error
  - 503: Service Unavailable (translation service down)

## Development and Deployment

### Prerequisites

- Node.js 14.x or later
- AWS CLI configured with appropriate permissions
- AWS CDK installed (`npm install -g aws-cdk`)

### Deployment Steps

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/distributed-systems-assignment.git
   ```

2. Navigate to the project directory:
   ```
   cd assignment-api
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Deploy the stack:
   ```
   cdk deploy
   ```

5. After deployment, note the API endpoint URL and API key ID from the output:
   ```
   ItemsApiStack.ApiEndpoint = https://abc123def.execute-api.us-east-1.amazonaws.com/prod/
   ItemsApiStack.ApiKeyId = abcdef1234567890
   ```

### Testing the API

1. Retrieve the API key value:
   ```
   aws apigateway get-api-key --api-key [API_KEY_ID] --include-value
   ```

2. Use a tool like Postman, curl, or a frontend application to make requests:
   ```
   curl -X POST \
     https://abc123def.execute-api.us-east-1.amazonaws.com/prod/things \
     -H 'x-api-key: your-api-key-value' \
     -H 'Content-Type: application/json' \
     -d '{"userId": "user123", "itemId": "item001", "name": "Test Item", "description": "Test description"}'
   ```

## Future Enhancements

Potential improvements for the future:

1. User authentication with Amazon Cognito
2. Advanced filtering capabilities
3. Batch operations for efficient bulk processing
4. Integration with S3 for item images
5. Implementation of WebSocket API for real-time updates

## License

This project is licensed under the MIT License - see the LICENSE file for details.


