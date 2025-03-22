# Serverless REST API - Distributed Systems Assignment

__Name:__ Juncheng

__Demo:__ [Demo Link will be added later]

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


