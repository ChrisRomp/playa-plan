import React from 'react';
import { AuthProvider } from './store/AuthContext';
import { ConfigProvider } from './store/ConfigContext';
import { QueryProvider } from './lib/QueryProvider';
import Layout from './components/layout/Layout';
import MainContent from './components/home/MainContent';

function App() {
  return (
    <QueryProvider>
      <ConfigProvider>
        <AuthProvider>
          <Layout>
            <MainContent />
          </Layout>
        </AuthProvider>
      </ConfigProvider>
    </QueryProvider>
  );
}

export default App;