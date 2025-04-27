import { useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Todo } from '../../components/Todo';
import React from 'react';

// Text component types
type TextVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'body' | 'body-lg';

interface TextProps {
  variant: TextVariant;
  className?: string;
  color?: string;
  children: React.ReactNode;
}

// Badge component types
type BadgeVariant = 'default' | 'secondary' | 'success' | 'danger' | 'warning' | 'info';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  rounded?: boolean;
  outline?: boolean;
  children: React.ReactNode;
}

// AlertBox component types
type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

interface AlertBoxProps {
  variant?: AlertVariant;
  title: string;
  children?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

// Placeholder components for demo
const Text = ({ variant, className = '', color = '', children }: TextProps) => {
  const variantStyles = {
    'h1': 'text-4xl font-bold',
    'h2': 'text-3xl font-bold',
    'h3': 'text-2xl font-bold',
    'h4': 'text-xl font-bold',
    'h5': 'text-lg font-bold',
    'body': 'text-base',
    'body-lg': 'text-lg',
  };
  return <div className={`${variantStyles[variant]} ${color} ${className}`}>{children}</div>;
};

const Badge = ({ variant = 'default', size = 'md', rounded = false, outline = false, children }: BadgeProps) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium';
  const sizeClasses: Record<BadgeSize, string> = {
    'sm': 'px-2 py-0.5 text-xs',
    'md': 'px-2.5 py-0.5 text-sm',
    'lg': 'px-3 py-1 text-base',
  };
  const variantClasses: Record<BadgeVariant, string> = {
    'default': outline ? 'border border-blue-500 text-blue-500' : 'bg-blue-100 text-blue-800',
    'secondary': outline ? 'border border-gray-500 text-gray-500' : 'bg-gray-100 text-gray-800',
    'success': outline ? 'border border-green-500 text-green-500' : 'bg-green-100 text-green-800',
    'danger': outline ? 'border border-red-500 text-red-500' : 'bg-red-100 text-red-800',
    'warning': outline ? 'border border-yellow-500 text-yellow-500' : 'bg-yellow-100 text-yellow-800',
    'info': outline ? 'border border-blue-500 text-blue-500' : 'bg-blue-100 text-blue-800',
  };
  const roundedClasses = rounded ? 'rounded-full' : 'rounded';
  
