---
name: api-docs-generator
description: Generates API documentation using OpenAPI/Swagger specifications with interactive documentation, code examples, and SDK generation. Use when users request "API documentation", "OpenAPI spec", "Swagger docs", "document API endpoints", or "generate API reference".
---

# API Docs Generator

Create comprehensive API documentation with OpenAPI specifications and interactive documentation.

## Core Workflow

1. **Analyze API endpoints**: Review routes, methods, parameters
2. **Define OpenAPI spec**: Create specification in YAML/JSON
3. **Add schemas**: Define request/response models
4. **Include examples**: Add realistic example values
5. **Generate documentation**: Deploy interactive docs
6. **Create SDK**: Optional client library generation

## OpenAPI Specification Structure

```yaml
# openapi.yaml
openapi: 3.1.0

info:
  title: My API
  version: 1.0.0
  description: |
    API description with **Markdown** support.

    ## Authentication
    All endpoints require Bearer token authentication.
  contact:
    name: API Support
    email: api@example.com
    url: https://docs.example.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://staging-api.example.com/v1
    description: Staging
  - url: http://localhost:3000/v1
    description: Development

tags:
  - name: Users
    description: User management endpoints
  - name: Products
    description: Product catalog endpoints
  - name: Orders
    description: Order processing endpoints

paths:
  # Endpoints defined here

components:
  # Reusable schemas, security, etc.
```

## Path Definitions

### Basic CRUD Endpoints

```yaml
paths:
  /users:
    get:
      tags: [Users]
      summary: List all users
      description: Retrieve a paginated list of users
      operationId: listUsers
      parameters:
        - $ref: '#/components/parameters/PageParam'
        - $ref: '#/components/parameters/LimitParam'
        - name: role
          in: query
          description: Filter by user role
          schema:
            type: string
            enum: [admin, user, guest]
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserList'
        '401':
          $ref: '#/components/responses/Unauthorized'

    post:
      tags: [Users]
      summary: Create a new user
      operationId: createUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '409':
          description: User already exists
        '422':
          $ref: '#/components/responses/ValidationError'

  /users/{userId}:
    parameters:
      - $ref: '#/components/parameters/UserId'
    get:
      tags: [Users]
      summary: Get user by ID
      operationId: getUserById
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          $ref: '#/components/responses/NotFound'
    patch:
      tags: [Users]
      summary: Update user
      operationId: updateUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateUserRequest'
      responses:
        '200':
          description: User updated successfully
        '404':
          $ref: '#/components/responses/NotFound'
    delete:
      tags: [Users]
      summary: Delete user
      operationId: deleteUser
      responses:
        '204':
          description: User deleted successfully
        '404':
          $ref: '#/components/responses/NotFound'
```

## Component Schemas

```yaml
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
          description: Unique user identifier
          example: "usr_123abc"
          readOnly: true
        email:
          type: string
          format: email
          example: "john@example.com"
        name:
          type: string
          minLength: 1
          maxLength: 100
          example: "John Doe"
        role:
          $ref: '#/components/schemas/UserRole'
        createdAt:
          type: string
          format: date-time
          readOnly: true
      required: [id, email, name, role, createdAt]

    UserRole:
      type: string
      enum: [admin, user, guest]
      example: "user"

    CreateUserRequest:
      type: object
      properties:
        email:
          type: string
          format: email
        name:
          type: string
          minLength: 1
          maxLength: 100
        password:
          type: string
          format: password
          minLength: 8
        role:
          $ref: '#/components/schemas/UserRole'
      required: [email, name, password]

    Pagination:
      type: object
      properties:
        page:
          type: integer
          minimum: 1
          example: 1
        limit:
          type: integer
          minimum: 1
          maximum: 100
          example: 20
        total:
          type: integer
          minimum: 0
          example: 150

    Error:
      type: object
      properties:
        code:
          type: string
          example: "VALIDATION_ERROR"
        message:
          type: string
          example: "The request body is invalid"
        details:
          type: array
          items:
            $ref: '#/components/schemas/ErrorDetail'
      required: [code, message]
```

## Security Definitions

```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
    OAuth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://auth.example.com/oauth/authorize
          tokenUrl: https://auth.example.com/oauth/token
          scopes:
            read:users: Read user information
            write:users: Create and modify users

security:
  - BearerAuth: []
```

## Express/Node.js Integration

### Swagger UI Express

```typescript
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { Express } from 'express';

export function setupSwagger(app: Express) {
  const swaggerDocument = YAML.load(
    path.join(__dirname, '../../openapi.yaml')
  );
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    explorer: true,
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
  }));
  app.get('/openapi.json', (req, res) => res.json(swaggerDocument));
}
```

### Zod to OpenAPI

```typescript
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

const UserSchema = z.object({
  id: z.string().uuid().openapi({ example: 'usr_123abc' }),
  email: z.string().email().openapi({ example: 'john@example.com' }),
  name: z.string().min(1).max(100).openapi({ example: 'John Doe' }),
  role: z.enum(['admin', 'user', 'guest']).openapi({ example: 'user' }),
}).openapi('User');

const registry = new OpenAPIRegistry();
registry.register('User', UserSchema);
```

## FastAPI Integration

```python
from fastapi import FastAPI, Query
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from enum import Enum

app = FastAPI(title="My API", version="1.0.0", docs_url="/docs", redoc_url="/redoc")

class UserRole(str, Enum):
    admin = "admin"
    user = "user"
    guest = "guest"

class UserCreate(BaseModel):
    email: EmailStr = Field(..., example="john@example.com")
    name: str = Field(..., min_length=1, max_length=100, example="John Doe")
    password: str = Field(..., min_length=8)
    role: UserRole = Field(default=UserRole.user)

@app.post("/users", status_code=201, tags=["Users"], summary="Create a new user")
async def create_user(user: UserCreate):
    pass
```

## SDK Generation

```bash
# Generate TypeScript client
openapi-generator-cli generate \
  -i openapi.yaml \
  -g typescript-fetch \
  -o ./sdk/typescript \
  --additional-properties=supportsES6=true,npmName=@myorg/api-client

# Generate Python client
openapi-generator-cli generate \
  -i openapi.yaml \
  -g python \
  -o ./sdk/python \
  --additional-properties=packageName=myapi_client
```

## Validation with Spectral

```yaml
# .spectral.yaml
extends: ["spectral:oas"]
rules:
  operation-operationId: error
  operation-description: warn
  operation-tags: error
  info-contact: warn
  oas3-schema: error
```

```bash
npx @stoplight/spectral-cli lint openapi.yaml
```

## Best Practices

1. **Use $ref for reusability**: Define schemas once, reference everywhere
2. **Include examples**: Add realistic examples for all schemas
3. **Document errors**: Describe all possible error responses
4. **Version your API**: Use URL or header versioning
5. **Group with tags**: Organize endpoints logically
6. **Add descriptions**: Explain every parameter and field
7. **Use security schemes**: Document authentication clearly
8. **Validate spec**: Use Spectral or similar tools
9. **Generate SDKs**: Automate client library creation
10. **Keep spec in sync**: Generate from code or validate against it

## Output Checklist

- [ ] Complete OpenAPI 3.x specification
- [ ] All endpoints documented with examples
- [ ] Request/response schemas with types
- [ ] Error responses documented
- [ ] Authentication scheme defined
- [ ] Parameters described with examples
- [ ] Interactive documentation deployed (Swagger UI/Redoc)
- [ ] Specification validated with linter
- [ ] SDK generation configured
- [ ] Versioning strategy documented
