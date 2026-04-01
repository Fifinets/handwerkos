
import React from 'react';
import { Button } from "@/components/ui/button";
import { useWebBuilderStore } from '../context/useWebBuilderStore';
import { ArrowLeft, Monitor, Smartphone, Tablet, Undo, Redo, Eye, Save } from "lucide-react";
import { useNavigate } from 'react-router-dom';

interface EditorTopBarProps {
    siteTitle: string;
    onSave: () => void;
    onPublish: () => void;
    deviceMode: 'desktop' | 'tablet' | 'mobile';
    setDeviceMode: (mode: 'desktop' | 'tablet' | 'mobile') => void;
}

const EditorTopBar = ({ siteTitle, onSave, onPublish, deviceMode, setDeviceMode }: EditorTopBarProps) => {
    const navigate = useNavigate();

    return (
        <div className="h-16 border-b bg-white flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-50">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/webbuilder')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex flex-col">
                    <span className="font-semibold text-sm">{siteTitle || 'My Website'}</span>
                    <span className="text-xs text-muted-foreground">Draft - Last saved just now</span>
                </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-md">
                <Button
                    variant={deviceMode === 'desktop' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setDeviceMode('desktop')}
                >
                    <Monitor className="h-4 w-4" />
                </Button>
                <Button
                    variant={deviceMode === 'tablet' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setDeviceMode('tablet')}
                >
                    <Tablet className="h-4 w-4" />
                </Button>
                <Button
                    variant={deviceMode === 'mobile' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setDeviceMode('mobile')}
                >
                    <Smartphone className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                    <Undo className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                    <Redo className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-slate-200 mx-2"></div>
                <Button variant="outline" size="sm" onClick={onSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                </Button>
                <Button size="sm" onClick={onPublish}>
                    <Eye className="h-4 w-4 mr-2" />
                    Publish
                </Button>
            </div>
        </div>
    );
};

export default EditorTopBar;
