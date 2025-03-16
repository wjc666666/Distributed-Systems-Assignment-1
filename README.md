## Serverless REST Assignment - Distributed Systems

__Name:__ Juncheng

__Demo:__ [Demo Link will be added later]

### Context

Context: User Item Management System

This API allows users to manage their items (products, tasks, etc.). Users can create, retrieve, update, and translate item descriptions. Each item belongs to a specific user and has various attributes including a description that can be translated.

Table item attributes:
+ userId - string (Partition key)
+ itemId - string (Sort Key)
+ name - string
+ description - string
+ category - string
+ price - number
+ itemStatus - string
+ createdAt - string (ISO date)
+ updatedAt - string (ISO date)
+ translations - map (language code -> translated description)

### App API endpoints

+ POST /things - Add a new item to the database. Requires API key.
+ GET /things/{userId} - Get all items for a specific user.
+ GET /things/{userId}?category=value&status=value&minPrice=value&maxPrice=value - Get filtered items for a user.
+ PUT /things/{userId}/{itemId} - Update an existing item. Requires API key.
+ GET /things/{userId}/{itemId}/translation?language=fr - Get an item with its description translated to the specified language.

### Architecture

The application uses AWS Serverless services with infrastructure defined using AWS CDK:

![Architecture Diagram](images/architecture-diagram.png)

The architecture consists of:
1. **API Gateway**: Exposes REST endpoints with API key authorization for POST and PUT operations
2. **Lambda Functions**: Four separate Lambda functions for handling different operations (GET, POST, PUT, Translation)
3. **DynamoDB**: NoSQL database for storing items with a composite primary key (userId + itemId)
4. **Amazon Translate**: Service for translating item descriptions to different languages

### Features

#### Translation persistence (if completed)

Translation results are cached in the DynamoDB table to avoid repeated translation costs. When a translation is requested:

1. The system first checks if the requested translation already exists in the item's `translations` map attribute
2. If found, it returns the cached translation
3. If not found, it calls Amazon Translate, stores the result in the `translations` map, and returns the translation

Table item with translations includes:
```json
{
  "userId": "user123",
  "itemId": "item456",
  "name": "Sample Item",
  "description": "This is a sample item description",
  "translations": {
    "fr": "C'est une description d'élément d'échantillon",
    "es": "Esta es una descripción de elemento de muestra"
  }
}
```

#### API Keys (if completed)

The system implements API key authentication to protect sensitive endpoints:

1. **Protected endpoints**: POST /things and PUT /things/{userId}/{itemId}
2. **Implementation**: Uses API Gateway's built-in API key feature
3. **Usage plan**: A usage plan is defined that associates the API key with the API's stage

The CDK code that implements this:
```typescript
// Create API Key for protected endpoints
const apiKey = api.addApiKey('ApiKey');
const plan = api.addUsagePlan('UsagePlan', {
  name: 'Standard'
});

// Add the API key to the usage plan
plan.addApiKey(apiKey);

// Add API stage to the usage plan
plan.addApiStage({
  stage: api.deploymentStage
});

// Apply API key requirement to methods
items.addMethod('POST', new apigateway.LambdaIntegration(postItemFunction), {
  apiKeyRequired: true  // Requires API key
});
```

### Deployment and Testing

To deploy the application:

1. Clone the repository
2. Navigate to the `assignment-api` directory
3. Run `npm install` to install dependencies
4. Run `cdk deploy` to deploy the stack to your AWS account
5. After deployment, the API endpoint URL and API key ID will be displayed in the output

To test the API, you'll need to:
1. Retrieve the API key value using AWS CLI or the AWS Console
2. Use a tool like Postman or cURL to make requests to the API endpoints
3. Include the API key in the `x-api-key` header for POST and PUT requests


