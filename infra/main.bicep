@description('The location used for all deployed resources')
param location string = resourceGroup().location

@description('Tags that will be applied to all resources')
param tags object = {}

@description('Name of the environment used to generate resource names')
param environmentName string

@description('Web app custom domain name')
param webDomainName string = 'test.playaplan.app'

@description('API app custom domain name')
param apiDomainName string = 'api-test.playaplan.app'

@description('GitHub Container Registry username')
@secure()
param githubUsername string

@description('GitHub Container Registry token')
@secure()
param githubToken string

@description('Name of the container apps environment')
param containerAppsEnvironmentName string = 'cae-${environmentName}'

@description('Name of the Log Analytics workspace')
param logAnalyticsWorkspaceName string = 'law-${environmentName}'

@description('Name of the Postgres database server')
param postgresServerName string = 'postgres-${environmentName}'

@description('Name of the database')
param databaseName string = 'playaplan'

@description('Administrator login name for the database server')
@secure()
param administratorLogin string

@description('Administrator password for the database server')
@secure()
param administratorLoginPassword string

var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))

// Log Analytics workspace for Container Apps Environment
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: 1
    }
  }
}

// Container Apps Environment
resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppsEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
  }
}

// User-assigned managed identity for Container Apps
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'mi-${resourceToken}'
  location: location
  tags: tags
}

// PostgreSQL flexible server
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: postgresServerName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '15'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// Database for the application
resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  name: databaseName
  parent: postgresServer
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Allow access from Azure services
resource firewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  name: 'AllowAllAzureIps'
  parent: postgresServer
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Using GitHub Container Registry instead of Azure Container Registry
// No need to create an Azure Container Registry resource

// API Container App
module apiContainerApp 'modules/container-app.bicep' = {
  name: 'apiContainerApp'
  params: {
    name: 'ca-api-${resourceToken}'
    location: location
    tags: union(tags, { 'azd-service-name': 'api' })
    identityId: managedIdentity.id
    environmentId: containerAppsEnvironment.id
    containerImage: 'ghcr.io/${githubUsername}/playaplan-api:latest'
    containerPort: 3000
    registry: 'ghcr.io'
    registryUsername: githubUsername
    registryPassword: githubToken
    customDomainName: apiDomainName
    envVars: [
      {
        name: 'DATABASE_URL'
        value: 'postgresql://${administratorLogin}:${administratorLoginPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=require'
      }
      {
        name: 'NODE_ENV'
        value: 'production'
      }
    ]
  }
}

// Web Container App
module webContainerApp 'modules/container-app.bicep' = {
  name: 'webContainerApp'
  params: {
    name: 'ca-web-${resourceToken}'
    location: location
    tags: union(tags, { 'azd-service-name': 'web' })
    identityId: managedIdentity.id
    environmentId: containerAppsEnvironment.id
    containerImage: 'ghcr.io/${githubUsername}/playaplan-web:latest'
    containerPort: 5173
    registry: 'ghcr.io'
    registryUsername: githubUsername
    registryPassword: githubToken
    customDomainName: webDomainName
    envVars: [
      {
        name: 'NODE_ENV'
        value: 'production'
      }
      {
        name: 'VITE_API_URL'
        value: 'https://${apiDomainName}'
      }
    ]
  }
}

// Outputs
output API_URI string = 'https://${apiDomainName}'
output API_GENERATED_URI string = 'https://${apiContainerApp.outputs.fqdn}'
output WEB_URI string = 'https://${webDomainName}'
output WEB_GENERATED_URI string = 'https://${webContainerApp.outputs.fqdn}'
output POSTGRES_HOSTNAME string = postgresServer.properties.fullyQualifiedDomainName
output DATABASE_NAME string = databaseName
