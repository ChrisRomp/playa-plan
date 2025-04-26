import { useState } from 'react';
import { Text } from '../components/Text';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { AlertBox } from '../components/AlertBox';
import { Input } from '../components/Input';
import { Card } from '../components/Card';

const Home = () => {
  const [showAlert, setShowAlert] = useState(true);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-16 px-4 bg-gradient-to-b from-primary-100 to-primary-50 rounded-lg">
        <Text variant="h1" className="mb-6">Welcome to PlayaPlan</Text>
        <Text variant="body-lg" color="text-secondary-600" className="mb-8 max-w-2xl mx-auto">
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
            <Input label="Standard Input" placeholder="Type something..." />
            <Input 
              label="With Helper Text" 
              placeholder="Email address" 
              helperText="We'll never share your email with anyone else."
            />
            <Input 
              label="With Error" 
              placeholder="Invalid field" 
              error="This field is required"
              value="Invalid value" 
            />
            <Input 
              label="Different Variants" 
              placeholder="Filled style" 
              variant="filled"
            />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Text variant="h5">Button Variants</Text>
              <div className="flex flex-wrap gap-2">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Text variant="h5">Button Colors</Text>
              <div className="flex flex-wrap gap-2">
                <Button variant="success">Success</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="warning">Warning</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Text variant="h5">Button Sizes</Text>
              <div className="flex items-center flex-wrap gap-2">
                <Button size="xs">Tiny</Button>
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Button size="xl">Extra Large</Button>
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
            <Text variant="body" color="text-secondary-600">
              Cards can be used to group related content and actions.
            </Text>
          </Card>
          
          <Card className="bg-primary-50 border-primary-100">
            <Text variant="h4" className="mb-2">Colored Card</Text>
            <Text variant="body" color="text-secondary-600">
              You can customize cards with different background colors.
            </Text>
            <div className="mt-4">
              <Button variant="primary" size="sm">Learn More</Button>
            </div>
          </Card>
          
          <Card className="shadow-lg">
            <Text variant="h4" className="mb-2">Elevated Card</Text>
            <Text variant="body" color="text-secondary-600">
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
