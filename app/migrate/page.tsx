"use client";

import { useState } from "react";
import { Database, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from '@/components/ui/button';
import Dexie from 'dexie';

// Types
type ApplicationStatus = "Applied" | "Interviewing" | "Offer" | "Rejected" | "Withdrawn";
type CoolOffStartType = "application" | "rejection";

interface JobApplication {
  id?: number;
  company: string;
  jobTitle: string;
  location: string;
  status: ApplicationStatus;
  appliedDate: string;
  coolOffEnds: string;
  coolOffStartType: CoolOffStartType;
}

// Database setup
const db = new Dexie('JobApplicationsDB') as Dexie & {
  applications: Dexie.Table<JobApplication, number>;
};

db.version(1).stores({
  applications: '++id, company, jobTitle, location, status, appliedDate, coolOffEnds, coolOffStartType'
});

export default function MigratePage() {
  const [status, setStatus] = useState<'idle' | 'migrating' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [recordCount, setRecordCount] = useState(0);

  const handleMigration = async () => {
    setStatus('migrating');
    setMessage('Reading data from localStorage...');

    try {
      // Read from localStorage
      const storedData = localStorage.getItem('jobApplications');

      if (!storedData) {
        setStatus('error');
        setMessage('No data found in localStorage');
        return;
      }

      const applications = JSON.parse(storedData);
      setRecordCount(applications.length);

      if (applications.length === 0) {
        setStatus('error');
        setMessage('No applications to migrate');
        return;
      }

      setMessage(`Migrating ${applications.length} applications to IndexedDB...`);

      // Clear existing data in IndexedDB
      await db.applications.clear();

      // Insert all applications
      await db.applications.bulkAdd(applications);

      setStatus('success');
      setMessage(`Successfully migrated ${applications.length} applications!`);

      // Optional: Clear localStorage after successful migration
      // localStorage.removeItem('jobApplications');
    } catch (error: any) {
      setStatus('error');
      setMessage(`Migration failed: ${error.message}`);
      console.error('Migration error:', error);
    }
  };

  const handleVerify = async () => {
    try {
      const count = await db.applications.count();
      alert(`IndexedDB contains ${count} applications`);
    } catch (error: any) {
      alert(`Verification failed: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap');

        body {
          font-family: 'Space Mono', monospace;
        }

        h1, h2, h3 {
          font-family: 'Syne', sans-serif;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .float-animation {
          animation: float 6s ease-in-out infinite;
        }

        .pulse-animation {
          animation: pulse-slow 2s ease-in-out infinite;
        }

        .slide-in {
          animation: slideIn 0.6s ease-out forwards;
        }
      `}</style>

      <div className="max-w-2xl w-full">
        {/* Floating Database Icon */}
        <div className="flex justify-center mb-8 float-animation">
          <div className="relative">
            <Database className="w-24 h-24 text-indigo-600" strokeWidth={1.5} />
            <div className="absolute inset-0 bg-indigo-600 blur-2xl opacity-20 rounded-full"></div>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden slide-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white">
            <h1 className="text-4xl font-bold mb-2">Data Migration</h1>
            <p className="text-indigo-100 font-mono text-sm">
              localStorage → IndexedDB
            </p>
          </div>

          {/* Content */}
          <div className="p-8">
            {status === 'idle' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-blue-900 mb-1">Before you begin</p>
                      <p className="text-sm text-blue-800">
                        This tool will migrate your job applications from localStorage to IndexedDB.
                        This enables better performance and pagination support.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-lg">Migration Process:</h3>
                  <div className="space-y-2">
                    {[
                      'Read existing data from localStorage',
                      'Transfer all applications to IndexedDB',
                      'Verify data integrity',
                      'Keep localStorage backup (optional cleanup)'
                    ].map((step, idx) => (
                      <div key={idx} className="flex items-center text-sm">
                        <ArrowRight className="w-4 h-4 mr-3 text-indigo-600" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleMigration}
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg"
                >
                  Start Migration
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            )}

            {status === 'migrating' && (
              <div className="text-center py-12">
                <Loader2 className="w-16 h-16 mx-auto mb-6 text-indigo-600 pulse-animation" />
                <p className="text-lg font-semibold mb-2">{message}</p>
                <p className="text-sm text-gray-500">Please wait...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center py-12 space-y-6">
                <div className="flex justify-center">
                  <CheckCircle2 className="w-20 h-20 text-green-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-green-700 mb-2">Migration Complete!</h2>
                  <p className="text-gray-700 mb-4">{message}</p>
                  <div className="inline-block bg-green-50 px-6 py-3 rounded-full border border-green-200">
                    <span className="font-mono text-lg font-bold text-green-700">
                      {recordCount} records migrated
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 justify-center pt-4">
                  <Button
                    onClick={handleVerify}
                    variant="outline"
                    className="font-mono"
                  >
                    Verify Data
                  </Button>
                  <Button
                    onClick={() => window.location.href = '/'}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 font-bold"
                  >
                    Go to Application Tracker
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center py-12 space-y-6">
                <div className="flex justify-center">
                  <AlertCircle className="w-20 h-20 text-red-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-red-700 mb-2">Migration Failed</h2>
                  <p className="text-gray-700 bg-red-50 p-4 rounded-lg font-mono text-sm">
                    {message}
                  </p>
                </div>

                <Button
                  onClick={() => setStatus('idle')}
                  variant="outline"
                  className="font-mono"
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 font-mono">
            💾 Your data is stored locally in your browser
          </p>
        </div>
      </div>
    </div>
  );
}
