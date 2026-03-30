import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { MessageSquare } from "lucide-react";

export type CommentsTabProps = Record<string, never>;

const CommentsTab: React.FC<CommentsTabProps> = () => {
  return (
    <TabsContent value="comments" className="space-y-4 min-h-[600px] mt-0">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Kommentare & Notizen</h3>
        <Button>
          <MessageSquare className="h-4 w-4 mr-2" />
          Kommentar hinzufügen
        </Button>
      </div>
      <Card>
        <CardContent className="p-4">
          <p className="text-gray-500">Projektkommentare werden hier angezeigt...</p>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

export default CommentsTab;
