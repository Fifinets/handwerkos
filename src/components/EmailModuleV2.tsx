import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
    Mail,
    Inbox,
    Send,
    Star,
    Archive,
    Trash2,
    Search,
    Filter,
    Paperclip,
    Reply,
    ReplyAll,
    Forward,
    MoreHorizontal,
    Plus,
    BrainCircuit,
    Settings,
    X
} from "lucide-react";

interface Email {
    id: string;
    sender: string;
    senderEmail: string;
    subject: string;
    preview: string;
    date: string;
    isRead: boolean;
    isStarred: boolean;
    category?: 'Inquiry' | 'Invoice' | 'Support' | 'Newsletter';
}

const mockEmails: Email[] = [
    {
        id: '1',
        sender: 'Max Mustermann',
        senderEmail: 'max@mustermann.de',
        subject: 'Angebot für Badezimmer-Sanierung benötigt',
        preview: 'Guten Tag, ich würde gerne ein Angebot für die Sanierung meines...',
        date: '10:42',
        isRead: false,
        isStarred: true,
        category: 'Inquiry'
    },
    {
        id: '2',
        sender: 'Anna Müller',
        senderEmail: 'a.mueller@firma.de',
        subject: 'Rückfrage Küchenumbau',
        preview: 'Hallo, wir planen einen kompletten Küchenumbau in unserem Restaurant...',
        date: 'Gestern',
        isRead: true,
        isStarred: false,
        category: 'Inquiry'
    },
    {
        id: '3',
        sender: 'Buchhaltung XYZ',
        senderEmail: 'buchhaltung@xyz.de',
        subject: 'Rechnung #2025-0154',
        preview: 'Sehr geehrte Damen und Herren, hiermit erhalten Sie unsere Rechnung...',
        date: 'Vorgestern',
        isRead: true,
        isStarred: false,
        category: 'Invoice'
    }
];

