
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Brain, Upload, History, BarChart3 } from 'lucide-react';
import { CaseUpload } from './CaseUpload';
import { CaseHistory } from './CaseHistory';
import { ProcessingStatus } from './ProcessingStatus';

interface DashboardProps {
  onLogout: () => void;
}

export const Dashboard = ({ onLogout }: DashboardProps) => {
  const [activeTab, setActiveTab] = useState('upload');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Medical AI</h1>
                <p className="text-sm text-gray-600">Brain Tumor Analysis</p>
              </div>
            </div>
            <Button
              onClick={onLogout}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              New Case
            </TabsTrigger>
            <TabsTrigger value="processing" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Processing
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Case History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <CaseUpload />
          </TabsContent>

          <TabsContent value="processing">
            <ProcessingStatus />
          </TabsContent>

          <TabsContent value="history">
            <CaseHistory />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
