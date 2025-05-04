import React from 'react';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
  campName: string;
  campDescription: string;
  bannerUrl?: string;
  iconUrl?: string;
  bannerAltText?: string;
  iconAltText?: string;
  isAuthenticated: boolean;
  userRole?: 'admin' | 'staff' | 'participant';
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  campName,
  campDescription,
  bannerUrl,
  iconUrl,
  bannerAltText,
  iconAltText,
  isAuthenticated,
  userRole,
}) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header
        campName={campName}
        campDescription={campDescription}
        bannerUrl={bannerUrl}
        iconUrl={iconUrl}
        bannerAltText={bannerAltText}
        iconAltText={iconAltText}
        isAuthenticated={isAuthenticated}
        userRole={userRole}
      />
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
      <Footer campName={campName} />
    </div>
  );
};

export default Layout; 