const EmailModuleV2 = () => {
    const [activeFolder, setActiveFolder] = useState('inbox');
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(mockEmails[0]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isComposing, setIsComposing] = useState(false);

    const getCategoryColor = (category?: string) => {
        switch (category) {
            case 'Inquiry': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Invoice': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'Support': return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'Newsletter': return 'bg-slate-100 text-slate-700 border-slate-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="p-6 h-[calc(100vh-64px)] max-w-[1600px] mx-auto flex flex-col space-y-4">
            {/* Top Header */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Posteingang</h1>
                    <p className="text-sm text-slate-500 mt-1">Verwalten Sie Ihre E-Mails und generieren Sie automatisch Angebote.</p>
                </div>
                <Button className="bg-slate-900 hover:bg-slate-800 text-white" onClick={() => setIsComposing(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Neue E-Mail
                </Button>
            </div>

            <div className="flex flex-1 gap-4 min-h-0">
                {/* Sidebar */}
                <Card className="w-56 shrink-0 bg-white border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-3">
                        <Button variant="outline" className="w-full bg-slate-50 border-slate-200 justify-start text-slate-700">
                            <BrainCircuit className="h-4 w-4 mr-2 text-slate-500" />
                            KI Inbox Sortierung
                        </Button>
                    </div>
                    <ScrollArea className="flex-1 px-3">
                        <div className="space-y-1 mt-2">
                            <Button
                                variant="ghost"
                                className={`w-full justify-start ${activeFolder === 'inbox' ? 'bg-slate-100 font-medium' : 'text-slate-600 font-normal hover:bg-slate-50'}`}
                                onClick={() => setActiveFolder('inbox')}
                            >
                                <Inbox className="h-4 w-4 mr-3 text-slate-500" />
                                Posteingang
                                <span className="ml-auto bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded-full">3</span>
                            </Button>
                            <Button
                                variant="ghost"
                                className={`w-full justify-start ${activeFolder === 'starred' ? 'bg-slate-100 font-medium' : 'text-slate-600 font-normal hover:bg-slate-50'}`}
                                onClick={() => setActiveFolder('starred')}
                            >
                                <Star className="h-4 w-4 mr-3 text-slate-500" />
                                Markiert
                            </Button>
                            <Button
                                variant="ghost"
                                className={`w-full justify-start ${activeFolder === 'sent' ? 'bg-slate-100 font-medium' : 'text-slate-600 font-normal hover:bg-slate-50'}`}
                                onClick={() => setActiveFolder('sent')}
                            >
                                <Send className="h-4 w-4 mr-3 text-slate-500" />
                                Gesendet
                            </Button>
                            <Button
                                variant="ghost"
                                className={`w-full justify-start ${activeFolder === 'archive' ? 'bg-slate-100 font-medium' : 'text-slate-600 font-normal hover:bg-slate-50'}`}
                                onClick={() => setActiveFolder('archive')}
                            >
                                <Archive className="h-4 w-4 mr-3 text-slate-500" />
                                Archiv
                            </Button>
                            <Button
                                variant="ghost"
                                className={`w-full justify-start ${activeFolder === 'trash' ? 'bg-slate-100 font-medium' : 'text-slate-600 font-normal hover:bg-slate-50'}`}
                                onClick={() => setActiveFolder('trash')}
                            >
                                <Trash2 className="h-4 w-4 mr-3 text-slate-500" />
                                Papierkorb
                            </Button>
                        </div>

                        <div className="mt-8 mb-4">
                            <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Kategorien</h3>
                            <div className="space-y-1">
                                <Button variant="ghost" className="w-full justify-start text-slate-600 font-normal hover:bg-slate-50 h-8">
                                    <div className="h-2 w-2 rounded-full bg-slate-500 mr-3" />
                                    Anfragen
                                </Button>
                                <Button variant="ghost" className="w-full justify-start text-slate-600 font-normal hover:bg-slate-50 h-8">
                                    <div className="h-2 w-2 rounded-full bg-amber-500 mr-3" />
                                    Rechnungen
                                </Button>
                            </div>
                        </div>
                    </ScrollArea>
                    <div className="p-3 border-t border-slate-100">
                        <Button variant="ghost" className="w-full justify-start text-slate-600">
                            <Settings className="h-4 w-4 mr-3 text-slate-500" />
                            Einstellungen
                        </Button>
                    </div>
                </Card>

                {/* Email List */}
                <Card className="w-[350px] shrink-0 bg-white border-slate-200 shadow-sm flex flex-col">
                    <div className="p-3 border-b border-slate-100 flex flex-col gap-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="E-Mails suchen..."
                                className="pl-8 bg-slate-50 border-slate-200 text-sm h-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center justify-between px-1">
                            <div className="text-sm font-medium text-slate-700">Sortieren: Neu nach Alt</div>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500"><Filter className="h-3.5 w-3.5" /></Button>
                        </div>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="divide-y divide-slate-100">
                            {mockEmails.map((email) => (
                                <div
                                    key={email.id}
                                    className={`p-4 cursor-pointer transition-colors border-l-2 ${selectedEmail?.id === email.id ? 'bg-slate-50 border-l-slate-900' : 'hover:bg-slate-50/50 border-l-transparent'
                                        }`}
                                    onClick={() => setSelectedEmail(email)}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-sm truncate pr-2 ${!email.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                                            {email.sender}
                                        </span>
                                        <span className={`text-xs whitespace-nowrap ${!email.isRead ? 'font-medium text-slate-900' : 'text-slate-500'}`}>
                                            {email.date}
                                        </span>
                                    </div>
                                    <div className={`text-xs mb-1.5 truncate ${!email.isRead ? 'font-medium text-slate-900' : 'text-slate-600'}`}>
                                        {email.subject}
                                    </div>
                                    <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2">
                                        {email.preview}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        {email.category && (
                                            <Badge variant="outline" className={`text-[10px] font-normal px-1.5 py-0 h-4 ${getCategoryColor(email.category)}`}>
                                                {email.category}
                                            </Badge>
                                        )}
                                        {email.isStarred && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </Card>

                {/* Email Content */}
                <Card className="flex-1 bg-white border-slate-200 shadow-sm flex flex-col min-w-0">
                    {selectedEmail ? (
                        <>
                            {/* Toolbar */}
                            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-xl shrink-0">
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-200/50">
                                        <Archive className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-200/50">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                    <Separator orientation="vertical" className="h-5 mx-1" />
                                    <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/50">
                                        <Reply className="h-4 w-4 mr-2" />
                                        Antworten
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                    {selectedEmail.category === 'Inquiry' && (
                                        <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white h-8 text-xs">
                                            Angebot erstellen
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-600">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Email Header */}
                            <div className="p-6 pb-4 shrink-0">
                                <div className="flex justify-between items-start gap-4 mb-6">
                                    <h2 className="text-xl font-bold text-slate-900">{selectedEmail.subject}</h2>
                                    <div className="flex items-center gap-2 shrink-0 border border-slate-200 rounded-full px-3 py-1 bg-slate-50">
                                        <BrainCircuit className="h-3.5 w-3.5 text-slate-500" />
                                        <span className="text-xs font-medium text-slate-700">KI: Anfrage</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 border border-slate-200 shadow-sm">
                                            <AvatarFallback className="bg-slate-100 text-slate-600 font-medium">
                                                {selectedEmail.sender.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm text-slate-900">{selectedEmail.sender}</span>
                                                <span className="text-xs text-slate-500">&lt;{selectedEmail.senderEmail}&gt;</span>
                                            </div>
                                            <div className="text-xs text-slate-500">an mich</div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 font-medium">
                                        Heute, {selectedEmail.date}
                                    </div>
                                </div>
                            </div>

                            {/* Email Body */}
                            <ScrollArea className="flex-1 p-6 pt-0">
                                <div className="prose prose-sm prose-slate max-w-none">
                                    <p className="whitespace-pre-line text-slate-700 leading-relaxed">
                                        {selectedEmail.preview}
                                        {'\n\n'}
                                        Das ist eine detailliertere Vorschau des Nachrichtentextes, der hier mit einer ScrollArea versehen ist. In der realen Anwendung würde hier der HTML oder Plain Text Body der E-Mail vollständig angezeigt. Die Abstände sind großzügig bemessen, damit das Lesen sehr leicht fällt.
                                    </p>
                                </div>
                            </ScrollArea>

                            {/* Quick Reply Box */}
                            <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl shrink-0">
                                <div className="border border-slate-200 bg-white rounded-lg shadow-sm focus-within:ring-1 focus-within:ring-slate-400 focus-within:border-slate-400 transition-shadow">
                                    <Textarea
                                        placeholder="Hier schnell antworten..."
                                        className="border-0 focus-visible:ring-0 resize-none min-h-[80px] text-sm"
                                    />
                                    <div className="flex items-center justify-between p-2 pt-0">
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                                                <Paperclip className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white h-7 text-xs px-3">
                                            Senden
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <Mail className="h-8 w-8 text-slate-400" />
                            </div>
                            <p>Wählen Sie eine E-Mail zum Lesen aus</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default EmailModuleV2;

