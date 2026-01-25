/**
 * ProjectNextActionCard - "Was jetzt?" Komponente
 *
 * Zeigt genau eine priorisierte Handlungsempfehlung für das Projekt an.
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Target,
  Clock,
  UserPlus,
  Calendar,
  FileText,
  Package,
  Lightbulb,
} from "lucide-react";
import type { NextAction, NextActionKey } from "@/types/projectHealth";

interface ProjectNextActionCardProps {
  nextAction: NextAction | null;
  onActionClick?: (action: NextAction) => void;
  isLoading?: boolean;
}

const ACTION_ICONS: Record<NextActionKey, React.ReactNode> = {
  SET_TARGETS: <Target className="h-5 w-5" />,
  BOOK_FIRST_TIME: <Clock className="h-5 w-5" />,
  ASSIGN_MANAGER: <UserPlus className="h-5 w-5" />,
  REVIEW_DEADLINE: <Calendar className="h-5 w-5" />,
  CREATE_INVOICE: <FileText className="h-5 w-5" />,
  ADD_MATERIAL: <Package className="h-5 w-5" />,
};

const ProjectNextActionCard: React.FC<ProjectNextActionCardProps> = ({
  nextAction,
  onActionClick,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-500" />
            Was jetzt?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-9 bg-gray-200 rounded w-32 mt-3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!nextAction) {
    return (
      <Card className="border-green-200 bg-green-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-green-500" />
            Was jetzt?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <Target className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-green-700">Alles erledigt!</p>
              <p className="text-sm text-gray-600">
                Keine offenen Aufgaben für dieses Projekt.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const icon = ACTION_ICONS[nextAction.key] || <Target className="h-5 w-5" />;

  const handleClick = () => {
    if (onActionClick) {
      onActionClick(nextAction);
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-blue-500" />
          Was jetzt?
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-blue-600">{icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900">{nextAction.title}</p>
            <p className="text-sm text-gray-600 mb-3">
              {nextAction.description}
            </p>
            <Button
              size="sm"
              onClick={handleClick}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {nextAction.ctaLabel}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectNextActionCard;
