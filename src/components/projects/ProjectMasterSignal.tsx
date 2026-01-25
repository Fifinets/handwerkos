/**
 * ProjectMasterSignal - Ampel-Komponente für Projektstatus
 *
 * Zeigt den berechneten Gesundheitsstatus eines Projekts als Ampel an,
 * zusammen mit den Top 2 Gründen für gelb/rot.
 */

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, AlertCircle, Info } from "lucide-react";
import type { TrafficLight, HealthReason } from "@/types/projectHealth";

interface ProjectMasterSignalProps {
  status: TrafficLight;
  reasons: HealthReason[];
  isLoading?: boolean;
}

const STATUS_CONFIG: Record<
  TrafficLight,
  {
    label: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    icon: React.ReactNode;
    description: string;
  }
> = {
  green: {
    label: "Alles gut",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
    icon: <CheckCircle className="h-8 w-8 text-green-500" />,
    description: "Das Projekt läuft nach Plan.",
  },
  yellow: {
    label: "Achtung",
    bgColor: "bg-yellow-50",
    textColor: "text-yellow-700",
    borderColor: "border-yellow-200",
    icon: <AlertTriangle className="h-8 w-8 text-yellow-500" />,
    description: "Es gibt Punkte, die Aufmerksamkeit erfordern.",
  },
  red: {
    label: "Kritisch",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    borderColor: "border-red-200",
    icon: <AlertCircle className="h-8 w-8 text-red-500" />,
    description: "Dringende Probleme müssen gelöst werden.",
  },
};

const ProjectMasterSignal: React.FC<ProjectMasterSignalProps> = ({
  status,
  reasons,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 animate-pulse">
            <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-24 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-48"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = STATUS_CONFIG[status];
  const topReasons = reasons.slice(0, 2);

  return (
    <Card className={`${config.borderColor} border-2`}>
      <CardContent className={`p-4 ${config.bgColor}`}>
        <div className="flex items-start gap-4">
          {/* Ampel-Icon */}
          <div className="flex-shrink-0">{config.icon}</div>

          {/* Status-Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`font-semibold text-lg ${config.textColor}`}>
                {config.label}
              </h3>
              <Badge
                variant="outline"
                className={`${config.textColor} ${config.borderColor}`}
              >
                {status === "green"
                  ? "OK"
                  : status === "yellow"
                    ? "Warnung"
                    : "Kritisch"}
              </Badge>
            </div>

            <p className="text-sm text-gray-600 mb-3">{config.description}</p>

            {/* Top Gründe (nur bei gelb/rot) */}
            {topReasons.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Warum?
                </p>
                {topReasons.map((reason, index) => (
                  <div
                    key={`${reason.code}-${index}`}
                    className={`flex items-start gap-2 p-2 rounded-md ${
                      reason.severity === "red"
                        ? "bg-red-100/50"
                        : "bg-yellow-100/50"
                    }`}
                  >
                    <Info
                      className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                        reason.severity === "red"
                          ? "text-red-500"
                          : "text-yellow-500"
                      }`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          reason.severity === "red"
                            ? "text-red-700"
                            : "text-yellow-700"
                        }`}
                      >
                        {reason.title}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {reason.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectMasterSignal;