  return (
    <span className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${roundedClasses}`}>
      {children}
    </span>
  );
};

const AlertBox = ({ variant = 'info', title, children, dismissible = false, onDismiss = () => {} }: AlertBoxProps) => {
  const variantClasses: Record<AlertVariant, string> = {
    'info': 'bg-blue-50 text-blue-800 border-blue-200',
    'success': 'bg-green-50 text-green-800 border-green-200',
    'warning': 'bg-yellow-50 text-yellow-800 border-yellow-200',
    'danger': 'bg-red-50 text-red-800 border-red-200',
  };
  
  return (
    <div className={`p-4 rounded border ${variantClasses[variant]}`}>
      <div className="flex justify-between items-start">
        <div className="font-semibold">{title}</div>
        {dismissible && (
          <button 
            type="button" 
            className="text-gray-400 hover:text-gray-500"
            onClick={onDismiss}
          >
            &times;
          </button>
        )}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
};

const Home = () => {
  const [showAlert, setShowAlert] = useState(true);
  const [todoItems, setTodoItems] = useState([
    { id: '1', text: 'Plan camp schedule', completed: true },
    { id: '2', text: 'Register for volunteer shifts', completed: false },
    { id: '3', text: 'Pack supplies', completed: false },
  ]);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-16 px-4 bg-gradient-to-b from-blue-100 to-blue-50 rounded-lg">
        <Text variant="h1" className="mb-6">Welcome to PlayaPlan</Text>
        <Text variant="body-lg" color="text-gray-600" className="mb-8 max-w-2xl mx-auto">
          Plan your camp sessions, volunteer for shifts, and manage your camp experience all in one place.
        </Text>
        <div className="flex flex-wrap gap-4 justify-center">
          <Button size="lg">Get Started</Button>
          <Button size="lg" variant="outline">Learn More</Button>
        </div>
      </section>

      {/* Alerts Example */}
      <section className="space-y-4">
        <Text variant="h3">Notifications</Text>
        
        {showAlert && (
          <AlertBox 
            variant="info" 
            title="Welcome to PlayaPlan!" 
            dismissible 
            onDismiss={() => setShowAlert(false)}
          >
            This is our new platform for camp planning and shift management.
          </AlertBox>
        )}
        
        <div className="grid gap-4 md:grid-cols-2">
          <AlertBox 
            variant="success" 
            title="Success"
          >
            Your shift has been successfully registered.
          </AlertBox>
          <AlertBox 
            variant="warning" 
            title="Warning"
          >
            Camp session is almost fully booked.
          </AlertBox>
          <AlertBox 
            variant="danger" 
            title="Error"
          >
            This email address is already in use.
          </AlertBox>
          <AlertBox 
            variant="info" 
            title="Info"
          >
            New camp sessions have been added.
          </AlertBox>
        </div>
      </section>

      {/* Todo List */}
      <section className="space-y-6">
        <Text variant="h3">Task Management</Text>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Todo 
              title="Camp Preparation Tasks" 
              initialItems={todoItems}
              onSave={setTodoItems}
              className="h-full"
            />
          </div>
          <div>
            <Card className="h-full">
              <Text variant="h4" className="mb-4">Track Your Progress</Text>
              <Text variant="body" color="text-gray-600" className="mb-4">
                Use the task list to keep track of your camp preparation tasks. Mark items as complete as you go.
              </Text>
              <div className="mb-4">
                <Text variant="body" className="font-semibold mb-1">Completion Status:</Text>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-primary-600 h-2.5 rounded-full" 
                    style={{ 
                      width: `${(todoItems.filter(item => item.completed).length / todoItems.length) * 100}%` 
                    }}
                  ></div>
                </div>
                <Text variant="body" className="text-sm text-gray-500 mt-1">
                  {todoItems.filter(item => item.completed).length} of {todoItems.length} tasks completed
                </Text>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Badge Examples */}
      <section className="space-y-4">
        <Text variant="h3">Status Indicators</Text>
        <div className="flex flex-wrap gap-3">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Active</Badge>
          <Badge variant="danger">Canceled</Badge>
          <Badge variant="warning">Pending</Badge>
          <Badge variant="info">New</Badge>
        </div>
        <div className="flex flex-wrap gap-3">
          <Badge rounded>Rounded</Badge>
          <Badge outline>Outline</Badge>
          <Badge size="sm">Small</Badge>
          <Badge size="lg">Large</Badge>
          <Badge variant="success" outline rounded>
            Available
          </Badge>
        </div>
      </section>

      {/* Form Controls */}
      <section className="space-y-6">
        <Text variant="h3">Form Elements</Text>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <Input placeholder="Type something..." />
            <Input 
              placeholder="Email address" 
            />
            <Input 
              placeholder="Invalid field" 
              error="This field is required"
              value="Invalid value" 
            />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Text variant="h5">Button Variants</Text>
              <div className="flex flex-wrap gap-2">
                <Button>Primary</Button>
                <Button>Secondary</Button>
                <Button variant="outline">Outline</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Text variant="h5">Button Sizes</Text>
              <div className="flex items-center flex-wrap gap-2">
                <Button size="sm">Small</Button>
                <Button>Medium</Button>
                <Button size="lg">Large</Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="space-y-6">
        <Text variant="h3">Cards</Text>
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <Text variant="h4" className="mb-2">Basic Card</Text>
            <Text variant="body" color="text-gray-600">
              Cards can be used to group related content and actions.
            </Text>
          </Card>
          
          <Card className="bg-blue-50 border-blue-100">
            <Text variant="h4" className="mb-2">Colored Card</Text>
            <Text variant="body" color="text-gray-600">
              You can customize cards with different background colors.
            </Text>
            <div className="mt-4">
              <Button size="sm">Learn More</Button>
            </div>
          </Card>
          
          <Card className="shadow-lg">
            <Text variant="h4" className="mb-2">Elevated Card</Text>
            <Text variant="body" color="text-gray-600">
              Add shadows to make cards appear elevated above the content.
            </Text>
            <div className="mt-4 flex justify-between">
              <Button variant="outline" size="sm">Cancel</Button>
              <Button size="sm">Submit</Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Home;
