
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Search, 
  Layers, 
  Target, 
  Activity,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';

interface ProcessingCase {
  id: string;
  status: 'processing' | 'completed' | 'error';
  currentStep: string;
  progress: number;
  steps: {
    detection: 'pending' | 'running' | 'completed' | 'error';
    classification: 'pending' | 'running' | 'completed' | 'error';
    grading: 'pending' | 'running' | 'completed' | 'error';
    segmentation: 'pending' | 'running' | 'completed' | 'error';
  };
  results?: {
    tumorDetected: boolean;
    tumorType: string;
    grade?: string;
    confidence: number;
  };
}

export const ProcessingStatus = () => {
  const [cases, setCases] = useState<ProcessingCase[]>([
    {
      id: 'CASE_001',
      status: 'processing',
      currentStep: 'Tumor Classification',
      progress: 65,
      steps: {
        detection: 'completed',
        classification: 'running',
        grading: 'pending',
        segmentation: 'pending'
      }
    },
    {
      id: 'CASE_002',
      status: 'completed',
      currentStep: 'Analysis Complete',
      progress: 100,
      steps: {
        detection: 'completed',
        classification: 'completed',
        grading: 'completed',
        segmentation: 'completed'
      },
      results: {
        tumorDetected: true,
        tumorType: 'Glioma',
        grade: 'Grade II',
        confidence: 0.92
      }
    }
  ]);

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'detection': return Search;
      case 'classification': return Brain;
      case 'grading': return Target;
      case 'segmentation': return Layers;
      default: return Activity;
    }
  };

  const getStepStatus = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' };
      case 'running':
        return { icon: Activity, color: 'text-blue-600', bg: 'bg-blue-100' };
      case 'error':
        return { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' };
      default:
        return { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-100' };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processing':
        return <Badge variant="outline" className="text-blue-600 border-blue-600">Processing</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-600 border-green-600">Completed</Badge>;
      case 'error':
        return <Badge variant="outline" className="text-red-600 border-red-600">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Processing Status</h2>
        <Badge variant="secondary">{cases.length} Active Cases</Badge>
      </div>

      {cases.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No cases processing</h3>
            <p className="text-gray-600">Upload a new case to begin analysis</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cases.map((case_) => (
            <Card key={case_.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{case_.id}</CardTitle>
                  {getStatusBadge(case_.status)}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{case_.currentStep}</span>
                    <span className="font-medium">{case_.progress}%</span>
                  </div>
                  <Progress value={case_.progress} className="h-2" />
                </div>
              </CardHeader>
              <CardContent>
                {/* Processing Steps */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {Object.entries(case_.steps).map(([stepName, stepStatus]) => {
                    const StepIcon = getStepIcon(stepName);
                    const statusConfig = getStepStatus(stepStatus);
                    const StatusIcon = statusConfig.icon;

                    return (
                      <div key={stepName} className="text-center">
                        <div className={`w-12 h-12 rounded-full ${statusConfig.bg} flex items-center justify-center mx-auto mb-2 relative`}>
                          <StepIcon className={`w-6 h-6 ${statusConfig.color}`} />
                          <StatusIcon className={`w-4 h-4 ${statusConfig.color} absolute -bottom-1 -right-1 bg-white rounded-full`} />
                        </div>
                        <p className="text-sm font-medium capitalize">{stepName}</p>
                        <p className="text-xs text-gray-600 capitalize">{stepStatus}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Results */}
                {case_.results && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Analysis Results</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Tumor Detected</p>
                        <p className="font-medium">{case_.results.tumorDetected ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Tumor Type</p>
                        <p className="font-medium">{case_.results.tumorType}</p>
                      </div>
                      {case_.results.grade && (
                        <div>
                          <p className="text-gray-600">Grade</p>
                          <p className="font-medium">{case_.results.grade}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-600">Confidence</p>
                        <p className="font-medium">{(case_.results.confidence * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
