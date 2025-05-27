@description('The location for all resources.')
param location string = resourceGroup().location

@description('Name for the container app.')
param name string

@description('Tags to apply to the container app.')
param tags object = {}

@description('Container image to deploy.')
param containerImage string

@description('Port to expose the container on.')
param containerPort int

@description('Environment ID for the Container App Environment.')
param environmentId string

@description('CPU cores allocated to a single container instance.')
param containerCpuCoreCount string = '0.5'

@description('Memory allocated to a single container instance.')
param containerMemory string = '1.0Gi'

@description('Minimum number of replicas to run.')
param minReplicas int = 1

@description('Maximum number of replicas to run.')
param maxReplicas int = 10

@description('Environment variables for the container.')
param envVars array = []

@description('Name of the registry holding the container image.')
param registry string

@description('Username for the registry.')
@secure()
param registryUsername string

@description('Password for the registry.')
@secure()
param registryPassword string

@description('ID of the managed identity.')
param identityId string

@description('Optional custom domain name to use for the container app')
param customDomainName string = ''

// Container App
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      activeRevisionsMode: 'single'
      ingress: {
        external: true
        targetPort: containerPort
        transport: 'http'
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['*']
          allowedHeaders: ['*']
          exposeHeaders: ['*']
          maxAge: 600
          allowCredentials: true
        }
        customDomains: !empty(customDomainName) ? [
          {
            name: customDomainName
            bindingType: 'SniEnabled'
            certificateId: 'default'
          }
        ] : []
      }
      registries: [
        {
          server: '${registry}.azurecr.io'
          username: registryUsername
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: [
        {
          name: 'registry-password'
          value: registryPassword
        }
      ]
    }
    template: {
      containers: [
        {
          name: name
          image: containerImage
          resources: {
            cpu: json(containerCpuCoreCount)
            memory: containerMemory
          }
          env: envVars
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

// Outputs
output fqdn string = containerApp.properties.configuration.ingress.fqdn
