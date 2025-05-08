import React from 'react';

/**
 * Shifts page component
 * Displays available shifts and user's assigned shifts
 */
const ShiftsPage: React.FC = () => {
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Shifts</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">My Assigned Shifts</h2>
        {/* This would be populated from an API call in a real implementation */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="border-b">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    No shifts assigned yet
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div>
        <h2 className="text-xl font-semibold mb-4">Available Shifts</h2>
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="p-4 border-b">
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="flex-1">
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <select
                  id="date"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option>All Dates</option>
                  <option>Aug 25, 2025</option>
                  <option>Aug 26, 2025</option>
                  <option>Aug 27, 2025</option>
                </select>
              </div>
              
              <div className="flex-1">
                <label htmlFor="job" className="block text-sm font-medium text-gray-700 mb-1">
                  Job Type
                </label>
                <select
                  id="job"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option>All Jobs</option>
                  <option>Kitchen</option>
                  <option>Greeter</option>
                  <option>Setup</option>
                </select>
              </div>
              
              <div className="flex-1">
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <select
                  id="location"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option>All Locations</option>
                  <option>Main Camp</option>
                  <option>Kitchen Tent</option>
                  <option>Gate</option>
                </select>
              </div>
            </div>
            
            <button
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Apply Filters
            </button>
          </div>
          
          <div className="border-b">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    No available shifts found
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiftsPage;
