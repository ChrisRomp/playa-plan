import React from 'react';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { ConfigProvider } from './store/ConfigContext';
import { QueryProvider } from './lib/QueryProvider';
import { ProfileProvider } from './store/ProfileContext';
import Layout from './components/layout/Layout';
import AppRouter from './routes/AppRouter';

/**
 * Application entry point
 * Sets up provider context and routing for the entire application
 */
function App() {
  return (
    <HashRouter>
      <QueryProvider>
        <ConfigProvider>
          <AuthProvider>
            <ProfileProvider>
              <Layout>
                <AppRouter />
              </Layout>
            </ProfileProvider>
          </AuthProvider>
        </ConfigProvider>
      </QueryProvider>
    </HashRouter>
  );
}

export default App;