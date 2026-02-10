import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

// Independent layout for Webbuilder to avoid coupling with main AppSidebar state for now
const WebBuilderLayout = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col w-full bg-background">
            <header className="flex items-center h-16 px-6 border-b shrink-0 bg-card justify-between">
                <div className="flex items-center gap-4">
                    <div className="font-semibold text-lg">Webbuilder</div>
                </div>
                <div>
                    {/* Future: User profile or specific webbuilder actions */}
                </div>
            </header>
            <main className="flex-1 overflow-auto p-6">
                <Outlet />
            </main>
        </div>
    );
};

export default WebBuilderLayout;
