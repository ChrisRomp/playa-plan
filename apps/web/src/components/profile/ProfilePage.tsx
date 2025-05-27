import ProfileForm from './ProfileForm';

/**
 * Legacy Profile Page Component
 * Displays the profile form
 * 
 * IMPORTANT: This is the legacy component, being replaced by pages/ProfilePage.tsx
 */
const LegacyProfilePage: React.FC = () => {
  
  // NOTE: This is the legacy ProfilePage component in the components directory
  // It's being gradually replaced by the new pages/ProfilePage.tsx that uses React Router
  // This component is kept for backward compatibility during the transition period
  
  // Redirection is now handled by the React Router system

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h1 className="text-2xl font-bold mb-4">Complete Your Profile</h1>
        <p className="text-gray-700 mb-6">
          Before you can register for camp activities, please complete your profile information.
          This information is necessary for camp logistics and emergency situations.
        </p>
        
        <ProfileForm />
      </div>
    </div>
  );
};

export default LegacyProfilePage;
