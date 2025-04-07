import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing database connection...');
    
    // Test the connection by performing a simple query
    const userCount = await prisma.user.count();
    console.log(`Connection successful! Current user count: ${userCount}`);
    
    // Get all model names from Prisma client for verification
    const models = Object.keys(prisma).filter(key => 
      !key.startsWith('_') && 
      typeof prisma[key] === 'object' && 
      prisma[key] !== null &&
      typeof prisma[key].findMany === 'function'
    );
    
    console.log('Available models in the database:');
    console.log(models);
    
    return { success: true, message: 'Database connection successful!' };
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    return { success: false, error };
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(result => console.log(result))
  .catch(error => console.error(error));