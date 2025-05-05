import React from 'react';
import LoginForm from './LoginForm';

/**
 * This is a wrapper component that ensures we completely 
 * re-mount the LoginForm component, which fully resets all state.
 * It's a simple but effective solution to persistent state issues.
 */
const LoginFormReset: React.FC = () => {
  return <LoginForm key={Date.now()} />;
};

export default LoginFormReset;
