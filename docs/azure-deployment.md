# Deploying PlayaPlan to Azure Container Apps

This guide explains how to deploy the PlayaPlan application to Azure using Azure Developer CLI (AZD) and Azure Container Apps with GitHub Container Registry integration.

## Prerequisites

1. [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
2. [Azure Developer CLI (AZD)](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd)
3. [Docker](https://docs.docker.com/get-docker/)
4. [GitHub CLI](https://cli.github.com/) (optional, but recommended)
5. GitHub account with permissions to create packages
6. Azure subscription
7. Domain names and DNS access (using Cloudflare)

## Deployment Steps

### 1. Login to Azure

```bash
# Login to Azure
az login

# Set the subscription you want to use
az account set --subscription <SUBSCRIPTION_ID>
```

### 2. Setup Azure Developer CLI Environment

```bash
# Initialize the AZD environment
azd init --template .

# Create a new environment or select an existing one
azd env new playaplan
# OR
azd env select playaplan
```

### 3. Authentication to GitHub Container Registry

You'll need to authenticate to GitHub Container Registry to push your container images:

```bash
# Log in to GitHub using the GitHub CLI (recommended)
gh auth login

# Or using Docker directly
echo $GITHUB_TOKEN | docker login ghcr.io -u <your-github-username> --password-stdin
```

Make sure your GitHub token has the `write:packages` and `read:packages` scopes.

### 4. Configure Environment Variables

Copy the sample environment file:

```bash
cp ./infra/.env.sample ./infra/.env
```

Update the values in the .env file:

```bash
# Azure Configuration
AZURE_ENV_NAME=playaplan
AZURE_LOCATION=westus3
AZURE_SUBSCRIPTION_ID=<your-subscription-id>

# Database Configuration
POSTGRES_ADMIN_USERNAME=playaplanadmin
POSTGRES_ADMIN_PASSWORD=<your-secure-password>

# Domain Configuration
WEB_DOMAIN_NAME=test.playaplan.app
API_DOMAIN_NAME=api-test.playaplan.app

# GitHub Container Registry
GITHUB_USERNAME=<your-github-username>
GITHUB_TOKEN=<your-github-token>
```

Set the environment variables for AZD:

```bash
azd env set AZURE_LOCATION westus3
azd env set POSTGRES_ADMIN_USERNAME playaplanadmin
azd env set POSTGRES_ADMIN_PASSWORD <your-secure-password>
azd env set WEB_DOMAIN_NAME test.playaplan.app
azd env set API_DOMAIN_NAME api-test.playaplan.app
azd env set GITHUB_USERNAME <your-github-username>
azd env set GITHUB_TOKEN <your-github-token>
```

### 5. Build and Push Container Images

Build and push the container images to GitHub Container Registry:

```bash
# Build and push API image
docker build -t ghcr.io/<your-github-username>/playaplan-api:latest -f ./apps/api/Dockerfile .
docker push ghcr.io/<your-github-username>/playaplan-api:latest

# Build and push Web image
docker build -t ghcr.io/<your-github-username>/playaplan-web:latest \
  --target production -f ./apps/web/Dockerfile .
docker push ghcr.io/<your-github-username>/playaplan-web:latest

# Skip container build in azd since we've already pushed to GHCR
azd env set SKIP_CONTAINER_BUILD true
```

### 6. Provision Infrastructure and Deploy Application

```bash
# Preview the deployment
azd provision --preview

# Provision infrastructure 
azd provision
```

The infrastructure provisioning will:
1. Create Azure Container Apps environment and Container Apps
2. Create PostgreSQL database
3. Configure the apps to use your GitHub Container Registry images

### 5. Access the Application

After deployment completes, you can find the URLs to access your application:

```bash
# Get deployment outputs
azd env get-values
```

Look for the `WEB_URI` and `API_URI` in the outputs.

## CI/CD with GitHub Actions and Environments

A GitHub Actions workflow file is included at `.github/workflows/azure-deploy.yml` that uses GitHub Environments for deployment. To set it up:

1. Create GitHub Environments (e.g., `test` and `prod`) in your repository settings

2. Create a new Azure service principal:

```bash
az ad sp create-for-rbac --name "playaplan-github-actions" --role contributor \
                         --scopes /subscriptions/$AZURE_SUBSCRIPTION_ID \
                         --json-auth
```

3. For each environment, add the following secrets:
   - `AZURE_CLIENT_ID` (from the service principal)
   - `AZURE_TENANT_ID` (from the service principal)
   - `AZURE_SUBSCRIPTION_ID`
   - `POSTGRES_ADMIN_USERNAME`
   - `POSTGRES_ADMIN_PASSWORD`
   - `GITHUB_TOKEN` (not needed if using default `${{ secrets.GITHUB_TOKEN }}`)

4. For each environment, add the following variables:
   - `AZURE_ENV_NAME` (e.g., `playaplan-test`)
   - `AZURE_LOCATION` (e.g., `westus3`)
   - `WEB_DOMAIN_NAME` (e.g., `test.playaplan.app` for test, `playaplan.app` for prod)
   - `API_DOMAIN_NAME` (e.g., `api-test.playaplan.app` for test, `api.playaplan.app` for prod)

5. Push to the main branch to trigger the deployment or use the manual workflow_dispatch to select the environment.

### DNS Configuration

After deployment, you need to configure your DNS provider (Cloudflare) to create CNAME records pointing to the Azure Container App URLs:

1. Get the generated URLs:
```bash
azd env get-values
```

2. Create CNAME records in Cloudflare:
   - `test.playaplan.app` → `ca-web-abc123.yellowsupernova-123456.westus3.azurecontainerapps.io`
   - `api-test.playaplan.app` → `ca-api-abc123.yellowsupernova-123456.westus3.azurecontainerapps.io`

3. The TLS certificates will be automatically managed by Azure Container Apps

## Using the Deployment Script

For convenience, a deployment script is included that automates the entire process:

```bash
# Make the script executable
chmod +x ./scripts/deploy-to-azure.sh

# Run with default values
./scripts/deploy-to-azure.sh

# Or specify custom parameters
./scripts/deploy-to-azure.sh playaplan-test westus3 playaplanadmin test.playaplan.app api-test.playaplan.app
```

The script will:
1. Check for required tools
2. Log in to Azure if needed
3. Get GitHub credentials
4. Create the Azure environment and set variables
5. Build and push Docker images to GitHub Container Registry
6. Preview and provision the Azure infrastructure
7. Display the deployment outputs and DNS configuration instructions

## Development and Testing

For local development with the same Docker setup that will be used in Azure:

```bash
# Start the API container
docker build -t playaplan-api -f ./apps/api/Dockerfile .
docker run -p 3000:3000 -e DATABASE_URL=<your-db-url> playaplan-api

# Start the Web container
docker build -t playaplan-web -f ./apps/web/Dockerfile --target production .
docker run -p 5173:5173 -e VITE_API_URL=http://localhost:3000 playaplan-web
```

## Troubleshooting

1. **Database Connection Issues**: Verify your PostgreSQL server firewall allows connections from Azure services
2. **Container Startup Failures**: Check container logs in the Azure Portal
3. **Network Issues**: Ensure the Container Apps environment is configured correctly

```bash
# View container logs
az containerapp logs show -n <container-app-name> -g <resource-group-name>
```
