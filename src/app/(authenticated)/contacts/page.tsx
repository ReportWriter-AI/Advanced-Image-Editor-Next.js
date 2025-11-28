"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CategoriesManager from "./_components/CategoriesManager";
import PeopleManager from "./_components/PeopleManager";
import ClientManager from "./_components/ClientManager";
import AgencyManager from "./_components/AgencyManager";
import AgentManager from "./_components/AgentManager";
import AgentTeamManager from "./_components/AgentTeamManager";

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Contacts</h2>
        <p className="text-muted-foreground">Manage your contacts, agents, teams, agencies, clients, and people</p>
      </div>

      <Tabs defaultValue="agents" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="agent-teams">Agent Teams</TabsTrigger>
          <TabsTrigger value="agencies">Agencies</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="categories-manager">Categories Manager</TabsTrigger>
        </TabsList>
        
        <TabsContent value="agents" className="mt-6">
          <AgentManager />
        </TabsContent>
        
        <TabsContent value="agent-teams" className="mt-6">
          <AgentTeamManager />
        </TabsContent>
        
        <TabsContent value="agencies" className="mt-6">
          <AgencyManager />
        </TabsContent>
        
        <TabsContent value="clients" className="mt-6">
          <ClientManager />
        </TabsContent>
        
        <TabsContent value="people" className="mt-6">
          <PeopleManager />
        </TabsContent>
        
        <TabsContent value="categories-manager" className="mt-6">
          <CategoriesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

