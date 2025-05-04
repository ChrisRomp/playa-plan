import { CoreConfiguration, User, Registration, WorkShift } from '../types/api';

// Mock data for development
const mockConfig: CoreConfiguration = {
  id: '1',
  campName: 'PlayaPlan Camp',
  campDescription: 'The best camp experience ever',
  campBannerUrl: '/images/playa-plan-banner.png',
  campBannerAltText: 'PlayaPlan Camp banner showing camp panorama',
  campIconUrl: '/images/playa-plan-icon.png',
  campIconAltText: 'PlayaPlan Camp logo',
  homePageBlurb: '<h1>Welcome to PlayaPlan Camp</h1><p>This is a mock home page content that would come from the API.</p>',
  isRegistrationOpen: true,
  isEarlyRegistrationOpen: false,
  currentCampYear: 2023,
  defaultCurrency: 'USD',
  paymentProcessorsEnabled: {
    stripe: true,
    paypal: true,
  },
  contactEmail: 'contact@playaplan.example',
};

const mockUser: User = {
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'participant',
  profileComplete: true,
};

const mockRegistration: Registration = {
  id: '1',
  userId: '1',
  year: 2023,
  campingOption: 'Full Week',
  arrivalDate: '2023-08-27',
  departureDate: '2023-09-04',
  paymentStatus: 'paid',
  paymentAmount: 250,
  createdAt: '2023-05-15T10:00:00Z',
  updatedAt: '2023-05-15T10:00:00Z',
};

const mockShifts: WorkShift[] = [
  {
    id: '1',
    jobId: '1',
    jobName: 'Kitchen Cleanup',
    categoryId: '1',
    categoryName: 'Kitchen',
    date: '2023-08-28',
    startTime: '10:00',
    endTime: '12:00',
    location: 'Camp Kitchen',
    description: 'Help clean the kitchen after breakfast',
    maxParticipants: 4,
    currentParticipants: 2,
  },
  {
    id: '2',
    jobId: '2',
    jobName: 'Greeter',
    categoryId: '2',
    categoryName: 'Hospitality',
    date: '2023-08-29',
    startTime: '14:00',
    endTime: '16:00',
    location: 'Camp Entrance',
    description: 'Welcome newcomers to the camp',
    maxParticipants: 2,
    currentParticipants: 1,
  },
];

// In a real implementation, this would be environment-based
const API_URL = 'http://localhost:3000/api';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // For now, return mock data based on the endpoint
    // In a real implementation, this would make actual API calls
    switch (endpoint) {
      case '/core-configuration':
        return mockConfig as unknown as T;
      case '/users/me':
        return mockUser as unknown as T;
      case '/registrations/current':
        return mockRegistration as unknown as T;
      case '/shifts':
        return mockShifts as unknown as T;
      default:
        throw new Error(`Endpoint not mocked: ${endpoint}`);
    }
  }

  async getCoreConfiguration(): Promise<CoreConfiguration> {
    return this.request<CoreConfiguration>('/core-configuration');
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/users/me');
  }

  async getCurrentRegistration(): Promise<Registration | null> {
    try {
      return await this.request<Registration>('/registrations/current');
    } catch (error) {
      return null; // User not registered
    }
  }

  async getWorkShifts(): Promise<WorkShift[]> {
    return this.request<WorkShift[]>('/shifts');
  }

  // More methods would be added here for authentication, registration, etc.
}

// Export a singleton instance
export const apiClient = new ApiClient();

export default apiClient; 