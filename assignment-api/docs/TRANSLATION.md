# Translation Service Documentation

## Overview

This document explains how the translation service is implemented in our serverless REST API application using AWS Lambda and Amazon Translate.

## Implementation Approach

Our implementation uses AWS Translate to provide translation capabilities for item descriptions. The service allows translating text from English to any supported target language.

### Key Architectural Decision

We've made a deliberate architectural decision to use English as the explicit source language for all translations, rather than using Amazon Translate's automatic language detection feature. 

### Rationale

When using Amazon Translate with `SourceLanguageCode` set to `'auto'`, the service internally calls Amazon Comprehend's `DetectDominantLanguage` API to determine the source language. This creates an implicit dependency requiring additional IAM permissions:

```
comprehend:DetectDominantLanguage
```

By explicitly setting the source language to English (`'en'`), we:

1. Eliminate the dependency on Amazon Comprehend
2. Avoid additional IAM permissions
3. Simplify the security model of the application
4. Reduce the number of API calls (and potentially costs)

## Code Implementation

The key change is in the `translateText` function within `translateItem.ts`:

```typescript
async function translateText(text: string, targetLanguage: string): Promise<string> {
  // Explicitly set source language to English to avoid relying on Comprehend's language detection
  // This prevents the need for comprehend:DetectDominantLanguage permission
  const translateParams: TranslateParams = {
    Text: text,
    SourceLanguageCode: 'en', // Set to English explicitly instead of 'auto'
    TargetLanguageCode: targetLanguage
  };
  
  const translationResult = await translate.translateText(translateParams).promise();
  return translationResult.TranslatedText;
}
```

## IAM Permissions

The Lambda function only requires the following permission:

```typescript
translateItemFunction.addToRolePolicy(new iam.PolicyStatement({
  actions: ['translate:TranslateText'],
  resources: ['*'],
  effect: iam.Effect.ALLOW
}));
```

## Limitation

This approach assumes that all item descriptions in the system are in English. If your application needs to support multiple source languages, you would need to:

1. Add the `comprehend:DetectDominantLanguage` permission to the Lambda role
2. Modify the code to use `'auto'` as the source language code

## Testing

To test the translation functionality:

1. Create an item with an English description
2. Call the translation endpoint with a target language parameter:
   ```
   GET /things/{userId}/{itemId}/translation?language=fr
   ```
3. Verify that the description is translated correctly
4. Subsequent requests for the same language should return cached translations

## Troubleshooting

If you encounter issues with the translation service:

1. Check CloudWatch logs for detailed error messages
2. Verify that the IAM role has the correct permissions
3. Ensure the item description is in English
4. Validate that the target language code is supported by Amazon Translate 