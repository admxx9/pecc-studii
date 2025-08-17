
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Settings, ArrowLeft, Wrench, BookOpen, Pencil, Bell, Ticket } from 'lucide-react'; // Added Bell, Ticket icons
import AddLessonForm from '@/components/admin/add-lesson-form';
import ManageUsers from '@/components/admin/manage-users';
import AddToolForm from '@/components/admin/add-tool-form';
import ManageToolsList from '@/components/admin/manage-tools-list';
import EditToolForm from '@/components/admin/edit-tool-form';
import ManageLessonsList from '@/components/admin/manage-lessons-list';
import EditLessonForm from '@/components/admin/edit-lesson-form';
import NotificationSender from '@/components/admin/notification-sender'; // Import NotificationSender
import ManageCodes from '@/components/admin/manage-codes'; // Import ManageCodes
import SettingsPanel from '@/components/admin/settings-panel'; // Import SettingsPanel
import type { Tool } from '@/components/layout/tools-content';
import type { Lesson } from '@/components/page/home-client-page';


// Add 'manage-codes' to the section types
type AdminSection = 'overview' | 'add-lesson' | 'manage-users' | 'add-tool' | 'manage-tools' | 'manage-lessons' | 'edit-lesson' | 'edit-tool' | 'settings' | 'manage-codes' | 'server-settings';


