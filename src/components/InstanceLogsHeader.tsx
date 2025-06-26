import { ArrowLeft, Server } from "lucide-react";

interface InstanceLogsHeaderProps {
  instanceId: string;
  onBackToDashboard: () => void;
}

export const InstanceLogsHeader = ({
  instanceId,
  onBackToDashboard,
}: InstanceLogsHeaderProps) => {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-sky-600 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="h-8 w-8 text-white" />
          <div>
            <h1 className="text-2xl font-bold text-white">Instance Logs</h1>
            <p className="text-blue-100 text-sm">Instance ID: {instanceId}</p>
          </div>
        </div>
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};
