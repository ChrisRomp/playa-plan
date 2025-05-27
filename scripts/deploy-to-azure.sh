#!/bin/bash
# deploy-to-azure.sh - Script to deploy PlayaPlan to Azure

set -e

# Check if azd is installed
if ! command -v azd &> /dev/null; then
  echo "Azure Developer CLI (azd) is not installed. Please install it first:"
  echo "https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd"
  exit 1
fi

# Check if logged into Azure
if ! az account show &> /dev/null; then
  echo "Not logged into Azure. Logging in..."
  az login
fi

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
  echo "GitHub CLI (gh) is not installed. It's recommended for authentication to GitHub Container Registry."
  echo "You can install it from: https://cli.github.com/"
  echo "Continuing without GitHub CLI..."
fi

# Set default values
ENV_NAME=${1:-playaplan}
LOCATION=${2:-eastus}
DB_USER=${3:-playaplanadmin}
RANDOM_SUFFIX=$(LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom | fold -w 5 | head -n 1)
DB_PASSWORD=$(LC_ALL=C tr -dc 'A-Za-z0-9!@#$%^&*()_+' < /dev/urandom | fold -w 16 | head -n 1)
WEB_DOMAIN=${4:-test.playaplan.app}
API_DOMAIN=${5:-api-test.playaplan.app}

# Create or select environment
if ! azd env list | grep -q "^$ENV_NAME "; then
  echo "Creating new environment: $ENV_NAME"
  azd env new $ENV_NAME --no-prompt
else
  echo "Selecting existing environment: $ENV_NAME"
  azd env select $ENV_NAME
fi

# Get GitHub username
if command -v gh &> /dev/null && gh auth status &> /dev/null; then
  GITHUB_USERNAME=$(gh api user | jq -r .login)
else
  read -p "Enter your GitHub username: " GITHUB_USERNAME
fi

# Generate or request GitHub token for Container Registry
if [ -z "$GITHUB_TOKEN" ]; then
  if command -v gh &> /dev/null && gh auth status &> /dev/null; then
    echo "Creating a GitHub token with package permissions..."
    GITHUB_TOKEN=$(gh auth token)
  else
    echo "Please create a Personal Access Token (classic) with 'write:packages' and 'read:packages' scopes at:"
    echo "https://github.com/settings/tokens"
    read -s -p "Enter your GitHub token: " GITHUB_TOKEN
    echo
  fi
fi

# Set environment variables
echo "Setting environment variables..."
azd env set AZURE_LOCATION $LOCATION
azd env set POSTGRES_ADMIN_USERNAME $DB_USER
azd env set POSTGRES_ADMIN_PASSWORD $DB_PASSWORD
azd env set WEB_DOMAIN_NAME $WEB_DOMAIN
azd env set API_DOMAIN_NAME $API_DOMAIN
azd env set GITHUB_USERNAME $GITHUB_USERNAME
azd env set GITHUB_TOKEN $GITHUB_TOKEN

# Log in to the GitHub Container Registry
echo "Logging into GitHub Container Registry..."
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin

# Build and push Docker images
echo "Building and pushing Docker images to GitHub Container Registry..."
IMAGE_VERSION="local-$(date +%s)"
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT=$(git rev-parse --short HEAD)

# Build and push API image
echo "Building API image..."
docker build -t ghcr.io/$GITHUB_USERNAME/playaplan-api:latest \
  --build-arg IMAGE_VERSION=$IMAGE_VERSION \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  --build-arg GIT_COMMIT=$GIT_COMMIT \
  -f apps/api/Dockerfile .

echo "Pushing API image..."
docker push ghcr.io/$GITHUB_USERNAME/playaplan-api:latest

# Build and push Web image
echo "Building Web image..."
docker build -t ghcr.io/$GITHUB_USERNAME/playaplan-web:latest \
  --build-arg IMAGE_VERSION=$IMAGE_VERSION \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  --build-arg GIT_COMMIT=$GIT_COMMIT \
  --target production \
  -f apps/web/Dockerfile .

echo "Pushing Web image..."
docker push ghcr.io/$GITHUB_USERNAME/playaplan-web:latest

# Skip container build in azd since we've already pushed to GHCR
azd env set SKIP_CONTAINER_BUILD true

# Preview the deployment
echo "Previewing deployment (Ctrl+C to cancel)..."
azd provision --preview
echo -e "\nPress Enter to continue with deployment or Ctrl+C to cancel..."
read

# Deploy infrastructure
echo "Deploying infrastructure..."
azd provision --no-prompt

# Show deployment outputs
echo -e "\n=== DEPLOYMENT OUTPUTS ==="
echo "API URL: $(azd env get-values | grep API_URI | cut -d '=' -f2)"
echo "API Generated URL: $(azd env get-values | grep API_GENERATED_URI | cut -d '=' -f2)"
echo "Web URL: $(azd env get-values | grep WEB_URI | cut -d '=' -f2)"
echo "Web Generated URL: $(azd env get-values | grep WEB_GENERATED_URI | cut -d '=' -f2)"
echo -e "\nDatabase credentials are stored in the Azure environment."
echo "You can retrieve them with: azd env get-values"
echo -e "\nNOTE: You need to configure your DNS provider (Cloudflare) to point:"
echo "  - $WEB_DOMAIN -> $(azd env get-values | grep WEB_GENERATED_URI | cut -d '=' -f2 | sed 's/https:\/\///')"
echo "  - $API_DOMAIN -> $(azd env get-values | grep API_GENERATED_URI | cut -d '=' -f2 | sed 's/https:\/\///')"