const AdminPanel = () => {
  // Add 'manage-codes' to the useState type
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [toolToEdit, setToolToEdit] = useState<Tool | null>(null);
  const [lessonToEdit, setLessonToEdit] = useState<Lesson | null>(null);


   const handleEditTool = (tool: Tool) => {
     console.log("Setting tool to edit:", tool);
    setToolToEdit(tool);
    setActiveSection('edit-tool');
   };

    const handleEditLesson = (lesson: Lesson) => {
        console.log("Setting lesson to edit:", lesson);
        setLessonToEdit(lesson);
        setActiveSection('edit-lesson');
    };


  const renderOverview = () => (
    // Responsive grid: 1 column on small, 2 on medium+, adjust columns/gap for more items
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-secondary border-border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-md shadow-sm hover:shadow-lg transition-shadow duration-200">
          <div className="flex-1 mr-4 mb-2 sm:mb-0">
            <h3 className="text-lg font-medium text-foreground">Gerenciar Aulas</h3>
            <p className="text-sm text-muted-foreground mt-1">Adicione, edite ou remova aulas.</p>
          </div>
          <Button
             variant="outline"
             size="sm"
             className="hover:bg-primary hover:text-primary-foreground transition-colors w-full sm:w-auto"
             onClick={() => setActiveSection('manage-lessons')}
             >
            <BookOpen className="mr-2 h-4 w-4" />
            Gerenciar Aulas
          </Button>
        </Card>
        <Card className="bg-secondary border-border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-md shadow-sm hover:shadow-lg transition-shadow duration-200">
          <div className="flex-1 mr-4 mb-2 sm:mb-0">
            <h3 className="text-lg font-medium text-foreground">Gerenciar Ferramentas</h3>
            <p className="text-sm text-muted-foreground mt-1">Adicione, edite ou remova ferramentas.</p>
          </div>
          <Button
             variant="outline"
             size="sm"
             className="hover:bg-primary hover:text-primary-foreground transition-colors w-full sm:w-auto"
             onClick={() => setActiveSection('manage-tools')}
             >
            <Wrench className="mr-2 h-4 w-4" />
            Gerenciar Ferramentas
          </Button>
        </Card>
        <Card className="bg-secondary border-border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-md shadow-sm hover:shadow-lg transition-shadow duration-200">
          <div className="flex-1 mr-4 mb-2 sm:mb-0">
            <h3 className="text-lg font-medium text-foreground">Gerenciar Usuários</h3>
            <p className="text-sm text-muted-foreground mt-1">Visualize e gerencie os usuários.</p>
          </div>
          <Button variant="outline" size="sm" className="hover:bg-primary hover:text-primary-foreground transition-colors w-full sm:w-auto" onClick={() => setActiveSection('manage-users')}>
            <Users className="mr-2 h-4 w-4" />
            Gerenciar
          </Button>
        </Card>
         {/* New Card for Managing Codes */}
         <Card className="bg-secondary border-border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-md shadow-sm hover:shadow-lg transition-shadow duration-200">
          <div className="flex-1 mr-4 mb-2 sm:mb-0">
            <h3 className="text-lg font-medium text-foreground">Gerenciar Códigos Premium</h3>
            <p className="text-sm text-muted-foreground mt-1">Gere e visualize códigos de resgate.</p>
          </div>
          <Button
             variant="outline"
             size="sm"
             className="hover:bg-primary hover:text-primary-foreground transition-colors w-full sm:w-auto"
             onClick={() => setActiveSection('manage-codes')} // Navigate to the new section
             >
            <Ticket className="mr-2 h-4 w-4" /> {/* Use Ticket icon */}
            Gerenciar Códigos
          </Button>
        </Card>
        <Card className="bg-secondary border-border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-md shadow-sm hover:shadow-lg transition-shadow duration-200">
          <div className="flex-1 mr-4 mb-2 sm:mb-0">
            <h3 className="text-lg font-medium text-foreground">Enviar Notificações</h3>
            <p className="text-sm text-muted-foreground mt-1">Envie mensagens para os usuários.</p>
          </div>
          <Button
             variant="outline"
             size="sm"
             className="hover:bg-primary hover:text-primary-foreground transition-colors w-full sm:w-auto"
             onClick={() => setActiveSection('settings')} // Use 'settings' section for notifications
             >
            <Bell className="mr-2 h-4 w-4" />
            Notificações
          </Button>
        </Card>
         <Card className="bg-secondary border-border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-md shadow-sm hover:shadow-lg transition-shadow duration-200">
            <div className="flex-1 mr-4 mb-2 sm:mb-0">
                <h3 className="text-lg font-medium text-foreground">Configurações do Servidor</h3>
                <p className="text-sm text-muted-foreground mt-1">Gerencie o modo de manutenção.</p>
            </div>
            <Button
                variant="outline"
                size="sm"
                className="hover:bg-primary hover:text-primary-foreground transition-colors w-full sm:w-auto"
                onClick={() => setActiveSection('server-settings')}
            >
                <Settings className="mr-2 h-4 w-4" />
                Configurar
            </Button>
         </Card>
      </div>
  );

    // Determine the section to navigate back to
    const getBackSection = (): AdminSection => {
        switch (activeSection) {
            case 'add-tool':
            case 'edit-tool':
                return 'manage-tools';
             case 'add-lesson':
            case 'edit-lesson':
                 return 'manage-lessons';
            case 'manage-users':
            case 'settings':
            case 'manage-codes': // Back from manage-codes goes to overview
            case 'server-settings':
                 return 'overview';
            default:
                return 'overview';
        }
    };

  return (
    // Removed padding from this container - handled by parent now
    <main className="flex-1">
      <Card className="bg-card rounded-lg shadow-lg overflow-hidden">
         <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border pb-4 p-4 md:p-6"> {/* Keep internal header padding */}
            <div className="mb-3 sm:mb-0">
             <CardTitle className="text-xl md:text-2xl font-semibold text-foreground flex items-center gap-2">
                {/* Conditional Title */}
                 {activeSection === 'overview' && 'Painel de Administração'}
                 {activeSection === 'manage-lessons' && <><BookOpen className="h-5 w-5" /> Gerenciar Aulas</>}
                 {activeSection === 'add-lesson' && <><Plus className="h-5 w-5" /> Adicionar Nova Aula</>}
                 {activeSection === 'edit-lesson' && <><Pencil className="h-5 w-5" /> Editar Aula</>}
                 {activeSection === 'manage-users' && <><Users className="h-5 w-5" /> Gerenciar Usuários</>}
                 {activeSection === 'manage-tools' && <><Wrench className="h-5 w-5" /> Gerenciar Ferramentas</>}
                 {activeSection === 'add-tool' && <><Plus className="h-5 w-5" /> Adicionar Nova Ferramenta</>}
                 {activeSection === 'edit-tool' && <><Pencil className="h-5 w-5" /> Editar Ferramenta</>}
                 {activeSection === 'settings' && <><Bell className="h-5 w-5" /> Enviar Notificação</>}
                 {activeSection === 'manage-codes' && <><Ticket className="h-5 w-5" /> Gerenciar Códigos Premium</>}
                 {activeSection === 'server-settings' && <><Settings className="h-5 w-5" /> Configurações do Servidor</>}
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1 text-sm">
                 {/* Conditional Description */}
                 {activeSection === 'overview' && 'Gerencie o conteúdo do site, usuários e configurações.'}
                 {activeSection === 'manage-lessons' && 'Visualize, adicione, edite ou remova aulas.'}
                 {activeSection === 'add-lesson' && 'Preencha os detalhes da nova aula.'}
                 {activeSection === 'edit-lesson' && `Editando: ${lessonToEdit?.title || 'Aula'}`}
                 {activeSection === 'manage-users' && 'Visualize e gerencie os usuários da plataforma.'}
                 {activeSection === 'manage-tools' && 'Visualize, adicione, edite ou remova ferramentas.'}
                 {activeSection === 'add-tool' && 'Preencha os detalhes da nova ferramenta de modding.'}
                 {activeSection === 'edit-tool' && `Editando: ${toolToEdit?.name || 'Ferramenta'}`}
                 {activeSection === 'settings' && 'Escreva e envie notificações para os usuários.'}
                 {activeSection === 'manage-codes' && 'Gere, visualize e monitore o uso de códigos premium.'}
                 {activeSection === 'server-settings' && 'Ative o modo de manutenção e personalize a mensagem.'}
              </CardDescription>
            </div>
            {activeSection !== 'overview' && (
                <Button variant="outline" size="sm" onClick={() => setActiveSection(getBackSection())} className="w-full sm:w-auto"> {/* Responsive button */}
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>
            )}
        </CardHeader>
        <CardContent className="p-4 md:p-6"> {/* Keep internal content padding */}
            {activeSection === 'overview' && renderOverview()}

            {/* Lesson Management */}
             {activeSection === 'manage-lessons' && (
                <ManageLessonsList
                    setSection={setActiveSection}
                    onEditLesson={handleEditLesson}
                />
            )}
            {activeSection === 'add-lesson' && <AddLessonForm setSection={setActiveSection} />}
            {activeSection === 'edit-lesson' && lessonToEdit && (
                <EditLessonForm
                    setSection={setActiveSection}
                    lesson={lessonToEdit}
                />
            )}

            {/* User Management */}
            {activeSection === 'manage-users' && <ManageUsers />}

            {/* Tool Management */}
            {activeSection === 'manage-tools' && (
                <ManageToolsList
                    setSection={setActiveSection}
                    onEditTool={handleEditTool}
                />
            )}
            {activeSection === 'add-tool' && <AddToolForm setSection={setActiveSection} />}
            {activeSection === 'edit-tool' && toolToEdit && (
                <EditToolForm
                    setSection={setActiveSection}
                    tool={toolToEdit}
                />
            )}

             {/* Premium Code Management */}
             {activeSection === 'manage-codes' && (
                <ManageCodes setSection={setActiveSection} />
             )}


            {/* Settings / Notification Sender */}
            {activeSection === 'settings' && (
               <NotificationSender setSection={setActiveSection} />
             )}
            
            {/* Server Settings */}
            {activeSection === 'server-settings' && (
                <SettingsPanel setSection={setActiveSection} />
            )}
        </CardContent>
      </Card>
    </main>
  );
};

export default AdminPanel;
