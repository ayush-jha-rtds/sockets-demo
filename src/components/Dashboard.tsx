import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, Plus, Activity, Server } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Dashboard() {
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreateInstance = async () => {
    setIsCreating(true);
    
    try {
      // Call backend API to create a new instance
      const response = await axios.post(`${API_BASE_URL}/api/instances/create`);
      
      if (response.data && response.data.instanceId) {
        // Redirect to the instance logs page
        navigate(`/instance/${response.data.instanceId}`);
      } else {
        // If no instanceId is returned, generate a temporary one
        const tempInstanceId = `instance-${Date.now()}`;
        navigate(`/instance/${tempInstanceId}`);
      }
    } catch (error) {
      console.error('Failed to create instance:', error);
      
      // Even if the API call fails, redirect to a temporary instance for demo purposes
      const tempInstanceId = `instance-${Date.now()}`;
      navigate(`/instance/${tempInstanceId}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Cloud className="h-12 w-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-800">Cloud Instance Manager</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Create and monitor cloud instances with real-time logging capabilities. 
            Choose from multiple transport methods to view live instance data.
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-blue-600 to-sky-600 px-8 py-12 text-center">
              <Server className="h-16 w-16 text-white mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white mb-4">Ready to Deploy?</h2>
              <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
                Launch a new cloud instance and monitor its real-time logs using various transport methods 
                including Short Polling, Long Polling, Server-Sent Events, and WebSockets.
              </p>
              
              <button
                onClick={handleCreateInstance}
                disabled={isCreating}
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl shadow-lg hover:bg-blue-50 hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isCreating ? (
                  <>
                    <Activity className="h-6 w-6 animate-spin" />
                    Creating Instance...
                  </>
                ) : (
                  <>
                    <Plus className="h-6 w-6" />
                    Create Instance
                  </>
                )}
              </button>
            </div>

            {/* Features Section */}
            <div className="p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                Real-Time Monitoring Features
              </h3>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Activity className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-800 mb-2">Short Polling</h4>
                  <p className="text-sm text-gray-600">
                    Regular interval-based data fetching with manual refresh capability
                  </p>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Activity className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-800 mb-2">Long Polling</h4>
                  <p className="text-sm text-gray-600">
                    Efficient continuous connection for real-time updates
                  </p>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                  <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Activity className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-800 mb-2">Server-Sent Events</h4>
                  <p className="text-sm text-gray-600">
                    Unidirectional streaming for live data updates
                  </p>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                  <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Activity className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-800 mb-2">WebSockets</h4>
                  <p className="text-sm text-gray-600">
                    Bidirectional real-time communication channel
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}